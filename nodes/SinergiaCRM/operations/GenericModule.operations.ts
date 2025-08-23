import type { INodeProperties } from 'n8n-workflow';

/**
 * Generic CRUD operations and relationships for any SuiteCRM module.
 * - "Operation" exposes all main CRUD plus the option to get related records (relationships).
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
		default: '',
		required: true,
		description: 'ID of the record',
		displayOptions: {
			show: {
				operation: ['getOne', 'update', 'delete', 'getRelationships'],
			},
		},
	},

	// Relationship field: shows only for getRelationships operation
	{
		displayName: 'Relationship',
		name: 'relationship',
		type: 'options',
		default: '',
		required: true,
		description: 'Type of relationship to retrieve',
		typeOptions: {
			loadOptionsMethod: 'getAvailableRelationships',
			loadOptionsDependsOn: ['module', 'id'],
		},
		displayOptions: {
			show: {
				operation: ['getRelationships'],
			},
		},
	},

	// Data field for Create / Update (JSON input)
	{
		displayName: 'Data (JSON)',
		name: 'data',
		type: 'json',
		default: '{}',
		required: true,
		description: 'Fields and values as JSON',
		displayOptions: {
			show: {
				operation: ['create', 'update'],
			},
		},
	},
];
