// credentials/SinergiaCRMCredentials.credentials.ts
//
// SinergiaCRM (SuiteCRM) OAuth2 credentials for n8n
// --------------------------------------------------
// This credential uses OAuth2 Client Credentials flow.
// We enforce form-encoded token requests and send client_id/client_secret in the body,
// matching SuiteCRM expectations for /Api/access_token.
//
// NOTE: The credential "test" is intentionally minimal (GET to Domain URL)
// to avoid 405 issues on protected endpoints, as requested.

import { ICredentialType, INodeProperties, ICredentialTestRequest } from 'n8n-workflow';

export class SinergiaCRMCredentials implements ICredentialType {
	// Internal credential identifier
	name = 'SinergiaCRMCredentials';

	// Shown in the credentials UI
	displayName = 'SinergiaCRM API';

	// External docs
	documentationUrl = 'https://docs.suitecrm.com/developer/api/developer-setup-guide/json-api/';

	// Inherit n8n's built-in OAuth2 behavior
	extends = ['oAuth2Api'];

	// Fields shown to the user
	properties: INodeProperties[] = [
		{
			displayName: 'Domain URL',
			name: 'domainUrl',
			type: 'string',
			default: '',
			required: true,
			description: 'Base URL of your SinergiaCRM instance (e.g. https://yourdomain.com) without trailing slash.',
			placeholder: 'https://yourdomain.com',
		},
		{
			displayName: 'Client ID',
			name: 'clientId',
			type: 'string',
			default: '',
			required: true,
			description: 'OAuth2 Client ID from SuiteCRM (Admin → OAuth2 Clients).',
		},
		{
			displayName: 'Client Secret',
			name: 'clientSecret',
			type: 'string',
			typeOptions: { password: true },
			default: '',
			required: true,
			description: 'OAuth2 Client Secret associated with the Client ID.',
		},
		// SuiteCRM does not require "scope" for client_credentials; leave it empty.
	];

	/**
	 * OAuth2 configuration (declarative):
	 * - type: 'oauth2' → n8n handles token storage/refresh.
	 * - grantType: 'client_credentials' → machine-to-machine.
	 * - clientAuthentication: 'body' → send client_id & client_secret in the request body (NOT Basic).
	 * - tokenRequestContentType: 'form' → application/x-www-form-urlencoded body (NOT JSON).
	 * - accessTokenUrl: derived from domainUrl.
	 */
	// The typed `ICredentialType['authenticate']` only covers the `generic` auth type,
	// but the runtime OAuth2 extension consumes this `oauth2` shape, which n8n
	// validates at runtime. We cast the value and keep the runtime object unchanged.
	authenticate = {
		type: 'oauth2',
		properties: {
			tokenType: 'Bearer',
			grantType: 'client_credentials',
			clientAuthentication: 'body',          // ensure credentials go in the body
			tokenRequestContentType: 'form',       // send as application/x-www-form-urlencoded
			accessTokenUrl: '={{$credentials.domainUrl}}/Api/access_token',
			// Some SuiteCRM installations require lowercase /api instead of /Api. If authentication fails, try adjusting accordingly.
		},
	} as unknown as ICredentialType['authenticate'];

	/**
	 * Credential "test" request:
	 * n8n performs this AFTER obtaining a token, but we keep it minimal to avoid
	 * methods/endpoints that may return 405 in some deployments.
	 */
	// CHANGED: Minimal test endpoint (domain root) to avoid 405 on protected endpoints.
	test: ICredentialTestRequest = {
		request: {
			method: 'GET',
			url: '={{$credentials.domainUrl}}', // CHANGED: use domain root; avoids 405 on protected endpoints
		},
	};
}
