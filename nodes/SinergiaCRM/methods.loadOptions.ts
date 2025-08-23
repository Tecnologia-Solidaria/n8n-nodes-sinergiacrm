import type { ILoadOptionsFunctions } from 'n8n-workflow';

/**
 * Load available modules from SinergiaCRM (SuiteCRM API).
 * Uses OAuth2 client_credentials handled by n8n.
 */
export async function getModules(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');
	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');
	const url = `${domainUrl}/Api/V8/meta/modules`;

	const response = await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url,
			json: true,
		},
	);

	const modulesObject = response.data?.attributes || {};
	return Object.entries(modulesObject).map(([key, value]: [string, any]) => ({
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

	const response = await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url,
			json: true,
		},
	);

	const fields = response.data?.attributes || {};
	const fieldOptions = Object.entries(fields).map(([key, value]: [string, any]) => ({
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
	const recordId = this.getCurrentNodeParameter('id') as string;

	if (!module || !recordId) return [];

	const url = `${domainUrl}/Api/V8/module/${module}/${recordId}`;

	const response = await this.helpers.requestWithAuthentication.call(
		this,
		'SinergiaCRMCredentials',
		{
			method: 'GET',
			url,
			json: true,
		},
	);

	const relationshipsObj = response.data?.relationships || {};
	const relOptions: { name: string; value: string }[] = [];

	for (const [relKey, relValue] of Object.entries(relationshipsObj)) {
		if (
			typeof relValue === 'object' &&
			relValue !== null &&
			'related' in ((relValue as any).links || {})
		) {
			const relatedLink = (relValue as any).links.related;
			if (relatedLink) {
				const value = relatedLink.split('/').pop();
				relOptions.push({
					name: relKey,
					value: value,
				});
			}
		}
	}

	return relOptions;
}
