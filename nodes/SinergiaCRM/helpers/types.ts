// helpers/types.ts
import type { IDataObject } from 'n8n-workflow';

export interface SinergiaCRMListResponse {
	data?: IDataObject[];
}

export interface SinergiaCRMRecordResponse {
	data?: IDataObject;
}

export interface SinergiaCRMRelationshipResource {
	type: string;
	id: string;
}

export interface SinergiaCRMLinkRequest {
	data: SinergiaCRMRelationshipResource;
}

export interface SinergiaCRMLinkResponse {
	data?: SinergiaCRMRelationshipResource;
}

export interface SinergiaCRMCreatePayload {
	data: {
		type: string;
		attributes: IDataObject;
	};
}

export interface SinergiaCRMUpdatePayload {
	data: {
		type: string;
		id: string;
		attributes: IDataObject;
	};
}
