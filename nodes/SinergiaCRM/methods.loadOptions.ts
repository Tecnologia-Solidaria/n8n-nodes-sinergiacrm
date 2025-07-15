import type { ILoadOptionsFunctions } from 'n8n-workflow';

export async function getModules(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');

	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');

	const apiUrl = `${domainUrl}/Api`; // <-- AÑADIMOS /Api SIEMPRE AQUÍ

	const clientId = credentials.clientId as string;
	const clientSecret = credentials.clientSecret as string;

	const params = {
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret,
	};
	const body = new URLSearchParams(params).toString();


	const tokenResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: `${apiUrl}/access_token`,
		body,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		json: true,
	});

	if (!tokenResponse.access_token) {
		throw new Error('Could not obtain SinergiaCRM access_token');
	}

	const modulesResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: `${apiUrl}/V8/meta/modules`,
		headers: {
			Authorization: `Bearer ${tokenResponse.access_token}`,
		},
		json: true,
	});

	const modulesObject = modulesResponse.data?.attributes || {};
	const modulesArray = Object.entries(modulesObject).map(([key, value]: [string, any]) => ({
		name: value.label || key,
		value: key,
	}));

	return modulesArray;
}

export async function getModuleFields(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');

	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');

	const apiUrl = `${domainUrl}/Api`; // <-- AÑADIMOS /Api

	const clientId = credentials.clientId as string;
	const clientSecret = credentials.clientSecret as string;

	const module = this.getCurrentNodeParameter('module') as string;
	if (!module || typeof module !== 'string' || !module.trim()) {
		return [];
	}

	const params = {
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret,
	};
	const body = new URLSearchParams(params).toString();


	const tokenResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: `${apiUrl}/access_token`,
		body,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		json: true,
	});

	if (!tokenResponse.access_token) {
		throw new Error('Could not obtain SinergiaCRM access_token');
	}

	const fieldsResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: `${apiUrl}/V8/meta/fields/${module}`,
		headers: {
			Authorization: `Bearer ${tokenResponse.access_token}`,
		},
		json: true,
	});

	const fields = fieldsResponse.data?.attributes || {};
	const fieldOptions = Object.entries(fields).map(([key, value]: [string, any]) => ({
		name: value.label || key,
		value: key,
	}));

	fieldOptions.push({
		name: 'Custom...',
		value: '__custom__',
	});

	return fieldOptions;
}

export async function getAvailableRelationships(this: ILoadOptionsFunctions) {
	const credentials = await this.getCredentials('SinergiaCRMCredentials');

	const domainUrl = (credentials.domainUrl as string).replace(/\/$/, '');

	const apiUrl = `${domainUrl}/Api`; // <-- AÑADIMOS /Api

	const clientId = credentials.clientId as string;
	const clientSecret = credentials.clientSecret as string;

	const module = this.getCurrentNodeParameter('module') as string;
	const recordId = this.getCurrentNodeParameter('id') as string;

	if (!module || !recordId) {
		return [];
	}

	const params = {
		grant_type: 'client_credentials',
		client_id: clientId,
		client_secret: clientSecret,
	};
	const body = new URLSearchParams(params).toString();


	const tokenResponse = await this.helpers.httpRequest({
		method: 'POST',
		url: `${apiUrl}/access_token`,
		body,
		headers: {
			'Content-Type': 'application/x-www-form-urlencoded',
		},
		json: true,
	});

	if (!tokenResponse.access_token) {
		throw new Error('Could not obtain SinergiaCRM access_token');
	}

	const recordResponse = await this.helpers.httpRequest({
		method: 'GET',
		url: `${apiUrl}/V8/module/${module}/${recordId}`,
		headers: {
			Authorization: `Bearer ${tokenResponse.access_token}`,
		},
		json: true,
	});

	const relationshipsObj = recordResponse.data?.relationships || {};
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
