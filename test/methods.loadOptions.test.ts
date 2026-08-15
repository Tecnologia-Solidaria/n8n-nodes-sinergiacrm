// test/methods.loadOptions.test.ts
import { describe, expect, it, vi } from 'vitest';
import type { ILoadOptionsFunctions } from 'n8n-workflow';
import {
	getAvailableRelationships,
	getModuleFields,
	getModules,
} from '../nodes/SinergiaCRM/methods.loadOptions';

interface ContextOverrides {
	credentials?: { domainUrl: string };
	params?: Record<string, unknown>;
	response?: unknown;
}

function createContext(overrides: ContextOverrides = {}) {
	const credentials = overrides.credentials ?? { domainUrl: 'https://crm.example.com/' };
	const params = overrides.params ?? {};
	const response = overrides.response ?? { data: {} };

	const requestWithAuthentication = vi.fn().mockResolvedValue(response);

	const context = {
		getCredentials: vi.fn().mockResolvedValue(credentials),
		getCurrentNodeParameter: vi.fn().mockImplementation((name: string) => params[name]),
		helpers: {
			requestWithAuthentication,
		},
	} as unknown as ILoadOptionsFunctions;

	return { context, requestWithAuthentication };
}

describe('getModules', () => {
	it('returns module options mapped from the API attributes', async () => {
		const { context, requestWithAuthentication } = createContext({
			response: {
				data: {
					attributes: {
						Accounts: { label: 'Accounts' },
						Contacts: { label: 'Contacts' },
					},
				},
			},
		});

		const result = await getModules.call(context);

		expect(result).toEqual([
			{ name: 'Accounts', value: 'Accounts' },
			{ name: 'Contacts', value: 'Contacts' },
		]);
		expect(requestWithAuthentication).toHaveBeenCalledWith(
			'SinergiaCRMCredentials',
			expect.objectContaining({
				method: 'GET',
				url: 'https://crm.example.com/Api/V8/meta/modules',
				json: true,
			}),
		);
	});

	it('strips a trailing slash from the configured domain URL', async () => {
		const { context, requestWithAuthentication } = createContext({
			credentials: { domainUrl: 'https://crm.example.com/' },
		});

		await getModules.call(context);

		const [, requestOptions] = requestWithAuthentication.mock.calls[0] as [string, { url: string }];
		expect(requestOptions.url).toBe('https://crm.example.com/Api/V8/meta/modules');
	});
});

describe('getModuleFields', () => {
	it('returns the module fields plus the "Custom..." option', async () => {
		const { context } = createContext({
			params: { module: 'Accounts' },
			response: {
				data: {
					attributes: {
						name: { label: 'Name' },
						account_type: { label: 'Account Type' },
					},
				},
			},
		});

		const result = await getModuleFields.call(context);

		expect(result).toEqual([
			{ name: 'Name', value: 'name' },
			{ name: 'Account Type', value: 'account_type' },
			{ name: 'Custom...', value: '__custom__' },
		]);
	});

	it('returns an empty list when no module is selected', async () => {
		const { context } = createContext({ params: {} });

		expect(await getModuleFields.call(context)).toEqual([]);
	});
});

describe('getAvailableRelationships', () => {
	const relationships = {
		contacts: {
			links: { related: 'https://crm.example.com/Api/V8/module/Contacts/rel-123' },
		},
		unlinked: { links: {} },
	};

	it('returns relationships that expose a related link', async () => {
		const { context } = createContext({
			params: { module: 'Accounts', id: 'acc-1' },
			response: { data: { relationships } },
		});

		const result = await getAvailableRelationships.call(context);

		expect(result).toEqual([{ name: 'contacts', value: 'rel-123' }]);
	});

	it('returns an empty list when module or id is missing', async () => {
		const { context } = createContext({ params: { module: 'Accounts' } });

		expect(await getAvailableRelationships.call(context)).toEqual([]);
	});
});
