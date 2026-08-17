// test/helpers/parse.test.ts
import { describe, expect, it } from 'vitest';
import { parseJsonInput } from '../../nodes/SinergiaCRM/helpers/parse';

describe('parseJsonInput', () => {
	it('passes through plain objects unchanged', () => {
		expect(parseJsonInput({ name: 'Juan' })).toEqual({ name: 'Juan' });
	});

	it('parses a valid JSON string', () => {
		expect(parseJsonInput('{"name":"Juan"}')).toEqual({ name: 'Juan' });
	});

	it('throws a descriptive error on an invalid JSON string', () => {
		expect(() => parseJsonInput('{invalid')).toThrow(
			'SinergiaCRM: The "Data" field must be a valid JSON string or object.',
		);
	});

	it('throws on non-object, non-string input', () => {
		expect(() => parseJsonInput(42)).toThrow();
		expect(() => parseJsonInput(null)).toThrow();
		expect(() => parseJsonInput(undefined)).toThrow();
		expect(() => parseJsonInput(true)).toThrow();
	});
});
