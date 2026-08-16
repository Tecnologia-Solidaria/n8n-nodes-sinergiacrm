// helpers/types.ts
import type { IDataObject } from 'n8n-workflow';

export interface SuiteCRMListResponse {
	data?: IDataObject[];
}

export interface SuiteCRMRecordResponse {
	data?: IDataObject;
}

export interface SuiteCRMRelationshipResource {
	type: string;
	id: string;
}

export interface SuiteCRMLinkRequest {
	data: SuiteCRMRelationshipResource;
}

export interface SuiteCRMLinkResponse {
	data?: SuiteCRMRelationshipResource;
}

export interface SuiteCRMCreatePayload {
	data: {
		type: string;
		attributes: IDataObject;
	};
}

export interface SuiteCRMUpdatePayload {
	data: {
		type: string;
		id: string;
		attributes: IDataObject;
	};
}
