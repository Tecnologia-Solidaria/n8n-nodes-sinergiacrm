// helpers/parse.ts
import type { IDataObject } from 'n8n-workflow';

/**
 * Safely parses a string or object input into a valid JSON object.
 * Used for user-supplied input in operations like "create" or "update".
 *
 * @param input - Input value from the node parameter (string or object)
 * @returns Parsed object
 * @throws If the input is not a valid JSON object or string
 */
export function parseJsonInput(input: unknown): IDataObject {
	if (typeof input === 'string') {
		try {
			return JSON.parse(input);
		} catch {
			throw new Error('SinergiaCRM: The "Data" field must be a valid JSON string or object.');
		}
	}
	if (typeof input === 'object' && input !== null) {
		return input as IDataObject;
	}
	throw new Error('SinergiaCRM: The "Data" field must be a valid JSON object or string.');
}
