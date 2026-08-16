// nodes/SinergiaCRM/operations/GenericModule.operations.ts
import { NodeOperationError } from 'n8n-workflow';
import type { IDataObject, IExecuteFunctions, INodeProperties } from 'n8n-workflow';
import {
	buildAttributes,
	isEmptyValue,
	resolveFieldName,
	type FieldOptions,
} from '../helpers/fields';
import { parseJsonInput } from '../helpers/parse';
import { buildCreateBody, buildLinkBody, buildUpdateBody } from '../helpers/record';
import type {
	SuiteCRMLinkResponse,
	SuiteCRMListResponse,
	SuiteCRMRecordResponse,
} from '../helpers/types';

/**
 * Generic CRUD operations and relationships for any SuiteCRM module.
 * - "Operation" exposes all main CRUD plus relationship get/link.
 * - Options support pagination and dynamic filters.
 */
export const genericModuleOperations: INodeProperties[] = [
	{
		displayName: 'Operation',
		name: 'operation',
		type: 'options',
		noDataExpression: true,
		default: 'getAll',
		options: [
			{
				name: 'Get All',
				value: 'getAll',
				action: 'Get all records',
			},
			{
				name: 'Get One',
				value: 'getOne',
				action: 'Get a single record',
			},
			{
				name: 'Create',
				value: 'create',
				action: 'Create a new record',
			},
			{
				name: 'Update',
				value: 'update',
				action: 'Update a record',
			},
			{
				name: 'Delete',
				value: 'delete',
				action: 'Delete a record',
			},
			{
				name: 'Get Relationships',
				value: 'getRelationships',
				action: 'Get related records',
			},
			{
				name: 'Link Record',
				value: 'linkRecord',
				action: 'Link an existing record',
			},
			{
				name: 'Unlink Record',
				value: 'unlinkRecord',
				action: 'Unlink a record',
			},
		],
	},

	// Options collection for pagination and filters
	{
		displayName: 'Options',
		name: 'options',
		type: 'collection',
		placeholder: 'Add option',
		default: {},
		displayOptions: {
			show: {
				operation: ['getAll'],
			},
		},
		options: [
			{
				displayName: 'Page Size',
				name: 'pageSize',
				type: 'number',
				default: 20,
				description: 'Number of records per page (default: 20, max: 100)',
			},
			{
				displayName: 'Page Number',
				name: 'pageNumber',
				type: 'number',
				default: 1,
				description: 'Page number to retrieve (starts at 1)',
			},
			{
				displayName: 'Filters',
				name: 'filters',
				type: 'fixedCollection',
				typeOptions: {
					multipleValues: true,
				},
				default: [],
				placeholder: 'Add filter',
				options: [
					{
						name: 'Filter',
						displayName: 'Filter',
						values: [
							{
								displayName: 'Field',
								name: 'field',
								type: 'options',
								typeOptions: {
									loadOptionsMethod: 'getModuleFields',
									loadOptionsDependsOn: ['module'],
								},
								default: '',
								placeholder: 'Select field or Custom...',
							},
							{
								displayName: 'Custom Field Name',
								name: 'customField',
								type: 'string',
								default: '',
								placeholder: 'Field name (example: my_field_c)',
								description: 'Only required if "Custom..." is selected above. Example: my_field_c',
								displayOptions: {
									show: {
										field: ['__custom__'],
									},
								},
							},
							{
								displayName: 'Operator',
								name: 'operator',
								type: 'options',
								default: 'eq',
								options: [
									{ name: 'Equals', value: 'eq', description: 'Equals (=)' },
									{ name: 'Not Equals', value: 'neq', description: 'Not equals (≠)' },
									{ name: 'Greater Than', value: 'gt', description: 'Greater than (>)' },
									{ name: 'Greater Than or Equal', value: 'gte', description: 'Greater than or equal (≥)' },
									{ name: 'Less Than', value: 'lt', description: 'Less than (<)' },
									{ name: 'Less Than or Equal', value: 'lte', description: 'Less than or equal (≤)' },
								],
							},
							{
								displayName: 'Value',
								name: 'value',
								type: 'string',
								default: '',
								placeholder: 'Value for the filter',
								description: 'Value for the filter (string, number, or date depending on field type)',
							},
						],
					},
				],
			},
		],
	},

	// ID field required for Get One, Update, Delete, and Get Relationships
	{
		displayName: 'Record ID',
		name: 'id',
		type: 'string',
		default: '={{ $fromAI("id", "ID of the record", "string") }}',
		required: true,
		description: 'ID of the record',
		displayOptions: {
			show: {
				operation: ['getOne', 'update', 'delete', 'getRelationships'],
			},
		},
	},

	// Relationship field: shows for getRelationships, linkRecord and unlinkRecord operations
	{
		displayName: 'Relationship',
		name: 'relationship',
		type: 'options',
		default: '',
		required: true,
		description: 'Type of relationship to get, link or unlink',
		typeOptions: {
			loadOptionsMethod: 'getAvailableRelationships',
			loadOptionsDependsOn: ['module', 'id', 'recordId'],
		},
		displayOptions: {
			show: {
				operation: ['getRelationships', 'linkRecord', 'unlinkRecord'],
			},
		},
	},

	// Source record of the link / unlink
	{
		displayName: 'Record ID',
		name: 'recordId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the record to link from',
		displayOptions: {
			show: {
				operation: ['linkRecord', 'unlinkRecord'],
			},
		},
	},

	// Destination module of the link
	{
		displayName: 'Related Module',
		name: 'relatedModule',
		type: 'options',
		default: '',
		required: true,
		description: 'Module of the related record',
		typeOptions: {
			loadOptionsMethod: 'getModules',
		},
		noDataExpression: true,
		displayOptions: {
			show: {
				operation: ['linkRecord'],
			},
		},
	},

	// Destination record of the link / unlink
	{
		displayName: 'Related Record ID',
		name: 'relatedId',
		type: 'string',
		default: '',
		required: true,
		description: 'ID of the related record to link or unlink',
		displayOptions: {
			show: {
				operation: ['linkRecord', 'unlinkRecord'],
			},
		},
	},

	// Data Mode: field by field or raw JSON for Create / Update
	{
		displayName: 'Data Mode',
		name: 'dataMode',
		type: 'options',
		default: 'rawJson',
		description: 'How to define the record data',
		options: [
			{
				name: 'Fields',
				value: 'fields',
				description: 'Define each field and its value',
			},
			{
				name: 'Raw JSON',
				value: 'rawJson',
				description: 'Paste the record data as JSON',
			},
		],
		displayOptions: {
			show: {
				operation: ['create', 'update'],
			},
		},
	},

	// Field list for Create / Update in fields mode
	{
		displayName: 'Fields',
		name: 'fields',
		type: 'fixedCollection',
		placeholder: 'Add field',
		default: {},
		description: 'Fields and values to set on the record',
		typeOptions: {
			multipleValues: true,
		},
		displayOptions: {
			show: {
				operation: ['create', 'update'],
				dataMode: ['fields'],
			},
		},
		options: [
			{
				name: 'Field',
				displayName: 'Field',
				values: [
					{
						displayName: 'Field',
						name: 'field',
						type: 'options',
						typeOptions: {
							loadOptionsMethod: 'getModuleFields',
							loadOptionsDependsOn: ['module'],
						},
						default: '',
						placeholder: 'Select field or Custom...',
						description: 'Field to set on the record',
					},
					{
						displayName: 'Custom Field Name',
						name: 'customField',
						type: 'string',
						default: '',
						placeholder: 'Field name (example: my_field_c)',
						description: 'Only required if "Custom..." is selected above. Example: my_field_c',
						displayOptions: {
							show: {
								field: ['__custom__'],
							},
						},
					},
					{
						displayName: 'Value',
						name: 'value',
						type: 'string',
						default: '',
						description: 'Value for the field (supports expressions)',
					},
				],
			},
		],
	},

	// Data field for Create / Update in raw JSON mode
	{
		displayName: 'Data (JSON)',
		name: 'data',
		type: 'json',
		default: '={{ $fromAI("data", "Fields and values of the record to create or update, as a JSON object", "json") }}',
		required: true,
		description: 'Fields and values as JSON',
		displayOptions: {
			show: {
				operation: ['create', 'update'],
				dataMode: ['rawJson'],
			},
		},
	},
];

/**
 * Resolves the record attributes for create/update from the configured data mode.
 * - `fields`: builds the attributes from the field list and validates it.
 * - `rawJson`: parses the JSON data field.
 *
 * Validation failures throw a `NodeOperationError` before any request is made.
 */
export function resolveRecordAttributes(this: IExecuteFunctions, itemIndex: number): IDataObject {
	const dataMode = this.getNodeParameter('dataMode', itemIndex, 'rawJson') as string;

	if (dataMode === 'fields') {
		const fields = this.getNodeParameter('fields', itemIndex, {}) as FieldOptions;
		const fieldList = fields?.Field ?? [];
		if (fieldList.length === 0) {
			throw new NodeOperationError(this.getNode(), 'At least one field is required.');
		}
		for (const entry of fieldList) {
			const fieldName = resolveFieldName(entry);
			if (!fieldName) {
				throw new NodeOperationError(this.getNode(), 'Each field must have a name.');
			}
			if (isEmptyValue(entry.value)) {
				throw new NodeOperationError(this.getNode(), `Field "${fieldName}" requires a value.`);
			}
		}
		return buildAttributes(fields);
	}

	const rawData = this.getNodeParameter('data', itemIndex, '{}');
	try {
		return parseJsonInput(rawData);
	} catch (error) {
		throw new NodeOperationError(
			this.getNode(),
			error instanceof Error ? error.message : String(error),
		);
	}
}

/**
 * Creates a record in the CRM with the attributes resolved from the node parameters.
 */
export async function createRecord(
	this: IExecuteFunctions,
	moduleName: string,
	baseUrl: string,
	itemIndex: number,
): Promise<IDataObject> {
	const attributes = resolveRecordAttributes.call(this, itemIndex);
	const body = buildCreateBody(moduleName, attributes);
	const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
		method: 'POST',
		url: baseUrl,
		body: body as unknown as IDataObject,
		json: true,
	})) as SuiteCRMRecordResponse;
	return response.data ?? {};
}

/**
 * Updates a record in the CRM with the attributes resolved from the node parameters.
 */
export async function updateRecord(
	this: IExecuteFunctions,
	moduleName: string,
	baseUrl: string,
	itemIndex: number,
): Promise<IDataObject> {
	const id = this.getNodeParameter('id', itemIndex) as string;
	const attributes = resolveRecordAttributes.call(this, itemIndex);
	const body = buildUpdateBody(moduleName, id, attributes);
	const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
		method: 'PATCH',
		url: baseUrl,
		body: body as unknown as IDataObject,
		json: true,
	})) as SuiteCRMRecordResponse;
	return response.data ?? {};
}

interface ApiErrorLike {
	httpCode?: number | string;
	statusCode?: number | string;
	status?: number | string;
}

/**
 * Extracts the HTTP status code from an API error, if present.
 */
export function getErrorStatus(error: unknown): number | undefined {
	if (typeof error !== 'object' || error === null) {
		return undefined;
	}
	const apiError = error as ApiErrorLike;
	const status = apiError.httpCode ?? apiError.statusCode ?? apiError.status;
	return typeof status === 'number' ? status : Number(status) || undefined;
}

/**
 * Links an existing record to another via the relationship API.
 * - Skips the request when the relationship already exists (idempotent, FR-006).
 * - Reports a clear error when the related record does not exist.
 */
export async function linkRecord(
	this: IExecuteFunctions,
	moduleName: string,
	baseUrl: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordId = this.getNodeParameter('recordId', itemIndex) as string;
	const relationship = this.getNodeParameter('relationship', itemIndex) as string;
	const relatedModule = this.getNodeParameter('relatedModule', itemIndex) as string;
	const relatedId = this.getNodeParameter('relatedId', itemIndex) as string;

	if (moduleName === relatedModule && recordId === relatedId) {
		throw new NodeOperationError(this.getNode(), 'A record cannot be linked to itself.');
	}

	const relationshipsUrl = `${baseUrl}/${moduleName}/${recordId}/relationships/${relationship}`;

	// Skip the link when it already exists (FR-006: idempotent behavior)
	const existing = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
		method: 'GET',
		url: relationshipsUrl,
		json: true,
	})) as SuiteCRMListResponse;
	if (existing.data?.some((record) => record.id === relatedId)) {
		return { success: true, alreadyLinked: true, id: relatedId, type: relatedModule };
	}

	try {
		const body = buildLinkBody(relatedModule, relatedId);
		const response = (await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
			method: 'POST',
			url: relationshipsUrl,
			body: body as unknown as IDataObject,
			json: true,
		})) as SuiteCRMLinkResponse;
		return (response.data as unknown as IDataObject) ?? { success: true, id: relatedId, type: relatedModule };
	} catch (error) {
		if (getErrorStatus(error) === 404) {
			throw new NodeOperationError(
				this.getNode(),
				`The related record "${relatedId}" does not exist.`,
			);
		}
		throw error;
	}
}

/**
 * Unlinks two records via the relationship API.
 * Reports an idempotent success when the relationship does not exist.
 */
export async function unlinkRecord(
	this: IExecuteFunctions,
	moduleName: string,
	baseUrl: string,
	itemIndex: number,
): Promise<IDataObject> {
	const recordId = this.getNodeParameter('recordId', itemIndex) as string;
	const relationship = this.getNodeParameter('relationship', itemIndex) as string;
	const relatedId = this.getNodeParameter('relatedId', itemIndex) as string;

	try {
		await this.helpers.requestWithAuthentication.call(this, 'SinergiaCRMCredentials', {
			method: 'DELETE',
			url: `${baseUrl}/${moduleName}/${recordId}/relationships/${relationship}/${relatedId}`,
			json: true,
		});
	} catch (error) {
		if (getErrorStatus(error) === 404) {
			return { success: true, alreadyUnlinked: true, id: relatedId };
		}
		throw error;
	}

	return { success: true, id: relatedId };
}
