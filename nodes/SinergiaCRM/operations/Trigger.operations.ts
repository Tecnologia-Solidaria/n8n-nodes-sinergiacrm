// operations/Trigger.operations.ts
import type { IDataObject, INodeExecutionData, IPollFunctions } from 'n8n-workflow';
import type { SinergiaCRMListResponse } from '../helpers/types';

const TRIGGER_PAGE_SIZE = 50;
const TRIGGER_MAX_PAGES = 10;
const TRIGGER_DEDUP_CAP = 500;
const TRIGGER_SAMPLE_SIZE = 10;
const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;

const CRON_LIMITS: Array<[number, number]> = [
	[0, 59], // minute
	[0, 23], // hour
	[1, 31], // day of month
	[1, 12], // month
	[0, 7], // day of week
];

function normalizeTimestamp(value: string): string {
	return value.includes(' ') ? value.replace(' ', 'T') : value;
}

function recordDate(record: IDataObject, field: 'date_entered' | 'date_modified'): string | undefined {
	const attributes = record.attributes;
	if (attributes && typeof attributes === 'object' && !Array.isArray(attributes)) {
		const value = (attributes as IDataObject)[field];
		if (typeof value === 'string') {
			return value;
		}
	}
	return typeof record[field] === 'string' ? (record[field] as string) : undefined;
}

/**
 * Classifies a changed record as `created` or `updated`.
 * A record is new when its `date_entered` is at or after the window start.
 */
export function classifyEvent(
	record: { date_entered?: string; date_modified?: string },
	windowStart: string,
): 'created' | 'updated' {
	return normalizeTimestamp(record.date_entered ?? '') >= normalizeTimestamp(windowStart)
		? 'created'
		: 'updated';
}

/**
 * Minimal 5-field cron matcher supporting `*`, lists, ranges and steps.
 * Day-of-week accepts 0-7 (7 treated as Sunday).
 */
export function cronMatches(expression: string, date: Date): boolean {
	const parts = expression.trim().split(/\s+/);
	if (parts.length !== 5) {
		return false;
	}

	const parsed = parts.map((part, index) => {
		const [min, max] = CRON_LIMITS[index];
		const set = parseCronPart(part, min, max);
		if (index === 4 && set !== 'all' && set.has(7)) {
			set.add(0);
		}
		return set;
	});
	const [minute, hour, dayOfMonth, month, dayOfWeek] = parsed as [
		Set<number> | 'all',
		Set<number> | 'all',
		Set<number> | 'all',
		Set<number> | 'all',
		Set<number> | 'all',
	];

	const m = date.getMinutes();
	const h = date.getHours();
	const d = date.getDate();
	const mo = date.getMonth() + 1;
	const w = date.getDay();

	if (!matches(minute, m) || !matches(hour, h) || !matches(month, mo)) {
		return false;
	}
	if (dayOfMonth === 'all' && dayOfWeek === 'all') {
		return true;
	}
	if (dayOfMonth === 'all') {
		return matches(dayOfWeek, w);
	}
	if (dayOfWeek === 'all') {
		return matches(dayOfMonth, d);
	}
	// When both day fields are restricted, cron matches on EITHER.
	return matches(dayOfMonth, d) || matches(dayOfWeek, w);
}

function parseCronPart(part: string, min: number, max: number): Set<number> | 'all' {
	if (part === '*') {
		return 'all';
	}
	const values = new Set<number>();
	for (const token of part.split(',')) {
		const [rangePart, stepPart] = token.split('/');
		const step = stepPart ? parseInt(stepPart, 10) : 1;
		let from: number;
		let to: number;
		if (rangePart === '*') {
			from = min;
			to = max;
		} else if (rangePart.includes('-')) {
			const [a, b] = rangePart.split('-');
			from = parseInt(a, 10);
			to = parseInt(b, 10);
		} else {
			from = parseInt(rangePart, 10);
			to = from;
		}
		if (isNaN(from) || isNaN(to) || isNaN(step) || step < 1) {
			continue;
		}
		for (let v = from; v <= to; v += step) {
			if (v >= min && v <= max) {
				values.add(v);
			}
		}
	}
	return values.size > 0 ? values : 'all';
}

function matches(set: Set<number> | 'all', value: number): boolean {
	return set === 'all' || set.has(value);
}

function sameMinute(a: string, b: Date): boolean {
	const date = new Date(a);
	return (
		date.getFullYear() === b.getFullYear() &&
		date.getMonth() === b.getMonth() &&
		date.getDate() === b.getDate() &&
		date.getHours() === b.getHours() &&
		date.getMinutes() === b.getMinutes()
	);
}

/**
 * Decides whether the internal cadence allows a poll to run now.
 */
export function isIntervalDue(
	params: {
		checkInterval: string;
		numberHours?: number;
		numberDays?: number;
		cronExpression?: string;
	},
	staticData: IDataObject,
	now: Date,
): boolean {
	const lastRun = staticData.lastRun as string | undefined;

	if (params.checkInterval === 'hours') {
		const hours = params.numberHours ?? 1;
		if (!lastRun) {
			return true;
		}
		return now.getTime() - Date.parse(lastRun) >= hours * HOUR_MS;
	}

	if (params.checkInterval === 'days') {
		const days = params.numberDays ?? 1;
		if (!lastRun) {
			return true;
		}
		return now.getTime() - Date.parse(lastRun) >= days * DAY_MS;
	}

	if (params.checkInterval === 'cron') {
		const expression = params.cronExpression ?? '';
		if (!expression) {
			return true;
		}
		if (!cronMatches(expression, now)) {
			return false;
		}
		if (lastRun && sameMinute(lastRun, now)) {
			return false;
		}
		return true;
	}

	// everyPoll (default)
	return true;
}

interface WindowResult {
	records: IDataObject[];
	truncated: boolean;
}

async function seedCursor(this: IPollFunctions, url: string, moduleName: string): Promise<string> {
	const response = (await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url: `${url}/${moduleName}`,
			qs: {
				sort: '-date_modified',
				'page[size]': TRIGGER_PAGE_SIZE,
				'page[number]': 1,
			},
			json: true,
		},
	)) as SinergiaCRMListResponse;

	let newest = '';
	for (const record of response.data ?? []) {
		const modified = recordDate(record, 'date_modified');
		if (modified && modified > newest) {
			newest = modified;
		}
	}
	return newest || new Date().toISOString();
}

async function fetchWindow(
	this: IPollFunctions,
	url: string,
	moduleName: string,
	cursor: string,
): Promise<WindowResult> {
	const collected: IDataObject[] = [];

	for (let page = 1; page <= TRIGGER_MAX_PAGES; page++) {
		const response = (await this.helpers.requestWithAuthentication.call(
			this,
			'SinergiaCRMCredentials',
			{
				method: 'GET',
				url: `${url}/${moduleName}`,
				qs: {
					'filter[date_modified][GTE]': cursor,
					sort: '-date_modified',
					'page[size]': TRIGGER_PAGE_SIZE,
					'page[number]': page,
				},
				json: true,
			},
		)) as SinergiaCRMListResponse;

		const records = response.data ?? [];
		collected.push(...records);
		if (records.length < TRIGGER_PAGE_SIZE) {
			return { records: collected, truncated: false };
		}
	}

	// Every page was full: the window may have been truncated, so do not advance.
	return { records: collected, truncated: true };
}

function buildOutputItem(
	moduleName: string,
	event: 'created' | 'updated',
	record: IDataObject,
	id: string,
	dateEntered: string,
	dateModified: string,
): INodeExecutionData {
	const attributes =
		record.attributes && typeof record.attributes === 'object' && !Array.isArray(record.attributes)
			? record.attributes
			: {};
	return {
		json: {
			module: moduleName,
			event,
			id,
			date_entered: dateEntered,
			date_modified: dateModified,
			...attributes,
		},
	};
}

/**
 * Returns a sample of the most recent records for the selected modules.
 * Used when the node is executed manually from the editor so the user can
 * inspect the data shape without waiting for the next poll. The cursor and
 * the deduplication state are left untouched.
 */
async function pollSample(
	this: IPollFunctions,
	modules: string[],
	events: string[],
): Promise<INodeExecutionData[][] | null> {
	if (modules.length === 0) {
		return null;
	}

	const credentials = await this.getCredentials('SinergiaCRMCredentials');
	const baseUrl = (credentials.domainUrl as string).replace(/\/$/, '');
	const url = `${baseUrl}/Api/V8/module`;

	const sample: INodeExecutionData[] = [];

	for (const moduleName of modules) {
		const response = (await this.helpers.requestWithAuthentication.call(
			this,
			'SinergiaCRMCredentials',
			{
				method: 'GET',
				url: `${url}/${moduleName}`,
				qs: {
					sort: '-date_modified',
					'page[size]': TRIGGER_SAMPLE_SIZE,
					'page[number]': 1,
				},
				json: true,
			},
		)) as SinergiaCRMListResponse;

		for (const record of response.data ?? []) {
			const id = record.id;
			const dateEntered = recordDate(record, 'date_entered');
			const dateModified = recordDate(record, 'date_modified');
			if (typeof id !== 'string' || !id || !dateEntered || !dateModified) {
				continue;
			}

			const event = classifyEvent(
				{ date_entered: dateEntered, date_modified: dateModified },
				dateModified,
			);
			if (!events.includes(event)) {
				continue;
			}

			sample.push(buildOutputItem(moduleName, event, record, id, dateEntered, dateModified));
		}
	}

	return sample.length > 0 ? [sample] : null;
}

/**
 * Polls SinergiaCRM for new or updated records in the selected modules.
 */
export async function poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
	const staticData = this.getWorkflowStaticData('node');
	const now = new Date();

	const modules = this.getNodeParameter('module', []) as string[];
	const events = this.getNodeParameter('events', ['created', 'updated']) as string[];

	if (this.getMode() === 'manual') {
		return await pollSample.call(this, modules, events);
	}

	const checkInterval = this.getNodeParameter('checkInterval', 'everyPoll') as string;
	const numberHours = this.getNodeParameter('numberHours', 1) as number;
	const numberDays = this.getNodeParameter('numberDays', 1) as number;
	const cronExpression = this.getNodeParameter('cronExpression', '') as string;

	if (
		!isIntervalDue(
			{ checkInterval, numberHours, numberDays, cronExpression },
			staticData,
			now,
		)
	) {
		return null;
	}

	const credentials = await this.getCredentials('SinergiaCRMCredentials');
	const baseUrl = (credentials.domainUrl as string).replace(/\/$/, '');
	const url = `${baseUrl}/Api/V8/module`;

	const cursors = (staticData.cursors as IDataObject | undefined) ?? {};
	const lastEmittedIds = (staticData.lastEmittedIds as IDataObject | undefined) ?? {};
	const nextCursors: IDataObject = { ...cursors };
	const nextLastEmittedIds: IDataObject = { ...lastEmittedIds };
	const emitted: INodeExecutionData[] = [];

	for (const moduleName of modules) {
		const cursor = cursors[moduleName] as string | undefined;

		if (!cursor) {
			nextCursors[moduleName] = await seedCursor.call(this, url, moduleName);
			continue;
		}

		const result = await fetchWindow.call(this, url, moduleName, cursor);
		if (result.truncated) {
			continue;
		}

		// Some SinergiaCRM setups do not apply a strict `>` when comparing datetime
		// columns, so a record whose `date_modified` equals the cursor can be
		// returned again on every poll. Deduplicate those boundary records using
		// the ids emitted while the cursor sat at the same timestamp.
		const knownIds = new Set<string>((lastEmittedIds[moduleName] as string[] | undefined) ?? []);

		let newest = '';
		for (const record of result.records) {
			const modified = recordDate(record, 'date_modified');
			if (modified && modified > newest) {
				newest = modified;
			}
		}

		const seenAtCursor: string[] = [];

		for (const record of result.records) {
			const id = record.id;
			const dateEntered = recordDate(record, 'date_entered');
			const dateModified = recordDate(record, 'date_modified');
			if (typeof id !== 'string' || !id || !dateEntered || !dateModified) {
				continue;
			}

			if (knownIds.has(id)) {
				continue;
			}

			if (newest && dateModified === newest) {
				seenAtCursor.push(id);
			}

			const event = classifyEvent({ date_entered: dateEntered, date_modified: dateModified }, cursor);
			if (!events.includes(event)) {
				continue;
			}

			emitted.push(buildOutputItem(moduleName, event, record, id, dateEntered, dateModified));
		}

		if (newest && normalizeTimestamp(newest) > normalizeTimestamp(cursor)) {
			nextCursors[moduleName] = newest;
			nextLastEmittedIds[moduleName] = seenAtCursor.slice(0, TRIGGER_DEDUP_CAP);
		} else if (newest) {
			nextLastEmittedIds[moduleName] = [
				...new Set([...knownIds, ...seenAtCursor]),
			].slice(0, TRIGGER_DEDUP_CAP);
		}
	}

	staticData.cursors = nextCursors;
	staticData.lastEmittedIds = nextLastEmittedIds;
	staticData.lastRun = now.toISOString();

	return emitted.length > 0 ? [emitted] : null;
}
