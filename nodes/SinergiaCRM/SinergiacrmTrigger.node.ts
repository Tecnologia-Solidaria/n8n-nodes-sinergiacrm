// nodes/SinergiaCRM/SinergiaCRMTrigger.node.ts
import type { INodeExecutionData, INodeType, INodeTypeDescription, IPollFunctions } from 'n8n-workflow';
import { NodeConnectionType } from 'n8n-workflow';

import * as methods from './methods.loadOptions';
import { poll as triggerPoll } from './operations/Trigger.operations';

/**
 * n8n polling trigger for SinergiaCRM (SinergiaCRM API).
 * Emits one item per created or updated record in the selected modules.
 */
export class SinergiacrmTrigger implements INodeType {
	description: INodeTypeDescription = {
		displayName: 'SinergiaCRM Trigger',
		name: 'sinergiacrmTrigger',
		icon: 'file:sinergiacrm.svg',
		group: ['trigger'],
		version: 1,
		subtitle: 'SinergiaCRM',
		description: 'Polls SinergiaCRM (SinergiaCRM API) for new or updated records.',
		defaults: {
			name: 'SinergiaCRM Trigger',
		},
		inputs: [],
		outputs: [NodeConnectionType.Main],
		polling: true,
		credentials: [
			{
				name: 'SinergiaCRMCredentials',
				required: true,
			},
		],
		properties: [
			{
				displayName: 'Modules',
				name: 'module',
				type: 'multiOptions',
				default: [],
				required: true,
				description: 'Modules to watch for changes',
				typeOptions: {
					loadOptionsMethod: 'getModules',
				},
			},
			{
				displayName: 'Events',
				name: 'events',
				type: 'multiOptions',
				default: ['created', 'updated'],
				required: true,
				description:
					'Types of change to emit. Deleted records are not supported by the SinergiaCRM JSON API.',
				options: [
					{
						name: 'Created',
						value: 'created',
					},
					{
						name: 'Updated',
						value: 'updated',
					},
				],
			},
			{
				displayName: 'Check Interval',
				name: 'checkInterval',
				type: 'options',
				default: 'everyPoll',
				description: 'How often the node queries SinergiaCRM',
				options: [
					{
						name: 'Every Poll',
						value: 'everyPoll',
					},
					{
						name: 'Hours',
						value: 'hours',
					},
					{
						name: 'Days',
						value: 'days',
					},
					{
						name: 'Cron Expression',
						value: 'cron',
					},
				],
			},
			{
				displayName: 'Number of Hours',
				name: 'numberHours',
				type: 'number',
				default: 1,
				description: 'Poll once every given number of hours',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						checkInterval: ['hours'],
					},
				},
			},
			{
				displayName: 'Number of Days',
				name: 'numberDays',
				type: 'number',
				default: 1,
				description: 'Poll once every given number of days',
				typeOptions: {
					minValue: 1,
				},
				displayOptions: {
					show: {
						checkInterval: ['days'],
					},
				},
			},
			{
				displayName: 'Cron Expression',
				name: 'cronExpression',
				type: 'string',
				default: '',
				placeholder: '*/30 * * * *',
				description:
					'Standard 5-field cron expression (minute hour day month weekday). The minimum granularity is 1 minute.',
				displayOptions: {
					show: {
						checkInterval: ['cron'],
					},
				},
			},
		],
	};

	methods = {
		loadOptions: methods,
	};

	async poll(this: IPollFunctions): Promise<INodeExecutionData[][] | null> {
		return triggerPoll.call(this);
	}
}
