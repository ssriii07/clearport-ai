'use client';
import {useEffect,useMemo,useState} from 'react';
import Link from 'next/link';
import {useParams,useRouter} from 'next/navigation';
import {PageState,Notice} from '@/components/Elements';
import {SourcePreview} from '@/components/SourcePreview';
import {api} from '@/lib/api';
import {KINDS,KIND_NAMES,Kind,Shipment} from '@/lib/types';

type Definition={key:string;label:string;type?:'number'|'date'};
const FIELD_OPTIONS:Record<Kind,Definition[]>={
 invoice:[{key:'supplier_name',label:'Supplier'},{key:'buyer_name',label:'Buyer / importer'},{key:'invoice_number',label:'Invoice number'},{key:'invoice_date',label:'Invoice date (YYYY-MM-DD)',type:'date'},{key:'currency',label:'Currency'},{key:'incoterm',label:'Incoterm'},{key:'invoice_total',label:'Invoice total',type:'number'},{key:'packages',label:'Packages',type:'number'},{key:'gross_weight_kg',label:'Gross weight (kg)',type:'number'}],
 packing_list:[{key:'supplier_name',label:'Supplier'},{key:'invoice_number',label:'Invoice reference'},{key:'packages',label:'Packages',type:'number'},{key:'gross_weight_kg',label:'Gross weight (kg)',type:'number'}],
 bill_of_lading:[{key:'bill_of_lading_number',label:'Bill of lading number'},{key:'container_numbers',label:'Container numbers (comma-separated)'},{key:'packages',label:'Packages',type:'number'},{key:'gross_weight_kg',label:'Gross weight (kg)',type:'number'}]
};
const LINE_FIELDS:Definition[]=[{key:'description',label:'Item description'},{key:'hsn_code',label:'HSN code'},{key:'quantity',label:'Quantity',type:'number'},{key:'unit_price',label:'Unit price',type:'number'},{key:'line_total',label:'Line total',type:'number'}];
const isDate=(v:string)=>{if(!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const d=new Date(`${v}T00:00:00Z`);return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===v;};
function convertValue(def:Definition,v:string):unknown{
 if(def.type==='date'){if(!isDate(v))throw Error(`${def.label}: enter a real date in YYYY-MM-DD format.`);return v;}
 if(def.type==='number'){
  const clean=v.replaceAll(',','').trim();if(!/^(?:\d+(?:\.\d+)?|\.\d+)$/.test(clean)||!Number.isFinite(Number(clean)))throw Error(`${def.label}: enter a valid non-negative number.`);
  const n=Number(clean);if(['packages','quantity'].includes(def.key)&&(!Number.isInteger(n)||n<=0))throw Error(`${def.label}: enter a positive whole number.`);
  if(def.key==='unit_price'&&n<=0)throw Error('Unit price must be greater than zero.');return n;
 }
 if(def.key==='container_numbers'){const values=v.split(',').map(x=>x.trim()).filter(Boolean);if(!values.length||values.length>20)throw Error('Enter 1–20 container numbers separated by commas.');return values;}
 if(def.key==='currency'&&!/^[A-Za-z]{3}$/.test(v.trim()))throw Error('Currency: use a three-letter code such as USD or EUR.');
 return def.key==='currency'?v.toUpperCase().trim():v.trim();
}
function ManualForm({s,refresh,kind}:{s:Shipment;refresh:()=>Promise<void>;kind:Kind}){
 const router=useRouter();const [file,setFile]=useState<File|null>(null),[values,setValues]=useState<Record<string,string>>({}),[items,setItems]=useState<Record<string,string>[]>([{}]);
 const [attest,setAttest]=useState(false),[note,setNote]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState(''),[message,setMessage]=useState(''),[mobileView,setMobileView]=useState<'fields'|'document'>('fields');
 const source=Boolean(s.documents?.[kind]?.source_available);const put=(key:string,value:string)=>setValues(prev=>({...prev,[key]:value}));
 const invoiceMismatch=useMemo(()=>{if(kind!=='invoice')return '';
  const total=Number((values.invoice_total||'').replaceAll(',',''));
  const rows=items.filter(item=>item.line_total?.trim());const sum=rows.reduce((a,row)=>a+Number((row.line_total||'').replaceAll(',','')),0);
  if(!values.invoice_total?.trim()||!rows.length||!Number.isFinite(total)||!Number.isFinite(sum)||Math.abs(total-sum)<.01)return '';
  return `Invoice total (${total.toLocaleString('en-IN')}) differs from entered line totals (${sum.toLocaleString('en-IN')}). Keep the genuine values; cross-document validation will block export until the discrepancy is resolved.`;
 },[kind,values.invoice_total,items]);
 async function attach(){if(!file)return;setBusy(true);setError('');setMessage('');try{
  if(!['application/pdf','image/png','image/jpeg'].includes(file.type)||file.size>6*1024*1024)throw new Error('Choose a PDF, PNG or JPEG up to 6 MB.');
  const body=new FormData();body.append('file',file);const r=await fetch(`/api/relay/shipments/${s.shipment_id}/documents/${kind}/source?expected_revision=${s.revision}`,{method:'POST',body});
  if(!r.ok){const payload=await r.json().catch(()=>({}));throw new Error(typeof payload.detail==='string'?payload.detail:'Could not attach original source.');}
  await refresh();setMessage('Original saved privately. Review it beside the fields before entering verified values.');setFile(null);
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function save(){setBusy(true);setError('');setMessage('');try{
  if(!source)throw new Error('Attach the original source file first.');
  if(!attest||note.trim().length<12)throw new Error('Confirm source review and explain the manual entry in at least 12 characters.');
  const fields:Record<string,unknown>={};for(const def of FIELD_OPTIONS[kind]){const v=values[def.key]?.trim();if(v)fields[def.key]=convertValue(def,v);}
  if(kind==='invoice'||kind==='packing_list'){
   const lines=items.map((item,index)=>{const row:Record<string,unknown>={};for(const def of LINE_FIELDS){const v=item[def.key]?.trim();if(v){try{row[def.key]=convertValue(def,v)}catch(e){throw new Error(`Item ${index+1}: ${(e as Error).message}`)}}}return row;}).filter(row=>Object.keys(row).length>0);
   if(lines.length)fields.line_items=lines;
  }
  if(!Object.keys(fields).length)throw new Error('Enter at least one source-verified field. Leave unreadable values empty.');
  await api(`/shipments/${s.shipment_id}/documents/${kind}/manual`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:s.revision,fields,confirmation:note.trim()})});
  router.push(`/shipments/${s.shipment_id}/review?kind=${kind}`);router.refresh();
 }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const fieldInput=(def:Definition,index?:number)=><label key={def.key} className="mt-manual-field">{def.label}<input type="text" inputMode={def.type==='number'?'decimal':def.type==='date'?'numeric':'text'} value={index===undefined?values[def.key]||'':items[index]?.[def.key]||''} onChange={e=>index===undefined?put(def.key,e.target.value):setItems(prev=>prev.map((row,i)=>i===index?{...row,[def.key]:e.target.value}:row))} placeholder={def.type==='date'?'2026-10-25':def.type==='number'?'0':'Enter value visible in source'} /></label>;
 return <div className="mt-manual-page">
  <div className="mt-heading-row mt-manual-title"><div><h2>Enter {KIND_NAMES[kind].toLowerCase()} manually</h2><p>For unreadable scans or failed AI extraction. These are human-transcribed values, not AI results.</p></div><Link className="btn secondary" href={`/shipments/${s.shipment_id}/upload`}>Back to uploads</Link></div>
  <div className="notice info mt-manual-guidance">Only enter details visible in the original or an authoritative corrected document. Missing or conflicting values must remain blocked from approval and export.</div>
  <div className="mt-manual-mobile-switch" role="group" aria-label="Manual entry workspace"><button type="button" aria-pressed={mobileView==='document'} className={mobileView==='document'?'active':''} onClick={()=>setMobileView('document')}>Original document</button><button type="button" aria-pressed={mobileView==='fields'} className={mobileView==='fields'?'active':''} onClick={()=>setMobileView('fields')}>Entry fields</button></div>
  <div className="mt-manual-workspace" data-mobile-view={mobileView}>
   <section className="mt-manual-source-side" aria-label="Original document reference"><div className="mt-manual-source-top"><strong>Original source</strong><span>{source?s.documents?.[kind]?.original_name||'Attached document':'Not yet attached'}</span></div>
    {source?<SourcePreview shipmentId={s.shipment_id} kind={kind} expandLabel="Expand"/>:<div className="mt-manual-source-upload"><p>Attach a fictional PDF, PNG or JPEG (up to 6 MB). This saves the original without invoking AI extraction.</p><input type="file" accept=".pdf,.png,.jpg,.jpeg" aria-label="Attach original for manual entry" onChange={e=>setFile(e.target.files?.[0]||null)}/><button type="button" className="btn secondary" onClick={()=>void attach()} disabled={busy||!file}>{busy?'Saving…':'Save original for manual entry'}</button></div>}
   </section>
   <section className="mt-manual-form-side" aria-label="Manual transcription fields"><div className="mt-manual-fields-intro"><strong>Manual transcription</strong><p>Keep the original open on the left as you enter each verified value. Unreadable details can stay blank.</p></div>
    <section className="mt-manual-section"><h3>{kind==='bill_of_lading'?'Transport reference':'Parties and references'}</h3><div className="mt-manual-grid">{FIELD_OPTIONS[kind].filter(def=>!['invoice_total','packages','gross_weight_kg'].includes(def.key)).map(def=>fieldInput(def))}</div></section>
    <section className="mt-manual-section"><h3>Packages and totals</h3><div className="mt-manual-grid">{FIELD_OPTIONS[kind].filter(def=>['invoice_total','packages','gross_weight_kg'].includes(def.key)).map(def=>fieldInput(def))}</div></section>
    {(kind==='invoice'||kind==='packing_list')&&<section className="mt-manual-section"><h3>Line items</h3><p>Enter the items you can read. Incomplete or inconsistent details will remain flagged by validation.</p>{items.map((item,index)=><fieldset key={index} className="mt-manual-item"><legend>Item {index+1}</legend><div className="mt-manual-grid">{LINE_FIELDS.map(def=>fieldInput(def,index))}</div>{(()=>{const q=Number((item.quantity||'').replaceAll(',','')),price=Number((item.unit_price||'').replaceAll(',','')),total=Number((item.line_total||'').replaceAll(',',''));return item.quantity?.trim()&&item.unit_price?.trim()&&item.line_total?.trim()&&[q,price,total].every(Number.isFinite)&&Math.abs(q*price-total)>.01?<p className="mt-manual-validation" role="status">Item {index+1}: quantity × unit price ({(q*price).toLocaleString('en-IN')}) differs from the entered line total ({total.toLocaleString('en-IN')}). Keep the source values; validation will flag the conflict.</p>:null})()}{items.length>1&&<button className="btn secondary small" type="button" onClick={()=>setItems(old=>old.filter((_,i)=>i!==index))}>Remove item</button>}</fieldset>)}<button className="btn secondary" type="button" onClick={()=>setItems(prev=>[...prev,{}])} disabled={items.length>=20}>Add another line item</button>{invoiceMismatch&&<p className="mt-manual-validation" role="status">{invoiceMismatch}</p>}</section>}
    <section className="mt-manual-section mt-manual-attest"><h3>Verification and reason</h3><label htmlFor="manual-reason">Why is manual entry needed?</label><textarea id="manual-reason" rows={3} value={note} maxLength={480} onChange={e=>setNote(e.target.value)} placeholder="e.g., Skewed scan; values transcribed and checked against source"/><label className="mt-manual-confirm"><input type="checkbox" checked={attest} onChange={e=>setAttest(e.target.checked)}/><span>I checked every entered value against the original source. Unresolved or illegible details are left blank.</span></label><button className="btn primary" type="button" disabled={busy||!source||!attest||note.trim().length<12} onClick={()=>void save()}>{busy?'Saving…':'Save verified manual entry'}</button></section>
    {message&&<Notice error={message} kind="success"/>}{error&&<Notice error={error}/>}<p className="mt-manual-safety">Saving creates a new shipment revision and audit record. A real discrepancy is never silently cleared.</p>
   </section>
  </div>
 </div>;
}
export default function ManualPage(){const {id}=useParams<{id:string}>();const [kind,setKind]=useState<Kind>('invoice');useEffect(()=>{const selected=new URLSearchParams(window.location.search).get('kind');if(KINDS.includes(selected as Kind))setKind(selected as Kind)},[]);return <PageState id={id}>{(s,refresh)=><ManualForm key={`${id}-${kind}`} s={s} kind={kind} refresh={refresh}/>}</PageState>}
