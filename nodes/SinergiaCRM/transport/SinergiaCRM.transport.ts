// transport/SinergiaCRM.transport.ts

import type {
	IExecuteFunctions,
	IHttpRequestOptions,
	IDataObject,
	IHttpRequestMethods,
} from 'n8n-workflow';

/**
 * Make an authenticated HTTP request to the SinergiaCRM API.
 *
 * This helper uses n8n's built-in OAuth2 credential system to authenticate using
 * the "SinergiaCRMCredentials" credential type.
 *
 * @param this - n8n execution context
 * @param method - HTTP method (e.g. GET, POST, PATCH)
 * @param endpoint - Full or relative endpoint URL to call (e.g. /Api/V8/module/Contacts)
 * @param body - Request body as a plain object
 * @param qs - Query string parameters as a plain object
 * @param headers - Optional custom headers
 * @returns Parsed JSON response
 * @throws Formatted error if the request fails
 */
export async function sinergiaCrmApiRequest(
	this: IExecuteFunctions,
	method: IHttpRequestMethods,
	endpoint: string,
	body: IDataObject = {},
	qs: IDataObject = {},
	headers: IDataObject = {},
): Promise<any> {
	const options: IHttpRequestOptions = {
		method,
		url: endpoint,
		body: Object.keys(body).length ? body : undefined,
		qs: Object.keys(qs).length ? qs : undefined,
		headers: {
			'Content-Type': 'application/json',
			...headers,
		},
	};

	try {
		return await this.helpers.httpRequestWithAuthentication.call(
			this,
			'SinergiaCRMCredentials',
			options,
		);
	} catch (error: any) {
		throw new Error(`Request failed [${method} ${endpoint}]: ${error.message}`);
	}
}
