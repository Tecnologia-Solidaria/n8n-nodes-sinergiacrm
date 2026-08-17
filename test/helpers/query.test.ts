// test/helpers/query.test.ts
import { describe, expect, it } from 'vitest';
import {
	buildListQuery,
	resolvePageSize,
	shouldFetchNextPage,
} from '../../nodes/SinergiaCRM/helpers/query';

describe('resolvePageSize', () => {
	it('uses the configured page size when returnAll is enabled', () => {
		expect(resolvePageSize(true, 100, { pageSize: 50 })).toBe(50);
	});

	it('falls back to 20 when returnAll is enabled and no page size is set', () => {
		expect(resolvePageSize(true, 100, {})).toBe(20);
		expect(resolvePageSize(true, 100, undefined)).toBe(20);
	});

	it('uses the limit as page size when returnAll is disabled', () => {
		expect(resolvePageSize(false, 25, { pageSize: 50 })).toBe(25);
	});
});

describe('buildListQuery', () => {
	it('builds the pagination query parameters', () => {
		expect(buildListQuery({ pageSize: 20, pageNumber: 3 })).toEqual({
			'page[size]': 20,
			'page[number]': 3,
		});
	});

	it('merges the built filters', () => {
		const filters = {
			Filter: [
				{ field: 'name', operator: 'eq', value: 'ACME' },
				{ field: 'deleted', operator: 'eq', value: '0' },
			],
		};
		expect(buildListQuery({ pageSize: 20, pageNumber: 1, filters })).toEqual({
			'page[size]': 20,
			'page[number]': 1,
			'filter[name][EQ]': 'ACME',
			'filter[deleted][EQ]': '0',
		});
	});
});

describe('shouldFetchNextPage', () => {
	it('continues while returnAll is enabled, the page is full and the limit is not reached', () => {
		expect(
			shouldFetchNextPage({
				returnAll: true,
				recordsLength: 20,
				pageSize: 20,
				limit: 100,
				collectedLength: 20,
			}),
		).toBe(true);
	});

	it('stops when returnAll is disabled', () => {
		expect(
			shouldFetchNextPage({
				returnAll: false,
				recordsLength: 20,
				pageSize: 20,
				limit: 100,
				collectedLength: 20,
			}),
		).toBe(false);
	});

	it('stops when the last page is partial', () => {
		expect(
			shouldFetchNextPage({
				returnAll: true,
				recordsLength: 5,
				pageSize: 20,
				limit: 100,
				collectedLength: 45,
			}),
		).toBe(false);
	});

	it('stops when the limit is reached', () => {
		expect(
			shouldFetchNextPage({
				returnAll: true,
				recordsLength: 20,
				pageSize: 20,
				limit: 100,
				collectedLength: 100,
			}),
		).toBe(false);
	});
});
