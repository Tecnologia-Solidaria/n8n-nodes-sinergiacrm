// test/SinergiaCRM.node.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SinergiaCRM } from '../nodes/SinergiaCRM/SinergiaCRM.node';

interface NodeContextOverrides {
	items?: INodeExecutionData[];
	params?: Record<string, unknown>;
	credentials?: { domainUrl: string };
	continueOnFail?: boolean;
	responses?: unknown[];
}

function createExecuteContext(overrides: NodeContextOverrides = {}) {
	const items = overrides.items ?? [{ json: {} }];
	const params = overrides.params ?? {};
	const credentials = overrides.credentials ?? { domainUrl: 'https://crm.example.com/' };
	const responses = [...(overrides.responses ?? [{ data: {} }])];

	const requestWithAuthentication = vi.fn().mockImplementation(() => {
		if (responses.length === 0) {
			return Promise.reject(new Error('Unexpected request'));
		}
		const next = responses.shift();
		if (next instanceof Error) {
			return Promise.reject(next);
		}
		return Promise.resolve(next);
	});

	const context = {
		getInputData: vi.fn().mockReturnValue(items),
		getNodeParameter: vi.fn().mockImplementation((name: string, index: number) => {
			const value = params[name];
			return Array.isArray(value) ? value[index ?? 0] : value;
		}),
		getCredentials: vi.fn().mockResolvedValue(credentials),
		continueOnFail: vi.fn().mockReturnValue(overrides.continueOnFail ?? false),
		helpers: {
			requestWithAuthentication,
		},
	} as unknown as IExecuteFunctions;

	return { context, requestWithAuthentication, node: new SinergiaCRM() };
}

describe('SinergiaCRM.execute', () => {
	it('getAll returns only the requested page when returnAll is disabled', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getAll',
				returnAll: false,
				limit: 2,
				options: {},
			},
			responses: [{ data: [{ id: '1' }, { id: '2' }, { id: '3' }] }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: '1' } }, { json: { id: '2' } }]);
		expect(requestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(requestWithAuthentication.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/module/Accounts',
				qs: { 'page[size]': 2, 'page[number]': 1 },
				json: true,
			}),
		);
	});

	it('getAll paginates until the last page when returnAll is enabled', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getAll',
				returnAll: true,
				limit: 100,
				options: { pageSize: 2 },
			},
			responses: [{ data: [{ id: '1' }, { id: '2' }] }, { data: [{ id: '3' }] }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([
			{ json: { id: '1' } },
			{ json: { id: '2' } },
			{ json: { id: '3' } },
		]);
		expect(requestWithAuthentication).toHaveBeenCalledTimes(2);
		expect(requestWithAuthentication.mock.calls[0][1]).toEqual(
			expect.objectContaining({ qs: { 'page[size]': 2, 'page[number]': 1 } }),
		);
		expect(requestWithAuthentication.mock.calls[1][1]).toEqual(
			expect.objectContaining({ qs: { 'page[size]': 2, 'page[number]': 2 } }),
		);
	});

	it('getAll applies the configured filters to the query', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getAll',
				returnAll: false,
				limit: 5,
				options: {
					filters: { Filter: [{ field: 'name', operator: 'eq', value: 'ACME' }] },
				},
			},
			responses: [{ data: [] }],
		});

		await node.execute.call(context);

		expect(requestWithAuthentication.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				qs: { 'page[size]': 5, 'page[number]': 1, 'filter[name][EQ]': 'ACME' },
			}),
		);
	});

	it('getOne fetches a single record', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: { module: 'Accounts', operation: 'getOne', id: 'acc-1' },
			responses: [{ data: { id: 'acc-1', name: 'ACME' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'acc-1', name: 'ACME' } }]);
		expect(requestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-1',
				json: true,
			}),
		);
	});

	it('create sends a POST with the JSON:API body', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				data: { firstName: 'Ana', lastName: 'Perez' },
			},
			responses: [{ data: { id: 'c-1', type: 'Contacts' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'c-1', type: 'Contacts' } }]);
		expect(requestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'POST',
				url: 'https://crm.example.com/Api/V8/module',
				body: {
					data: {
						type: 'Contacts',
						attributes: { firstName: 'Ana', lastName: 'Perez' },
					},
				},
				json: true,
			}),
		);
	});

	it('update sends a PATCH with the record id in the body', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'update',
				id: 'c-1',
				data: { firstName: 'Ana Maria' },
			},
			responses: [{ data: { id: 'c-1' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'c-1' } }]);
		expect(requestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'PATCH',
				url: 'https://crm.example.com/Api/V8/module',
				body: {
					data: {
						type: 'Contacts',
						id: 'c-1',
						attributes: { firstName: 'Ana Maria' },
					},
				},
				json: true,
			}),
		);
	});

	it('delete removes the record and reports success', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: { module: 'Accounts', operation: 'delete', id: 'acc-9' },
			responses: [{ data: {} }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { success: true, id: 'acc-9' } }]);
		expect(requestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'DELETE',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-9',
				json: true,
			}),
		);
	});

	it('getRelationships fetches the related records', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getRelationships',
				id: 'acc-1',
				relationship: 'contacts',
			},
			responses: [{ data: [{ id: 'c-1' }] }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: [{ id: 'c-1' }] }]);
		expect(requestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-1/relationships/contacts',
				json: true,
			}),
		);
	});

	it('returns the error as output when continueOnFail is enabled', async () => {
		const { context, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getAll',
				returnAll: false,
				limit: 5,
				options: {},
			},
			continueOnFail: true,
			responses: [new Error('boom')],
		});

		const [result] = await node.execute.call(context);

		expect(result).toHaveLength(1);
		expect(result[0].json).toEqual({ error: 'boom' });
		expect(result[0].error).toBeInstanceOf(Error);
	});

	it('rethrows the error when continueOnFail is disabled', async () => {
		const { context, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getAll',
				returnAll: false,
				limit: 5,
				options: {},
			},
			continueOnFail: false,
			responses: [new Error('boom')],
		});

		await expect(node.execute.call(context)).rejects.toThrow('boom');
	});

	it('processes one item per input execution item', async () => {
		const { context, requestWithAuthentication, node } = createExecuteContext({
			items: [{ json: {} }, { json: {} }],
			params: {
				module: 'Accounts',
				operation: 'getOne',
				id: ['acc-1', 'acc-2'],
			},
			responses: [{ data: { id: 'acc-1' } }, { data: { id: 'acc-2' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toHaveLength(2);
		expect(result[0].json).toEqual({ id: 'acc-1' });
		expect(result[1].json).toEqual({ id: 'acc-2' });
		expect(requestWithAuthentication).toHaveBeenCalledTimes(2);
	});
});
