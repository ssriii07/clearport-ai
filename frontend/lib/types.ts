export type Role = 'executive' | 'manager';
export type Kind = 'invoice' | 'packing_list' | 'bill_of_lading';
export const KINDS: Kind[] = ['invoice','packing_list','bill_of_lading'];
export const KIND_NAMES: Record<Kind,string> = { invoice:'Commercial invoice', packing_list:'Packing list', bill_of_lading:'Bill of lading' };
export type Issue = {code:string; message:string; locations:string[]; details:Record<string,unknown>; severity:string};
export type DocumentDraft = {status:string; extracted:Record<string,unknown>; confidence:Record<string,number>; confirmed_fields:string[]; source_available?:boolean};
export type Shipment = {
  shipment_id:string; importer_name:string; revision:number; status:string; checks_clear:boolean;
  approved_current_revision:boolean; export_allowed:boolean;
  validation?: {shipment_id:string; checks_clear:boolean; issues:Issue[]};
  documents?: Partial<Record<Kind,DocumentDraft>>;
};
export type Audit = {field_path:string; action:string; document_kind:string; old_value:string|null; new_value:string|null; reason:string; user_id:number; created_at:string};
export type History = {edits_and_confirmations:Audit[]; approvals:{revision:number; user_id:number; comment:string; created_at:string}[]; exports:{revision:number; user_id:number; sha256:string; created_at:string}[]};
