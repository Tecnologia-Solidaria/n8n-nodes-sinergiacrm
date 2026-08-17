// test/helpers/fields.test.ts
import { describe, expect, it } from 'vitest';
import { buildAttributes, isEmptyValue, resolveFieldName } from '../../nodes/SinergiaCRM/helpers/fields';

describe('resolveFieldName', () => {
	it('returns the field name as-is for standard fields', () => {
		expect(resolveFieldName({ field: 'name', value: 'x' })).toBe('name');
	});

	it('resolves custom fields to the trimmed custom field name', () => {
		expect(resolveFieldName({ field: '__custom__', customField: '  my_field_c ', value: 'x' })).toBe(
			'my_field_c',
		);
	});

	it('returns an empty string when the custom field name is missing', () => {
		expect(resolveFieldName({ field: '__custom__', value: 'x' })).toBe('');
	});
});

describe('isEmptyValue', () => {
	it('treats undefined, null and empty strings as empty', () => {
		expect(isEmptyValue(undefined)).toBe(true);
		expect(isEmptyValue(null)).toBe(true);
		expect(isEmptyValue('')).toBe(true);
	});

	it('treats other values as usable', () => {
		expect(isEmptyValue(0)).toBe(false);
		expect(isEmptyValue(false)).toBe(false);
		expect(isEmptyValue('x')).toBe(false);
	});
});

describe('buildAttributes', () => {
	it('returns an empty object when no fields are provided', () => {
		expect(buildAttributes(undefined)).toEqual({});
		expect(buildAttributes({})).toEqual({});
		expect(buildAttributes({ Field: [] })).toEqual({});
	});

	it('maps field rows to an attributes object', () => {
		const result = buildAttributes({
			Field: [
				{ field: 'firstName', value: 'Ana' },
				{ field: 'age', value: 30 },
			],
		});
		expect(result).toEqual({ firstName: 'Ana', age: 30 });
	});

	it('resolves custom fields to their trimmed custom field name', () => {
		const result = buildAttributes({
			Field: [{ field: '__custom__', customField: '  cstm_field_c ', value: 'x' }],
		});
		expect(result).toEqual({ cstm_field_c: 'x' });
	});

	it('skips rows without a usable field name', () => {
		const result = buildAttributes({
			Field: [
				{ field: '', value: 'x' },
				{ field: '__custom__', customField: '   ', value: 'x' },
			],
		});
		expect(result).toEqual({});
	});
});
