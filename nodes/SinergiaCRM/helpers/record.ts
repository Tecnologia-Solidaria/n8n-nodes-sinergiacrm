// helpers/record.ts
import type { IDataObject } from 'n8n-workflow';
import type { SinergiaCRMCreatePayload, SinergiaCRMLinkRequest, SinergiaCRMUpdatePayload } from './types';

/**
 * Builds the JSON:API request body for creating a record.
 */
export function buildCreateBody(module: string, attributes: IDataObject): SinergiaCRMCreatePayload {
	return {
		data: {
			type: module,
			attributes,
		},
	};
}

/**
 * Builds the JSON:API request body for updating a record.
 */
export function buildUpdateBody(
	module: string,
	id: string,
	attributes: IDataObject,
): SinergiaCRMUpdatePayload {
	return {
		data: {
			type: module,
			id,
			attributes,
		},
	};
}

/**
 * Builds the JSON:API request body for linking an existing related record.
 */
export function buildLinkBody(relatedModule: string, relatedId: string): SinergiaCRMLinkRequest {
	return {
		data: {
			type: relatedModule,
			id: relatedId,
		},
	};
}
