// test/helpers/record.test.ts
import { describe, expect, it } from 'vitest';
import { buildCreateBody, buildUpdateBody } from '../../nodes/SinergiaCRM/helpers/record';

describe('buildCreateBody', () => {
	it('builds the JSON:API create body', () => {
		expect(buildCreateBody('Accounts', { name: 'ACME', type: 'Customer' })).toEqual({
			data: {
				type: 'Accounts',
				attributes: { name: 'ACME', type: 'Customer' },
			},
		});
	});
});

describe('buildUpdateBody', () => {
	it('builds the JSON:API update body with the record id', () => {
		expect(buildUpdateBody('Accounts', 'acc-1', { name: 'ACME Ltd' })).toEqual({
			data: {
				type: 'Accounts',
				id: 'acc-1',
				attributes: { name: 'ACME Ltd' },
			},
		});
	});
});
