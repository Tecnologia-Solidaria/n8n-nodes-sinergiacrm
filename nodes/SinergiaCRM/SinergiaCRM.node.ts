import type {
	IExecuteFunctions,
	INodeExecutionData,
	INodeType,
	INodeTypeDescription,
} from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';
import type { IDataObject, NodeApiError } from 'n8n-workflow';
import type { FilterOptions } from './helpers/filters';
import { simplifyRecord } from './helpers/simplify';
import type { SinergiaCRMListResponse, SinergiaCRMRecordResponse } from './helpers/types';

import * as methods from './methods.loadOptions';
import {
	createRecord,
	genericModuleOperations,
	linkRecord,
	unlinkRecord,
	updateRecord,
} from './operations/GenericModule.operations';
import { buildListQuery, resolvePageSize, shouldFetchNextPage } from './helpers/query';

interface GetAllOptions {
	pageSize?: number;
	filters?: FilterOptions;
}

/**
 * n8n node for interacting with any module of SinergiaCRM (SinergiaCRM API).
 * Supports CRUD operations, relationship fetching, pagination and filters.
 */
export class SinergiaCRM implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SinergiaCRM',
		name: 'sinergiacrm',
		icon: 'file:sinergiacrm.svg',
		group: ['transform'],
		version: 1,
		description: 'Create, update, read, link or unlink records in SinergiaCRM.',
		usableAsTool: true,
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
				default: '={{ $fromAI("limit", "Maximum number of records to return", "number", 100) }}',
				description: 'Maximum number of records to return when Return All is disabled',
				displayOptions: {
					show: {
						operation: ['getAll'],
						returnAll: [false],
					},
				},
			},
			{
				displayName: 'Simplify',
				name: 'simplify',
				type: 'boolean',
				default: true,
				description: 'Whether to return a simplified version of the response instead of the raw data',
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
		const simplify = this.getNodeParameter('simplify', 0, true) as boolean;

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
						)) as SinergiaCRMListResponse;

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
						returnData.push({ json: simplify ? simplifyRecord(record) : record });
					}

				// GET ONE record by ID
				} else if (operation === 'getOne') {
					const id = this.getNodeParameter('id', i) as string;
					const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'GET',
						url: `${url}/${moduleName}/${id}`,
						json: true,
					})) as SinergiaCRMRecordResponse;
					const data = response.data ?? {};
					returnData.push({ json: simplify ? simplifyRecord(data) : data });

				// CREATE record
				} else if (operation === 'create') {
					const responseData = await createRecord.call(this, moduleName, url, i);
					returnData.push({ json: responseData });

				// UPDATE record
				} else if (operation === 'update') {
					const responseData = await updateRecord.call(this, moduleName, url, i);
					returnData.push({ json: responseData });

				// LINK an existing record to another
				} else if (operation === 'linkRecord') {
					const responseData = await linkRecord.call(this, moduleName, url, i);
					returnData.push({ json: responseData });

				// UNLINK a record
				} else if (operation === 'unlinkRecord') {
					const responseData = await unlinkRecord.call(this, moduleName, url, i);
					returnData.push({ json: responseData });

				// DELETE record
				} else if (operation === 'delete') {
					const id = this.getNodeParameter('id', i) as string;
					await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'DELETE',
						url: `${url}/${moduleName}/${id}`,
						json: true,
					});
					returnData.push({ json: { deleted: true, id } });

				// GET RELATIONSHIPS of a record
				} else if (operation === 'getRelationships') {
					const id = this.getNodeParameter('id', i) as string;
					const relationship = this.getNodeParameter('relationship', i) as string;
					const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
						method: 'GET',
						url: `${url}/${moduleName}/${id}/relationships/${relationship}`,
						json: true,
					})) as SinergiaCRMRecordResponse;
					const data = response.data ?? {};
					returnData.push({ json: simplify ? simplifyRecord(data) : data });
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
