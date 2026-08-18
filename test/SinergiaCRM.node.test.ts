// test/SinergiaCRM.node.test.ts
import { describe, expect, it, vi } from 'vitest';
import { NodeApiError } from 'n8n-workflow';
import type { IExecuteFunctions, INodeExecutionData } from 'n8n-workflow';
import { SinergiaCRM } from '../nodes/SinergiaCRM/Sinergiacrm.node';

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

	const context = {
		getInputData: vi.fn().mockReturnValue(items),
		getNodeParameter: vi.fn().mockImplementation((name: string, index: number, defaultValue?: unknown) => {
			const value = params[name];
			const resolved = Array.isArray(value) ? value[index ?? 0] : value;
			return resolved !== undefined ? resolved : defaultValue;
		}),
		getCredentials: vi.fn().mockResolvedValue(credentials),
		getNode: vi.fn().mockReturnValue({ name: 'SinergiaCRM', type: 'sinergiacrm', typeVersion: 1 }),
		continueOnFail: vi.fn().mockReturnValue(overrides.continueOnFail ?? false),
		helpers: {
			httpRequestWithAuthentication,
		},
	} as unknown as IExecuteFunctions;

	return { context, httpRequestWithAuthentication, node: new SinergiaCRM() };
}

describe('SinergiaCRM.execute', () => {
	it('getAll returns only the requested page when returnAll is disabled', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
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

		expect(result).toEqual([{ json: { id: '1' }, pairedItem: { item: 0 } }, { json: { id: '2' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/module/Accounts',
				qs: { 'page[size]': 2, 'page[number]': 1 },
				json: true,
			}),
		);
	});

	it('getAll paginates until the last page when returnAll is enabled', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
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
			{ json: { id: '1' }, pairedItem: { item: 0 } },
			{ json: { id: '2' }, pairedItem: { item: 0 } },
			{ json: { id: '3' }, pairedItem: { item: 0 } },
		]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
		expect(httpRequestWithAuthentication.mock.calls[0][1]).toEqual(
			expect.objectContaining({ qs: { 'page[size]': 2, 'page[number]': 1 } }),
		);
		expect(httpRequestWithAuthentication.mock.calls[1][1]).toEqual(
			expect.objectContaining({ qs: { 'page[size]': 2, 'page[number]': 2 } }),
		);
	});

	it('getAll applies the configured filters to the query', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
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

		expect(httpRequestWithAuthentication.mock.calls[0][1]).toEqual(
			expect.objectContaining({
				qs: { 'page[size]': 5, 'page[number]': 1, 'filter[name][EQ]': 'ACME' },
			}),
		);
	});

	it('getOne fetches a single record', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: { module: 'Accounts', operation: 'getOne', id: 'acc-1' },
			responses: [{ data: { id: 'acc-1', name: 'ACME' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'acc-1', name: 'ACME' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-1',
				json: true,
			}),
		);
	});

	it('create sends a POST with the JSON:API body', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				data: { firstName: 'Ana', lastName: 'Perez' },
			},
			responses: [{ data: { id: 'c-1', type: 'Contacts' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'c-1', type: 'Contacts' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
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
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'update',
				id: 'c-1',
				data: { firstName: 'Ana Maria' },
			},
			responses: [{ data: { id: 'c-1' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'c-1' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
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
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: { module: 'Accounts', operation: 'delete', id: 'acc-9' },
			responses: [{ data: {} }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { deleted: true, id: 'acc-9' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'DELETE',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-9',
				json: true,
			}),
		);
	});

	it('getRelationships fetches the related records', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'getRelationships',
				id: 'acc-1',
				relationship: 'contacts',
			},
			responses: [{ data: [{ id: 'c-1' }] }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: [{ id: 'c-1' }], pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
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
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
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
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
	});

	it('create sends the attributes built from fields mode', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				dataMode: 'fields',
				fields: {
					Field: [
						{ field: 'firstName', value: 'Ana' },
						{ field: 'lastName', value: 'Perez' },
					],
				},
			},
			responses: [{ data: { id: 'c-1' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'c-1' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
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

	it('create resolves custom fields to their technical name in fields mode', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				dataMode: 'fields',
				fields: {
					Field: [{ field: '__custom__', customField: '  cstm_field_c ', value: 'x' }],
				},
			},
			responses: [{ data: { id: 'c-1' } }],
		});

		await node.execute.call(context);

		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				body: {
					data: {
						type: 'Contacts',
						attributes: { cstm_field_c: 'x' },
					},
				},
			}),
		);
	});

	it('update sends only the attributes built from fields mode', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'update',
				id: 'c-1',
				dataMode: 'fields',
				fields: { Field: [{ field: 'firstName', value: 'Ana Maria' }] },
			},
			responses: [{ data: { id: 'c-1' } }],
		});

		await node.execute.call(context);

		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
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

	it('create in rawJson mode accepts a JSON string', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				dataMode: 'rawJson',
				data: '{"firstName":"Ana","lastName":"Perez"}',
			},
			responses: [{ data: { id: 'c-1' } }],
		});

		await node.execute.call(context);

		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				body: {
					data: {
						type: 'Contacts',
						attributes: { firstName: 'Ana', lastName: 'Perez' },
					},
				},
			}),
		);
	});

	it('rejects invalid raw JSON and does not execute the operation', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				dataMode: 'rawJson',
				data: 'not json',
			},
		});

		await expect(node.execute.call(context)).rejects.toBeInstanceOf(NodeApiError);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('rejects create with an empty fields list and does not execute the operation', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				dataMode: 'fields',
				fields: {},
			},
		});

		await expect(node.execute.call(context)).rejects.toBeInstanceOf(NodeApiError);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('rejects fields mode with an empty value', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'create',
				dataMode: 'fields',
				fields: { Field: [{ field: 'firstName', value: '' }] },
			},
		});

		await expect(node.execute.call(context)).rejects.toBeInstanceOf(NodeApiError);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('linkRecord links an existing related record', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'linkRecord',
				recordId: 'acc-1',
				relationship: 'contacts',
				relatedModule: 'Contacts',
				relatedId: 'c-1',
			},
			responses: [{ data: [] }, { data: { id: 'c-1', type: 'Contacts' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { id: 'c-1', type: 'Contacts' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenNthCalledWith(
			1,
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-1/relationships/contacts',
				json: true,
			}),
		);
		expect(httpRequestWithAuthentication).toHaveBeenNthCalledWith(
			2,
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'POST',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-1/relationships/contacts',
				body: { data: { type: 'Contacts', id: 'c-1' } },
				json: true,
			}),
		);
	});

	it('linkRecord rejects a non-existent related record without modifying data', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'linkRecord',
				recordId: 'acc-1',
				relationship: 'contacts',
				relatedModule: 'Contacts',
				relatedId: 'missing',
			},
			responses: [{ data: [] }, Object.assign(new Error('not found'), { statusCode: 404 })],
		});

		const error = await node.execute.call(context).catch((e: unknown) => e);

		expect(error).toBeInstanceOf(NodeApiError);
		expect((error as Error).message).toContain('missing');
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(2);
	});

	it('linkRecord is idempotent when the relationship already exists', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'linkRecord',
				recordId: 'acc-1',
				relationship: 'contacts',
				relatedModule: 'Contacts',
				relatedId: 'c-1',
			},
			responses: [{ data: [{ id: 'c-1', type: 'Contacts' }] }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([
			{ json: { success: true, alreadyLinked: true, id: 'c-1', type: 'Contacts' }, pairedItem: { item: 0 } },
		]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it('linkRecord rejects linking a record to itself', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'linkRecord',
				recordId: 'c-1',
				relationship: 'accounts',
				relatedModule: 'Contacts',
				relatedId: 'c-1',
			},
		});

		await expect(node.execute.call(context)).rejects.toBeInstanceOf(NodeApiError);
		expect(httpRequestWithAuthentication).not.toHaveBeenCalled();
	});

	it('unlinkRecord unlinks a record via DELETE', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'unlinkRecord',
				recordId: 'acc-1',
				relationship: 'contacts',
				relatedId: 'c-1',
			},
			responses: [{ data: {} }],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { success: true, id: 'c-1' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'DELETE',
				url: 'https://crm.example.com/Api/V8/module/Accounts/acc-1/relationships/contacts/c-1',
				json: true,
			}),
		);
	});

	it('unlinkRecord reports clearly when the relationship does not exist', async () => {
		const { context, httpRequestWithAuthentication, node } = createExecuteContext({
			params: {
				module: 'Accounts',
				operation: 'unlinkRecord',
				recordId: 'acc-1',
				relationship: 'contacts',
				relatedId: 'c-1',
			},
			responses: [Object.assign(new Error('not found'), { statusCode: 404 })],
		});

		const [result] = await node.execute.call(context);

		expect(result).toEqual([{ json: { success: true, alreadyUnlinked: true, id: 'c-1' }, pairedItem: { item: 0 } }]);
		expect(httpRequestWithAuthentication).toHaveBeenCalledTimes(1);
	});

	it('simplify returns only common fields when enabled', async () => {
		const { context, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'getOne',
				id: 'c-1',
				simplify: true,
			},
			responses: [{ data: { id: 'c-1', first_name: 'Ana', last_name: 'Perez', email1: 'ana@test.com', phone_work: '123', custom_field: 'ignored', another_custom: 42 } }],
		});

		const [result] = await node.execute.call(context);

		expect(result[0].json).toEqual({
			id: 'c-1',
			first_name: 'Ana',
			last_name: 'Perez',
			email1: 'ana@test.com',
			phone_work: '123',
		});
	});

	it('simplify returns raw data when disabled', async () => {
		const { context, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'getOne',
				id: 'c-1',
				simplify: false,
			},
			responses: [{ data: { id: 'c-1', first_name: 'Ana', custom_field: 'kept' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result[0].json).toEqual({ id: 'c-1', first_name: 'Ana', custom_field: 'kept' });
	});

	it('simplify defaults to true when not specified', async () => {
		const { context, node } = createExecuteContext({
			params: {
				module: 'Contacts',
				operation: 'getOne',
				id: 'c-1',
			},
			responses: [{ data: { id: 'c-1', first_name: 'Ana', obscure_field: 'x' } }],
		});

		const [result] = await node.execute.call(context);

		expect(result[0].json).toEqual({ id: 'c-1', first_name: 'Ana' });
	});
});

describe('SinergiaCRM — herramienta de agentes (US5)', () => {
	it('expone el nodo principal como usable como herramienta', () => {
		const node = new SinergiaCRM();
		expect(node.description.usableAsTool).toBe(true);
	});

	it('ofrece una descripción de herramienta en inglés y no vacía', () => {
		const node = new SinergiaCRM();
		expect(node.description.description.length).toBeGreaterThan(0);
		expect(node.description.description).toMatch(/^[a-zA-Z0-9 ,.:()'/-]+$/);
	});
});
