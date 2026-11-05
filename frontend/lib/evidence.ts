import {fieldLabel, niceText} from '@/lib/api';
import {KINDS, type Kind, type Issue, type Shipment} from '@/lib/types';
export type EvidenceSource = {
  id: string;
  kind: Kind | 'shipment' | 'calculated';
  field: string;
  label: string;
  value: string;
  hasOriginal: boolean;
  isDocument: boolean;
};
const SOURCE_NAMES: Record<Kind, string> = {
  invoice: 'Commercial invoice', packing_list: 'Packing list', bill_of_lading: 'Bill of lading',
};

export function getPath(root:unknown, field:string):unknown {
  if(!root || typeof root !== 'object') return undefined;
  const match = /^line_items\[(\d+)\]\.([a-z_]+)$/.exec(field);
  if(match) {
    const items = (root as Record<string,unknown>).line_items;
    const item = Array.isArray(items) ? items[Number(match[1])] : undefined;
    return item && typeof item === 'object' ? (item as Record<string,unknown>)[match[2]] : undefined;
  }
  if(field === 'line_items') {
    const items = (root as Record<string,unknown>).line_items;
    return Array.isArray(items) ? `${items.length} line item${items.length===1?'':'s'}` : undefined;
  }
  return (root as Record<string,unknown>)[field];
}
export function addSource(s:Shipment, id:string):EvidenceSource {
  if(id==='shipment.importer_name')return {
    id,kind:'shipment',field:'importer_name',label:'Shipment record',value:niceText(s.importer_name),
    hasOriginal:false,isDocument:false,
  };
  if(id==='calculated.line_sum')return {
    id,kind:'calculated',field:'line_sum',label:'Calculated from line items',
    value:niceText(s.validation?.issues.find(i=>i.code==='INVOICE_TOTAL_MISMATCH')?.details.calculated),
    hasOriginal:false,isDocument:false,
  };
  const [prefix,...rest] = id.split('.');
  if(KINDS.includes(prefix as Kind)){
    const kind=prefix as Kind;
    return {id, kind,field:rest.join('.'),label:SOURCE_NAMES[kind],
      value:niceText(getPath(s.documents?.[kind]?.extracted,rest.join('.'))),
      hasOriginal:Boolean(s.documents?.[kind]?.source_available),isDocument:true};
  }
  return {id,kind:'shipment',field:id,label:'Validation rule',value:'Inspect details',hasOriginal:false,isDocument:false};
}
export function buildSources(s:Shipment, issue:Issue):EvidenceSource[] {
  let paths = [...(issue.locations||[])];
  if(issue.code==='GROSS_WEIGHT_MISMATCH')paths=KINDS.map(k=>`${k}.gross_weight_kg`);
  if(issue.code==='PACKAGE_MISMATCH')paths=KINDS.map(k=>`${k}.packages`);
  if(issue.code==='BUYER_IMPORTER_MISMATCH')paths=['invoice.buyer_name','shipment.importer_name'];
  if(issue.code==='INVOICE_TOTAL_MISMATCH')paths=['invoice.invoice_total','calculated.line_sum'];
  const unique=Array.from(new Set(paths.filter(p=>p.includes('.'))));
  return unique.slice(0,5).map(p=>addSource(s,p));
}
export function titleOf(issue:Issue):string {
  const names:Record<string,string>={
    GROSS_WEIGHT_MISMATCH:'One shipment. Two weights.',
    BUYER_IMPORTER_MISMATCH:'An identity that doesn’t align.',
    PACKAGE_MISMATCH:'The package counts disagree.',
    INVOICE_REFERENCE_MISMATCH:'Two invoice references.',
    INVOICE_TOTAL_MISMATCH:'The total doesn’t add up.',
    LOW_CONFIDENCE:'This field needs your eyes.',
    MISSING_DOCUMENT:'A source is missing.',
  };
  return names[issue.code]||fieldLabel(issue.code).replace(/\b\w/g,c=>c.toUpperCase());
}
export function labelOf(issue:Issue){return fieldLabel(issue.code).replace(/\b\w/g,c=>c.toUpperCase());}
export function requestText(s:Shipment,issue:Issue, sources:EvidenceSource[]){
  const lines = sources.map(src=>`${src.label}${src.field?` (${fieldLabel(src.field)})`:''}: ${src.value}`);
  return `Subject: Source clarification requested — ${s.shipment_id}\n\nPlease review the following discrepancy before we proceed with clearance documentation.\n\n${issue.message}\n\n${lines.join('\n')}\n\nPlease clarify the correct value and provide corrected source paperwork if necessary. No value will be changed or cleared until a human reviewer verifies it.`;
}
