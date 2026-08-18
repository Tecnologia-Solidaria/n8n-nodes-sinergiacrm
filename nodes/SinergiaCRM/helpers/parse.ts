// helpers/parse.ts
import type { IDataObject } from 'n8n-workflow';

/**
 * Safely parses a string or object input into a valid JSON object.
 * Used for user-supplied input in operations like "create" or "update".
 *
 * Returns undefined if the input is invalid (caller handles error presentation).
 *
 * @param input - Input value from the node parameter (string or object)
 * @returns Parsed object, or undefined if invalid
 */
export function parseJsonInput(input: unknown): IDataObject | undefined {
	if (typeof input === 'string') {
		try {
			return JSON.parse(input);
		} catch {
			return undefined;
		}
	}
	if (typeof input === 'object' && input !== null) {
		return input as IDataObject;
	}
	return undefined;
}
