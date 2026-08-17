// methods.loadOptions.ts
import type { ILoadOptionsFunctions } from 'n8n-workflow';

interface ModuleMetaResponse {
	data?: {
		attributes?: Record<string, { label?: string }>;
	};
}

interface RelationshipsResponse {
	data?: {
		relationships?: Record<string, { links?: { related?: string } }>;
	};
}

/**
 * Load available modules from SinergiaCRM (SinergiaCRM API).
 * Uses OAuth2 client_credentials handled by n8n.
 */
export async function getModules(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');
	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');
	const url = `${domainUrl}/Api/V8/meta/modules`;

	const response = (await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url,
			json: true,
		},
	)) as ModuleMetaResponse;

	const modulesObject = response.data?.attributes || {};
	return Object.entries(modulesObject).map(([key, value]) => ({
		name: value.label || key,
		value: key,
	}));
}

/**
 * Load fields of the selected module.
 * Supports both standard and custom fields.
 */
export async function getModuleFields(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');
	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');
	const module = this.getCurrentNodeParameter('module') as string;

	if (!module) return [];

	const url = `${domainUrl}/Api/V8/meta/fields/${module}`;

	const response = (await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url,
			json: true,
		},
	)) as ModuleMetaResponse;

	const fields = response.data?.attributes || {};
	const fieldOptions = Object.entries(fields).map(([key, value]) => ({
		name: value.label || key,
		value: key,
	}));

	// Add "Custom..." option for user-defined fields
	fieldOptions.push({
		name: 'Custom...',
		value: '__custom__',
	});

	return fieldOptions;
}

/**
 * Load available relationships for a given record in a module.
 */
export async function getAvailableRelationships(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');
	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');
	const module = this.getCurrentNodeParameter('module') as string;
	const recordId = (this.getCurrentNodeParameter('recordId') ?? this.getCurrentNodeParameter('id')) as string;

	if (!module || !recordId) return [];

	const url = `${domainUrl}/Api/V8/module/${module}/${recordId}`;

	const response = (await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url,
			json: true,
		},
	)) as RelationshipsResponse;

	const relationshipsObj = response.data?.relationships || {};
	const relOptions: { name: string; value: string }[] = [];

	for (const [relKey, relValue] of Object.entries(relationshipsObj)) {
		if (typeof relValue === 'object' && relValue !== null) {
			const relatedLink = relValue.links?.related;
			if (relatedLink) {
				relOptions.push({
					name: relKey,
					value: relatedLink.split('/').pop() ?? '',
				});
			}
		}
	}

	return relOptions;
}
