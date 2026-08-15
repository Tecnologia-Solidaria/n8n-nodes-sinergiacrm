// test/helpers/filters.test.ts
import { describe, expect, it } from 'vitest';
import { buildFilters, SUPPORTED_OPERATORS } from '../../nodes/SinergiaCRM/helpers/filters';

describe('buildFilters', () => {
	it('returns an empty object when no filters are provided', () => {
		expect(buildFilters(undefined)).toEqual({});
		expect(buildFilters({})).toEqual({});
		expect(buildFilters({ Filter: [] })).toEqual({});
	});

	it('builds filters using the SuiteCRM operator keywords', () => {
		const result = buildFilters({ Filter: [{ field: 'name', operator: 'eq', value: 'Juan' }] });
		expect(result).toEqual({ 'filter[name][EQ]': 'Juan' });
	});

	it('uses eq as the default operator', () => {
		const result = buildFilters({ Filter: [{ field: 'amount', value: 100 }] });
		expect(result).toEqual({ 'filter[amount][EQ]': 100 });
	});

	it('supports the full set of documented operators', () => {
		expect(SUPPORTED_OPERATORS).toEqual({
			eq: 'EQ',
			neq: 'NEQ',
			gt: 'GT',
			gte: 'GTE',
			lt: 'LT',
			lte: 'LTE',
		});
	});

	it('resolves custom fields using the trimmed custom field name', () => {
		const result = buildFilters({
			Filter: [{ field: '__custom__', customField: '  cstm_field_c ', value: 'x' }],
		});
		expect(result).toEqual({ 'filter[cstm_field_c][EQ]': 'x' });
	});

	it('ignores entries with an unsupported operator', () => {
		const result = buildFilters({ Filter: [{ field: 'name', operator: 'like', value: 'a' }] });
		expect(result).toEqual({});
	});

	it('ignores entries without a usable field name or value', () => {
		const result = buildFilters({
			Filter: [
				{ field: '', value: 'x' },
				{ field: 'name', value: '' },
				{ field: '__custom__', customField: '   ', value: 'x' },
			],
		});
		expect(result).toEqual({});
	});
});
