// helpers/query.ts
import type { IDataObject } from 'n8n-workflow';
import { buildFilters, type FilterOptions } from './filters';

/**
 * Resolves the page size for a record listing request.
 * With `returnAll`, uses the configured page size (20 by default) to walk
 * the pagination; otherwise the limit is the size of the single page.
 */
export function resolvePageSize(
	returnAll: boolean,
	limit: number,
	options?: { pageSize?: number },
): number {
	return returnAll ? (options?.pageSize || 20) : limit;
}

/**
 * Builds the query parameters for a record listing request
 * (pagination plus filters).
 */
export function buildListQuery(params: {
	pageSize: number;
	pageNumber: number;
	filters?: FilterOptions;
}): IDataObject {
	return {
		'page[size]': params.pageSize,
		'page[number]': params.pageNumber,
		...buildFilters(params.filters),
	};
}

/**
 * Decides whether a listing request needs to fetch another page.
 */
export function shouldFetchNextPage(params: {
	returnAll: boolean;
	recordsLength: number;
	pageSize: number;
	limit: number;
	collectedLength: number;
}): boolean {
	return (
		params.returnAll &&
		params.recordsLength >= params.pageSize &&
		params.collectedLength < params.limit
	);
}
