'use client';
import {useEffect,useState,useRef} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {PageState,Notice,Loading} from '@/components/Elements';
import {api,fieldLabel,niceText} from '@/lib/api';
import {Icon} from '@/components/Icon';
import {SourcePreview} from '@/components/SourcePreview';
import {Kind,KINDS,KIND_NAMES,Shipment,Issue} from '@/lib/types';
type EditField={path:string;value:unknown;confidence?:number;confirmed:boolean;flagged:boolean};
function flatten(s:Shipment,kind:Kind):EditField[]{const doc=s.documents?.[kind];if(!doc)return [];const rows:EditField[]=[];
 const add=(path:string,value:unknown)=>rows.push({path,value,confidence:doc.confidence?.[path],confirmed:doc.confirmed_fields.includes(path),flagged:s.validation?.issues.some(i=>i.locations.includes(`${kind}.${path}`))||false});
 for(const [key,value] of Object.entries(doc.extracted||{})){if(key==='line_items'&&Array.isArray(value)){value.forEach((item,i)=>{if(item&&typeof item==='object')Object.entries(item).forEach(([name,v])=>add(`line_items[${i}].${name}`,v))})}else add(key,value)}return rows;
}
function FieldRow({field,kind,shipment,sourceAvailable,refresh,active,onLocate}:{field:EditField;kind:Kind;shipment:Shipment;sourceAvailable:boolean;refresh:()=>Promise<void>;active:boolean;onLocate:(field:string)=>void}){
 const ref=useRef<HTMLDivElement>(null),[edit,setEdit]=useState(false),[value,setValue]=useState(niceText(field.value)==='Not extracted'?'':niceText(field.value)),[reason,setReason]=useState(''),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 useEffect(()=>{if(active&&ref.current){const container=ref.current.closest('.mt-fields-scroll') as HTMLElement|null;if(container){const offset=ref.current.getBoundingClientRect().top-container.getBoundingClientRect().top+container.scrollTop-95;container.scrollTo({top:Math.max(0,offset),behavior:'auto'});}}},[active]);
 const state=field.flagged?'Blocking issue':field.confirmed?'Confirmed':'Awaiting verification';
 const isManual=Boolean(shipment.documents?.[kind]?.status?.startsWith('manual'));
 const hasScore=typeof field.confidence==='number'&&Number.isFinite(field.confidence)&&field.confidence>=0&&field.confidence<=1;
 const confidence=isManual?'Manually transcribed — no AI self-score':hasScore?`AI self-score: ${Math.round(field.confidence!*100)}% · not measured accuracy`:'AI self-score unavailable';
 async function confirm(){if(!sourceAvailable||field.confirmed)return;setBusy(true);setErr('');try{await api(`/shipments/${shipment.shipment_id}/documents/${kind}/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field_path:field.path,expected_revision:shipment.revision})});await refresh()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 async function save(){setBusy(true);setErr('');try{let finalValue:unknown=value.trim();if(Array.isArray(field.value))finalValue=value.split(',').map(s=>s.trim()).filter(Boolean);else if(typeof field.value==='number'){const n=Number(value.replaceAll(',',''));if(!Number.isFinite(n))throw new Error('Enter a valid numeric value.');finalValue=n}if(reason.trim().length<8)throw new Error('Explain the correction in at least 8 characters.');await api(`/shipments/${shipment.shipment_id}/documents/${kind}/field`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({field_path:field.path,value:finalValue,reason,expected_revision:shipment.revision})});setEdit(false);await refresh()}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 function onKeys(e:React.KeyboardEvent<HTMLDivElement>){if(e.target!==e.currentTarget)return;const rows=[...document.querySelectorAll<HTMLElement>('[data-review-row]')],i=rows.indexOf(e.currentTarget);if(e.key==='j'||e.key==='k'){e.preventDefault();rows[i+(e.key==='j'?1:-1)]?.focus()}if(e.key.toLowerCase()==='e'){e.preventDefault();setEdit(true)}if(e.key==='Enter'&&sourceAvailable&&!field.confirmed){e.preventDefault();void confirm()}}
 const label=field.path.replace(/^line_items\[(\d+)\]\./,(_,i)=>`Item ${Number(i)+1} · `);
 return <div ref={ref} data-review-row tabIndex={0} onKeyDown={onKeys} onClick={e=>{if(!edit&&!(e.target as HTMLElement).closest('button,input,textarea,a'))onLocate(field.path)}} className={`mt-review-row ${field.flagged?'is-mismatch':''} ${active?'mt-focused':''}`}><div className="mt-review-row-head"><span className="mt-field-name">{fieldLabel(label)}</span><span className={`mt-inline-state ${field.flagged?'is-mismatch':field.confirmed?'is-confirmed':'is-needs'}`} title={confidence}><span className="mt-dot"/>{state}</span></div><div className="mt-field-value">{niceText(field.value)}</div>
 {!isManual&&<div className="mt-field-confidence" style={{fontSize:14,color:'#637782',lineHeight:1.45,margin:'0 0 9px'}}>{confidence}</div>}
 {edit?<div className="mt-inline-edit"><label>Corrected value<input value={value} onChange={e=>setValue(e.target.value)} aria-label={`Edit ${field.path}`}/></label><label>Reason for correction<input value={reason} onChange={e=>setReason(e.target.value)} placeholder="Explain what was corrected"/></label><div className="action-row"><button type="button" className="btn primary small" onClick={()=>void save()} disabled={busy}>{busy?'Saving…':'Save correction'}</button><button type="button" className="btn secondary small" onClick={()=>{setEdit(false);setErr('')}}>Cancel</button></div></div>:<div className="mt-review-row-actions"><button type="button" className="link-button" onClick={()=>{setValue(niceText(field.value)==='Not extracted'?'':niceText(field.value));setEdit(true)}}><Icon name="edit" size={14}/> Edit</button>{sourceAvailable&&<button type="button" className="link-button" onClick={()=>onLocate(field.path)}><Icon name="eye" size={14}/> Find in PDF</button>}{sourceAvailable&&!field.confirmed&&<button type="button" className="link-button" disabled={busy} onClick={()=>void confirm()}><Icon name="check" size={14}/> Confirm from source</button>}{!sourceAvailable&&<span className="mt-source-missing">Upload original to confirm</span>}</div>}
 {err&&<Notice error={err}/>}</div>;
}
const LABELS:Record<Kind,string>={invoice:'Invoice',packing_list:'Packing list',bill_of_lading:'Bill of lading'};
function IssueDetail({issue,onInspect,invoiceSource}:{issue:Issue;onInspect:(kind:Kind,field:string)=>void;invoiceSource:string}){
 const isWeight=issue.code==='GROSS_WEIGHT_MISMATCH'||issue.code==='PACKAGE_MISMATCH';
 const keys=(Object.keys(issue.details||{}).filter(k=>KINDS.includes(k as Kind))) as Kind[];
 return <div className="mt-issue"><div className="mt-issue-head"><span className="mt-status mismatch"><span className="mt-dot"/>{issue.code.includes('MISMATCH')?'Mismatch':'Needs resolution'}</span><strong>{issue.code.replaceAll('_',' ').toLowerCase().replace(/^./,m=>m.toUpperCase())}</strong></div><p>{issue.message}</p>{issue.code==='BUYER_IMPORTER_MISMATCH'&&<p className="mt-help-text">The invoice buyer is {invoiceSource}; the importer is recorded in the shipment master, not in a separate source document.</p>}
 {isWeight&&keys.length>1?<div className="mt-thread">{keys.map((k,i)=><button type="button" className="mt-thread-source" key={k} onClick={()=>onInspect(k,issue.code==='PACKAGE_MISMATCH'?'packages':'gross_weight_kg')}><small>{LABELS[k]}</small><strong>{Number(issue.details[k]).toLocaleString('en-IN')}{issue.code==='GROSS_WEIGHT_MISMATCH'?' kg':' packages'}</strong>{i<keys.length-1&&<span aria-hidden="true" className="mt-thread-line"/>}</button>)}</div>:<div className="mt-issue-details">{Object.entries(issue.details||{}).slice(0,3).map(([key,value])=><span key={key}>{key.replaceAll('_',' ')}: <strong>{String(value)}</strong></span>)}</div>}
 {issue.code==='GROSS_WEIGHT_MISMATCH'&&<p className="mt-weight-explanation">The highest and lowest source values differ by {Math.max(...Object.values(issue.details).map(Number).filter(Number.isFinite))-Math.min(...Object.values(issue.details).map(Number).filter(Number.isFinite))} kg. Confirm which original is correct before changing any extracted value.</p>}
 <button type="button" className="mt-inspect-link" onClick={()=>{const loc=issue.locations[0]||'invoice.invoice_number';const [raw,...parts]=loc.split('.');onInspect(KINDS.includes(raw as Kind)?raw as Kind:'invoice',parts.join('.')||'invoice_number')}}>Inspect in source <Icon name="arrow-right" size={15}/></button></div>;
}
function Reviewer({s,refresh,kind,setKind,focus,setFocus}:{s:Shipment;refresh:()=>Promise<void>;kind:Kind;setKind:(v:Kind)=>void;focus:string;setFocus:(v:string)=>void}){
 const [mobileView,setMobileView]=useState<'document'|'fields'>('document');
 const fields=flatten(s,kind);
 const blockingIssues=s.validation?.issues||[];
 const linkedFields=fields.filter(f=>f.flagged);
 const awaitingFields=fields.filter(f=>!f.flagged&&!f.confirmed);
 const confirmedFields=fields.filter(f=>f.confirmed&&!f.flagged);
 const doc=s.documents?.[kind];
 const orderedIssues=[...blockingIssues].sort((a,b)=>{
  const matches=(issue:Issue)=>issue.locations?.includes(`${kind}.${focus}`)?1:0;
  return matches(b)-matches(a);
 });
 function inspect(k:Kind,field:string){setKind(k);setFocus(field);setMobileView('document');}
 return <><div className="mt-mobile-review-tabs"><button className={mobileView==='document'?'active':''} onClick={()=>setMobileView('document')} type="button">Document</button><button className={mobileView==='fields'?'active':''} onClick={()=>setMobileView('fields')} type="button">Fields and issues</button></div><div className="mt-review-layout" data-mobile-view={mobileView}><section className="mt-document-pane"><div className="mt-pane-heading"><span><Icon name="file" size={17}/> Original {KIND_NAMES[kind]}</span>{doc?.source_available&&<span className="mt-original-label">Private source</span>}</div><SourcePreview shipmentId={s.shipment_id} kind={kind} highlightField={focus} /></section>
 <section className="mt-fields-pane"><div className="mt-pane-heading"><span>Extracted fields and cross-checks</span><Link href={`/shipments/${s.shipment_id}/checks`} className="inline-link">All checks <Icon name="arrow-right" size={15}/></Link></div>
 <div className="mt-fields-scroll">
 {blockingIssues.length>0&&<><div className="mt-fields-heading"><h3>Blocking issues</h3><span>{blockingIssues.length} issue{blockingIssues.length===1?'':'s'}</span></div>
 {orderedIssues.map((issue,i)=><IssueDetail key={`${issue.code}-${i}`} issue={issue} onInspect={inspect} invoiceSource={s.documents?.invoice?.status==='manual_verified'?'manually transcribed from the original document':'an AI-extracted draft that requires human verification'}/>)}</>}
 {linkedFields.length>0&&<details className="mt-cleared mt-other-fields" open={Boolean(focus&&linkedFields.some(f=>f.path===focus))}><summary>Fields linked to blocking issues ({linkedFields.length}) <Icon name="chevron" size={15}/></summary>
 {linkedFields.map(f=><FieldRow key={`${kind}-${f.path}-${s.revision}`} field={f} kind={kind} shipment={s} refresh={refresh} sourceAvailable={Boolean(doc?.source_available)} active={focus===f.path} onLocate={path=>inspect(kind,path)}/>)}</details>}
 {awaitingFields.length>0&&<details className="mt-cleared mt-other-fields" open={Boolean(focus&&awaitingFields.some(f=>f.path===focus))}><summary>Awaiting source verification ({awaitingFields.length}) <Icon name="chevron" size={15}/></summary>
 {awaitingFields.some(f=>!f.path.startsWith('line_items'))&&<div className="mt-field-group-label">Document details</div>}
 {awaitingFields.filter(f=>!f.path.startsWith('line_items')).map(f=><FieldRow key={`${kind}-${f.path}-${s.revision}`} field={f} kind={kind} shipment={s} refresh={refresh} sourceAvailable={Boolean(doc?.source_available)} active={focus===f.path} onLocate={path=>inspect(kind,path)}/>)}
 {awaitingFields.some(f=>f.path.startsWith('line_items'))&&<div className="mt-field-group-label">Line items</div>}
 {awaitingFields.filter(f=>f.path.startsWith('line_items')).map(f=><FieldRow key={`${kind}-${f.path}-${s.revision}`} field={f} kind={kind} shipment={s} refresh={refresh} sourceAvailable={Boolean(doc?.source_available)} active={focus===f.path} onLocate={path=>inspect(kind,path)}/>)}
 </details>}
 {blockingIssues.length===0&&linkedFields.length===0&&awaitingFields.length===0&&<p className="mt-nothing-pending">No unresolved issues or unverified fields in this document.</p>}
 {!doc&&<Link className="btn secondary" href={`/shipments/${s.shipment_id}/upload`}>Upload {KIND_NAMES[kind]}</Link>}
 {confirmedFields.length>0&&<details className="mt-cleared"><summary><Icon name="check" size={16}/> Confirmed ({confirmedFields.length}) <Icon name="chevron" size={15}/></summary>{confirmedFields.map(f=><FieldRow key={`${kind}-${f.path}-${s.revision}`} field={f} kind={kind} shipment={s} refresh={refresh} sourceAvailable={Boolean(doc?.source_available)} active={focus===f.path} onLocate={path=>inspect(kind,path)}/>)}</details>}

 </div></section></div></>;
}
export default function ReviewPage(){const{id}=useParams<{id:string}>();const[kind,setKind]=useState<Kind>('invoice'),[focus,setFocus]=useState('');
 useEffect(()=>{const q=new URLSearchParams(window.location.search);const k=q.get('kind');if(KINDS.includes(k as Kind))setKind(k as Kind);setFocus(q.get('field')||'')},[]);
 return <PageState id={id}>{(s,refresh)=><div className="mt-review-page"><div className="mt-crosscheck-summary"><span className={s.checks_clear?'mt-summary-passed':'mt-summary-warning'}>{s.checks_clear?<Icon name="check" size={17}/>:<Icon name="alert" size={17}/>} {s.checks_clear?'Automatic checks passed':`${s.validation?.issues.length||0} blocking issue(s)`}</span><span>{s.checks_clear?'Current revision still requires manager approval.':'Review the source and resolve all mismatches before export.'}</span></div>
 <div className="mt-document-tabs" aria-label="Document selector">{KINDS.map(k=><button type="button" key={k} className={kind===k?'active':''} onClick={()=>{setKind(k);setFocus('')}}>{KIND_NAMES[k]}</button>)}</div>
 <Reviewer s={s} kind={kind} setKind={setKind} focus={focus} setFocus={setFocus} refresh={refresh}/>
 <div className="mt-review-sticky"><span>{s.export_allowed?'Approved and ready to export':s.checks_clear?'Checks passed · awaiting manager approval':`${s.validation?.issues.length||0} to resolve · export locked`}</span><div><Link className="btn secondary" href={`/shipments/${id}/history`}>History</Link><Link className="btn primary" href={`/shipments/${id}/export`}>{s.export_allowed?'Export CSV':'Approval & export'} <Icon name="arrow-right" size={16}/></Link></div></div></div>}</PageState>;
}
