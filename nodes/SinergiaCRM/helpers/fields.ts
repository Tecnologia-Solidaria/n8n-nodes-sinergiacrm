// helpers/fields.ts
import type { IDataObject } from 'n8n-workflow';

export interface FieldEntry {
	field: string;
	customField?: string;
	value: unknown;
}

export interface FieldOptions {
	Field?: FieldEntry[];
}

/**
 * Resolves the technical field name of an entry.
 * Custom fields (`__custom__`) resolve to their trimmed custom field name.
 */
export function resolveFieldName(entry: FieldEntry): string {
	return entry.field === '__custom__' ? (entry.customField ?? '').trim() : entry.field;
}

/**
 * A value is considered empty when it would not send any data to the CRM.
 * Zero and false are usable values; undefined, null and empty strings are not.
 */
export function isEmptyValue(value: unknown): boolean {
	return value === undefined || value === null || value === '';
}

/**
 * Builds the JSON:API `attributes` object from the "fields" node parameter.
 * Rows without a usable field name are skipped.
 *
 * @param fields - The "Fields" fixedCollection value from the node parameters
 * @returns The record attributes map
 */
export function buildAttributes(fields: FieldOptions | undefined): IDataObject {
	const attributes: Record<string, unknown> = {};
	if (!fields?.Field) {
		return attributes as IDataObject;
	}
	for (const entry of fields.Field) {
		const fieldName = resolveFieldName(entry);
		if (fieldName) {
			attributes[fieldName] = entry.value;
		}
	}
	return attributes as IDataObject;
}
