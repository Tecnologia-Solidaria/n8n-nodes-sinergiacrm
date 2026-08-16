import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import type { IDataObject, NodeApiError } from 'n8n-workflow';
import type { FilterOptions } from './helpers/filters';

import * as methods from './methods.loadOptions';
import { genericModuleOperations } from './operations/GenericModule.operations';
import { parseJsonInput } from './helpers/parse';
import { buildListQuery, resolvePageSize, shouldFetchNextPage } from './helpers/query';
import { buildCreateBody, buildUpdateBody } from './helpers/record';

interface GetAllOptions {
	pageSize?: number;
	filters?: FilterOptions;
}

interface SuiteCRMListResponse {
	data?: IDataObject[];
}

interface SuiteCRMRecordResponse {
	data?: IDataObject;
}

/**
 * n8n node for interacting with any module of SinergiaCRM (SuiteCRM API).
 * Supports CRUD operations, relationship fetching, pagination and filters.
 */
export class SinergiaCRM implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SinergiaCRM',
		name: 'sinergiaCrm',
		icon: 'file:sinergiacrm.svg',
		group: ['transform'],
		version: 1,
		description: 'Perform operations on any module in SinergiaCRM (SuiteCRM API).',
		defaults: {
			name: 'SinergiaCRM',
		},
		inputs: [NodeConnectionType.Main],
		outputs: [NodeConnectionType.Main],
		credentials: [
			{
				name: 'SinergiaCRMCredentials',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Module',
				name: 'module',
				type: 'options',
				required: true,
				default: '',
				description: 'Select a module from SinergiaCRM',
				typeOptions: {
					loadOptionsMethod: 'getModules',
				},
				noDataExpression: true,
			},
			...genericModuleOperations,
			{
				displayName: 'Return All',
				name: 'returnAll',
				type: 'boolean',
				default: false,
				description: 'Fetch all records using auto-pagination',
				displayOptions: {
					show: {
						operation: ['getAll'],
					},
				},
			},
			{
				displayName: 'Limit',
				name: 'limit',
				type: 'number',
				default: 100,
				description: 'Maximum number of records to return when Return All is disabled',
				displayOptions: {
					show: {
						operation: ['getAll'],
						returnAll: [false],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: methods,
	};

	async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
		const items = this.getInputData();
		const returnData: INodeExecutionData[] = [];

		const moduleName = this.getNodeParameter('module', 0) as string;
		const operation = this.getNodeParameter('operation', 0) as string;

		// Normalize credentials base URL (ensure no trailing slash)
		const credentials = await this.getCredentials('SinergiaCRMCredentials');
		const baseUrl = (credentials.domainUrl as string).replace(/\/$/, '');
		const url = `${baseUrl}/Api/V8/module`;

		for (let i = 0; i < items.length; i++) {
			try {
				// GET ALL records
				if (operation === 'getAll') {
					const returnAll = this.getNodeParameter('returnAll', i, false) as boolean;
					const limit = this.getNodeParameter('limit', i, 100) as number;
					const options = this.getNodeParameter('options', i, {}) as GetAllOptions;

					let collected: IDataObject[] = [];
					let pageNumber = 1;

					const pageSize = resolvePageSize(returnAll, limit, options);

					do {
						const qs = buildListQuery({
							pageSize,
							pageNumber,
							filters: options?.filters,
						});

						const data = (await this.helpers.requestWithAuthentication.call(
							this,
							'SinergiaCRMCredentials',
							{
								method: 'GET',
								url: `${url}/${moduleName}`,
								qs,
								json: true,
							},
						)) as SuiteCRMListResponse;

						const records = data.data || [];
						collected.push(...records);

						if (
							!shouldFetchNextPage({
								returnAll,
								recordsLength: records.length,
								pageSize,
								limit,
								collectedLength: collected.length,
							})
						) {
							break;
						}
						pageNumber++;
					} while (true);

					const sliced = returnAll ? collected : collected.slice(0, limit);
					for (const record of sliced) {
						returnData.push({ json: record });
					}

				// GET ONE record by ID
				} else if (operation === 'getOne') {
					const id = this.getNodeParameter('id', i) as string;
					const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'GET',
						url: `${url}/${moduleName}/${id}`,
						json: true,
					})) as SuiteCRMRecordResponse;
					returnData.push({ json: response.data ?? {} });

				// CREATE record
				} else if (operation === 'create') {
					const attributes = parseJsonInput(this.getNodeParameter('data', i));
					const body = buildCreateBody(moduleName, attributes);
					const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'POST',
						url,
						body,
						json: true,
					})) as SuiteCRMRecordResponse;
					returnData.push({ json: response.data ?? {} });

				// UPDATE record
				} else if (operation === 'update') {
					const id = this.getNodeParameter('id', i) as string;
					const attributes = parseJsonInput(this.getNodeParameter('data', i));
					const body = buildUpdateBody(moduleName, id, attributes);
					const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'PATCH',
						url,
						body,
						json: true,
					})) as SuiteCRMRecordResponse;
					returnData.push({ json: response.data ?? {} });

				// DELETE record
				} else if (operation === 'delete') {
					const id = this.getNodeParameter('id', i) as string;
					await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'DELETE',
						url: `${url}/${moduleName}/${id}`,
						json: true,
					});
					returnData.push({ json: { success: true, id } });

				// GET RELATIONSHIPS of a record
				} else if (operation === 'getRelationships') {
					const id = this.getNodeParameter('id', i) as string;
					const relationship = this.getNodeParameter('relationship', i) as string;
					const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'GET',
						url: `${url}/${moduleName}/${id}/relationships/${relationship}`,
						json: true,
					})) as SuiteCRMRecordResponse;
					returnData.push({ json: response.data ?? {} });
				}
			} catch (error) {
				if (this.continueOnFail()) {
					const message = error instanceof Error ? error.message : String(error);
					returnData.push({
						json: { error: message },
						error: error as NodeApiError,
					});
					continue;
				}
				throw error;
			}
		}

		return [returnData];
	}
}
