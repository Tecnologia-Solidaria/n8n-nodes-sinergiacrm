// helpers/record.ts
import type { IDataObject } from 'n8n-workflow';

/**
 * Builds the JSON:API request body for creating a record.
 */
export function buildCreateBody(module: string, attributes: IDataObject): IDataObject {
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
export function buildUpdateBody(module: string, id: string, attributes: IDataObject): IDataObject {
	return {
		data: {
			type: module,
			id,
			attributes,
		},
	};
}
