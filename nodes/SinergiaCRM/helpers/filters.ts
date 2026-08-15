// helpers/filters.ts
import type { IDataObject } from 'n8n-workflow';

export interface FilterEntry {
	field: string;
	customField?: string;
	operator?: string;
	value: unknown;
}

export interface FilterOptions {
	Filter?: FilterEntry[];
}

/**
 * Operators supported by the SuiteCRM v8 filter syntax.
 */
export const SUPPORTED_OPERATORS: Record<string, string> = {
	eq: 'EQ',
	neq: 'NEQ',
	gt: 'GT',
	gte: 'GTE',
	lt: 'LT',
	lte: 'LTE',
};

/**
 * Builds the query string filters for a record listing request.
 * Custom fields (`__custom__`) resolve to their trimmed custom field name.
 * Entries without a usable field name or value are skipped, as are unknown operators.
 *
 * @param options - The "Filters" options object from the node parameters
 * @returns Query parameters in the `filter[field][OPERATOR]=value` shape
 */
export function buildFilters(options: FilterOptions | undefined): IDataObject {
	const qs: IDataObject = {};
	if (!options?.Filter?.length) {
		return qs;
	}
	for (const filter of options.Filter) {
		const fieldName = filter.field === '__custom__' ? filter.customField?.trim() : filter.field;
		if (fieldName && filter.value) {
			const operator = SUPPORTED_OPERATORS[filter.operator || 'eq'];
			if (operator) {
				qs[`filter[${fieldName}][${operator}]`] = filter.value;
			}
		}
	}
	return qs;
}
