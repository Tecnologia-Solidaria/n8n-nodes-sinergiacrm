import type { IDataObject } from 'n8n-workflow';

const SIMPLIFIED_FIELDS = [
	'id',
	'name',
	'description',
	'first_name',
	'last_name',
	'email1',
	'email_address',
	'phone_work',
	'phone_mobile',
	'title',
	'status',
	'type',
	'account_name',
	'parent_name',
	'date_entered',
	'date_modified',
	'created_by',
	'modified_user_id',
	'module_name',
];

export function simplifyRecord(record: IDataObject): IDataObject {
	const simplified: IDataObject = {};
	for (const key of SIMPLIFIED_FIELDS) {
		if (record[key] !== undefined && record[key] !== null && record[key] !== '') {
			simplified[key] = record[key];
		}
	}
	if (Object.keys(simplified).length === 0) {
		return record;
	}
	return simplified;
}
