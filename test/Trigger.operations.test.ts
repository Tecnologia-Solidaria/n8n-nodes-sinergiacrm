// test/Trigger.operations.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { IDataObject, IPollFunctions } from 'n8n-workflow';
import {
	classifyEvent,
	cronMatches,
	isIntervalDue,
	poll,
} from '../nodes/SinergiaCRM/operations/Trigger.operations';

interface TriggerContextOverrides {
	params?: Record<string, unknown>;
	staticData?: IDataObject;
	responses?: unknown[];
	mode?: string;
}

function createPollContext(overrides: TriggerContextOverrides = {}) {
	const responses = [...(overrides.responses ?? [])];
	const httpRequestWithAuthentication = vi.fn().mockImplementation(() => {
		if (responses.length === 0) {
			return Promise.reject(new Error('Unexpected request'));
		}
		const next = responses.shift();
		if (next instanceof Error) {
			return Promise.reject(next);
		}
		return Promise.resolve(next);
	});
	const staticData = overrides.staticData ?? {};

	const context = {
		getNodeParameter: vi.fn().mockImplementation((name: string) => overrides.params?.[name]),
		getCredentials: vi.fn().mockResolvedValue({ domainUrl: 'https://crm.example.com/' }),
		getWorkflowStaticData: vi.fn().mockReturnValue(staticData),
		getMode: vi.fn().mockReturnValue(overrides.mode ?? 'trigger'),
		helpers: {
			httpRequestWithAuthentication,
		},
	} as unknown as IPollFunctions;

	return { context, httpRequestWithAuthentication, staticData };
}

function makeRecord(id: string, modified: string, entered = modified) {
	return {
		id,
		type: 'Account',
		attributes: { id, name: `Account ${id}`, date_entered: entered, date_modified: modified },
	};
}

const DEFAULT_PARAMS = {
	checkInterval: 'everyPoll',
	module: ['Accounts'],
	events: ['created', 'updated'],
};

describe('Trigger.operations — classifyEvent (T019)', () => {
	it('clasifica como created cuando date_entered es posterior o igual al cursor', () => {
		const record = { date_entered: '2024-05-01T10:00:00', date_modified: '2024-05-01T10:00:00' };
		expect(classifyEvent(record, '2024-05-01T09:00:00')).toBe('created');
	});

	it('clasifica como updated cuando date_entered es anterior al cursor', () => {
		const record = { date_entered: '2024-04-30T10:00:00', date_modified: '2024-05-01T10:00:00' };
		expect(classifyEvent(record, '2024-05-01T09:00:00')).toBe('updated');
	});

	it('compara correctamente mezclando formato con espacio e ISO', () => {
		const record = { date_entered: '2024-05-01 09:30:00', date_modified: '2024-05-01 09:30:00' };
		expect(classifyEvent(record, '2024-05-01T09:00:00')).toBe('created');
	});
});

describe('Trigger.operations — invariantes del cursor (T020)', () => {
	it('en error transitorio de API el poll falla y el cursor NO avanza', async () => {
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-01T09:00:00' } };
		const { context, httpRequestWithAuthentication } = createPollContext({
			params: DEFAULT_PARAMS,
			staticData,
			responses: [new Error('boom')],
		});

		await expect(poll.call(context)).rejects.toThrow('boom');

		expect(staticData.cursors).toEqual({ Accounts: '2024-05-01T09:00:00' });
		expect(staticData.lastRun).toBeUndefined();
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it('en truncamiento por límite de páginas el cursor NO avanza y no emite nada', async () => {
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-01T09:00:00' } };
		const fullPages = Array.from({ length: 10 }, () => ({
			data: Array.from({ length: 50 }, (_, i) => makeRecord(`acc-${i}`, '2024-05-02T00:00:00')),
		}));
		const { context, httpRequestWithAuthentication } = createPollContext({
			params: DEFAULT_PARAMS,
			staticData,
			responses: fullPages,
		});

		const result = await poll.call(context);

		expect(result).toBeNull();
		expect(staticData.cursors).toEqual({ Accounts: '2024-05-01T09:00:00' });
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(10);
	});

	it('tras un ventanal completo el cursor avanza al registro más antiguo procesado y emite', async () => {
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-01T09:00:00' } };
		const page1 = Array.from({ length: 50 }, (_, i) =>
			makeRecord(`a-${i}`, '2024-05-02T12:00:00', '2024-04-30T08:00:00'),
		);
		const page2 = [
			makeRecord('b-0', '2024-05-02T11:00:00', '2024-04-30T08:00:00'),
			makeRecord('b-1', '2024-05-02T10:00:00', '2024-04-30T08:00:00'),
		];
		const { context, httpRequestWithAuthentication } = createPollContext({
			params: DEFAULT_PARAMS,
			staticData,
			responses: [{ data: page1 }, { data: page2 }],
		});

		const result = await poll.call(context);

		expect(result).not.toBeNull();
		expect(result![0]).toHaveLength(52);
		expect(result![0][0].json).toMatchObject({
			module: 'Accounts',
			event: 'updated',
			id: 'a-0',
			date_entered: '2024-04-30T08:00:00',
		});
		expect(staticData.cursors).toEqual({ Accounts: '2024-05-02T12:00:00' });
		expect(httpRequestWithAuthentication.mock.calls[0][1]).toMatchObject({
			url: 'https://crm.example.com/Api/V8/module/Accounts',
			qs: {
				'filter[date_modified][GTE]': '2024-05-01T09:00:00',
				sort: '-date_modified',
				'page[size]': 50,
				'page[number]': 1,
			},
		});
		expect(httpRequestWithAuthentication.mock.calls[1][1].qs).toMatchObject({ 'page[number]': 2 });
	});

	it('filtra por events: solo emite los tipos seleccionados', async () => {
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-01T09:00:00' } };
		const records = [
			makeRecord('new-1', '2024-05-02T10:00:00', '2024-05-02T10:00:00'),
			makeRecord('old-1', '2024-05-02T11:00:00', '2024-05-01T08:00:00'),
		];
		const { context } = createPollContext({
			params: { ...DEFAULT_PARAMS, events: ['created'] },
			staticData,
			responses: [{ data: records }],
		});

		const result = await poll.call(context);

		expect(result![0]).toHaveLength(1);
		expect(result![0][0].json.id).toBe('new-1');
	});

	it('no re-emite el registro límite cuyo date_modified coincide con el cursor (bug persona repetida)', async () => {
		const record = makeRecord('lim-1', '2024-05-02T10:00:00');
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-02T10:00:00' } };

		const first = await poll.call(
			createPollContext({
				params: DEFAULT_PARAMS,
				staticData,
				responses: [{ data: [record] }],
			}).context,
		);

		expect(first![0]).toHaveLength(1);
		expect(first![0][0].json.id).toBe('lim-1');
		expect(staticData.lastEmittedIds).toEqual({ Accounts: ['lim-1'] });

		// El servidor devuelve el mismo registro en el poll siguiente (límite no estricto)
		const second = await poll.call(
			createPollContext({
				params: DEFAULT_PARAMS,
				staticData,
				responses: [{ data: [record] }],
			}).context,
		);

		expect(second).toBeNull();
	});

	it('emite un registro nuevo aunque el cursor no haya avanzado y lo deduplica después', async () => {
		const boundary = makeRecord('bound-1', '2024-05-02T10:00:00');
		const fresh = makeRecord('new-1', '2024-05-02T11:00:00');
		const staticData: IDataObject = {
			cursors: { Accounts: '2024-05-02T10:00:00' },
			lastEmittedIds: { Accounts: ['bound-1'] },
		};

		const first = await poll.call(
			createPollContext({
				params: DEFAULT_PARAMS,
				staticData,
				responses: [{ data: [fresh, boundary] }],
			}).context,
		);

		expect(first![0]).toHaveLength(1);
		expect(first![0][0].json.id).toBe('new-1');
		expect(staticData.cursors).toEqual({ Accounts: '2024-05-02T11:00:00' });
		expect(staticData.lastEmittedIds).toEqual({ Accounts: ['new-1'] });
	});

	it('conserva los ids límite cuando el cursor no avanza para seguir deduplicando', async () => {
		const record = makeRecord('lim-1', '2024-05-02T10:00:00');
		const staticData: IDataObject = {
			cursors: { Accounts: '2024-05-02T10:00:00' },
			lastEmittedIds: { Accounts: ['lim-1', 'lim-2'] },
		};

		const result = await poll.call(
			createPollContext({
				params: DEFAULT_PARAMS,
				staticData,
				responses: [{ data: [record, makeRecord('lim-2', '2024-05-02T10:00:00')] }],
			}).context,
		);

		expect(result).toBeNull();
		expect(staticData.lastEmittedIds).toEqual({ Accounts: ['lim-1', 'lim-2'] });
	});
});

describe('Trigger.operations — checkInterval y poll sin novedades (T021)', () => {
	it('isIntervalDue: everyPoll siempre debe; horas/días dependen de lastRun', () => {
		const now = new Date();
		expect(isIntervalDue({ checkInterval: 'everyPoll' }, {}, now)).toBe(true);

		expect(
			isIntervalDue(
				{ checkInterval: 'hours', numberHours: 1 },
				{ lastRun: new Date(now.getTime() - 30 * 60 * 1000).toISOString() },
				now,
			),
		).toBe(false);
		expect(
			isIntervalDue(
				{ checkInterval: 'hours', numberHours: 1 },
				{ lastRun: new Date(now.getTime() - 2 * 60 * 60 * 1000).toISOString() },
				now,
			),
		).toBe(true);
		expect(
			isIntervalDue(
				{ checkInterval: 'days', numberDays: 2 },
				{ lastRun: new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString() },
				now,
			),
		).toBe(false);
		expect(isIntervalDue({ checkInterval: 'hours', numberHours: 1 }, {}, now)).toBe(true);
	});

	it('cronMatches: expresión de 5 campos con rangos, pasos y días', () => {
		expect(cronMatches('* * * * *', new Date(2024, 0, 1, 9, 30))).toBe(true);
		expect(cronMatches('*/30 * * * *', new Date(2024, 0, 1, 9, 0))).toBe(true);
		expect(cronMatches('*/30 * * * *', new Date(2024, 0, 1, 9, 15))).toBe(false);
		expect(cronMatches('0 9 * * *', new Date(2024, 0, 1, 9, 0))).toBe(true);
		expect(cronMatches('0 9 * * *', new Date(2024, 0, 1, 10, 0))).toBe(false);
		expect(cronMatches('0 0 * * 0', new Date(2024, 0, 7, 0, 0))).toBe(true);
		expect(cronMatches('0 0 * * 0', new Date(2024, 0, 8, 0, 0))).toBe(false);
		expect(cronMatches('0 0 1 1 *', new Date(2024, 0, 1, 0, 0))).toBe(true);
		expect(cronMatches('0 0 1 1 *', new Date(2024, 1, 1, 0, 0))).toBe(false);
		expect(cronMatches('0 0 * * 1-5', new Date(2024, 0, 1, 0, 0))).toBe(true);
		expect(cronMatches('0 0 * * 1-5', new Date(2024, 0, 6, 0, 0))).toBe(false);
		expect(cronMatches('not a cron', new Date())).toBe(false);
	});

	it('isIntervalDue: cron respeta la expresión y no repite en el mismo minuto', () => {
		const later = new Date(2024, 0, 1, 9, 0);
		expect(
			isIntervalDue({ checkInterval: 'cron', cronExpression: '0 9 * * *' }, {}, later),
		).toBe(true);
		expect(
			isIntervalDue(
				{ checkInterval: 'cron', cronExpression: '0 9 * * *' },
				{ lastRun: later.toISOString() },
				later,
			),
		).toBe(false);
	});

	it('poll devuelve null y no consulta cuando el intervalo no toca', async () => {
		const staticData: IDataObject = {
			cursors: { Accounts: '2024-05-01T09:00:00' },
			lastRun: new Date(Date.now() - 30 * 60 * 1000).toISOString(),
		};
		const { context, httpRequestWithAuthentication } = createPollContext({
			params: { checkInterval: 'hours', numberHours: 1, module: ['Accounts'], events: ['created'] },
			staticData,
			responses: [],
		});

		const result = await poll.call(context);

		expect(result).toBeNull();
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('poll sin novedades devuelve null sin ejecuciones vacías', async () => {
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-01T09:00:00' } };
		const { context, httpRequestWithAuthentication } = createPollContext({
			params: DEFAULT_PARAMS,
			staticData,
			responses: [{ data: [] }],
		});

		const result = await poll.call(context);

		expect(result).toBeNull();
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(staticData.cursors).toEqual({ Accounts: '2024-05-01T09:00:00' });
		expect(staticData.lastRun).toBeDefined();
	});

	it('primer poll siembra el cursor con max(date_modified) sin emitir nada', async () => {
		const { context, httpRequestWithAuthentication } = createPollContext({
			params: DEFAULT_PARAMS,
			staticData: {},
			responses: [{ data: [makeRecord('a-1', '2024-05-02T10:00:00', '2024-05-02T10:00:00')] }],
		});

		const result = await poll.call(context);
		const staticData = context.getWorkflowStaticData('node');

		expect(result).toBeNull();
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(staticData.cursors).toEqual({ Accounts: '2024-05-02T10:00:00' });
	});
});

describe('Trigger.operations — ejecución manual (sample)', () => {
	it('en modo manual devuelve los últimos registros sin tocar el staticData', async () => {
		const staticData: IDataObject = { cursors: { Accounts: '2024-05-01T09:00:00' } };
		const { context, httpRequestWithAuthentication } = createPollContext({
			mode: 'manual',
			params: DEFAULT_PARAMS,
			staticData,
			responses: [
				{
					data: [
						makeRecord('sample-1', '2024-05-02T12:00:00', '2024-05-02T12:00:00'),
						makeRecord('sample-2', '2024-05-02T11:00:00', '2024-05-02T11:00:00'),
					],
				},
			],
		});

		const result = await poll.call(context);

		expect(result![0]).toHaveLength(2);
		expect(result![0][0].json).toMatchObject({
			module: 'Accounts',
			event: 'created',
			id: 'sample-1',
			date_modified: '2024-05-02T12:00:00',
			name: 'Account sample-1',
		});
		expect(staticData).toEqual({ cursors: { Accounts: '2024-05-01T09:00:00' } });
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		const [, requestOptions] = httpRequestWithAuthentication.mock.calls[0] as [string, { qs: object }];
		expect(requestOptions.qs).toEqual({
			sort: '-date_modified',
			'page[size]': 10,
			'page[number]': 1,
		});
	});

	it('en modo manual aplica el filtro de events', async () => {
		const { context } = createPollContext({
			mode: 'manual',
			params: { ...DEFAULT_PARAMS, events: ['created'] },
			responses: [
				{
					data: [
						makeRecord('new-1', '2024-05-02T10:00:00', '2024-05-02T10:00:00'),
						makeRecord('old-1', '2024-05-02T11:00:00', '2024-05-01T08:00:00'),
					],
				},
			],
		});

		const result = await poll.call(context);

		expect(result![0]).toHaveLength(1);
		expect(result![0][0].json.id).toBe('new-1');
		expect(result![0][0].json.event).toBe('created');
	});

	it('en modo manual devuelve null cuando no hay módulos configurados', async () => {
		const { context } = createPollContext({
			mode: 'manual',
			params: { ...DEFAULT_PARAMS, module: [] },
			responses: [],
		});

		expect(await poll.call(context)).toBeNull();
	});
});
