'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {PageState,PageIntro,Notice,Loading} from '@/components/Elements';
import {api,fieldLabel,niceText} from '@/lib/api';
import {Icon} from '@/components/Icon';
import {Kind,KINDS,KIND_NAMES,Shipment} from '@/lib/types';
function SourceViewer({id,kind}:{id:string;kind:Kind}){
 const [url,setUrl]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(true);
 useEffect(()=>{
   let active=true;let generated='';setLoading(true);setError('');setUrl('');
   fetch(`/api/relay/shipments/${id}/documents/${kind}/file`).then(async r=>{
     if(!r.ok){let detail='No original file is attached to this seeded document.';if(r.status!==404){try{const d=await r.json();detail=d.detail||detail}catch{}}throw new Error(detail)}
     return r.blob();
   }).then(blob=>{generated=URL.createObjectURL(blob);if(active)setUrl(generated)}).catch(e=>{if(active)setError(e.message)}).finally(()=>{if(active)setLoading(false)});
   return ()=>{active=false;if(generated)URL.revokeObjectURL(generated)};
 },[id,kind]);
 if(loading)return <div className="preview-placeholder"><Loading message="Opening source document…"/></div>;
 if(error)return <div className="preview-placeholder"><Icon name="file" size={32}/><h3>Source not available</h3><p>{error}</p><Link href={`/shipments/${id}/upload`} className="btn secondary"><Icon name="upload" size={16}/> Upload original</Link></div>;
 return <iframe className="source-frame" title={`${KIND_NAMES[kind]} source file`} src={url}/>;
}
type EditField={path:string;value:unknown;confidence?:number;confirmed:boolean;flagged:boolean};
function flatten(s:Shipment,kind:Kind):EditField[]{
 const doc=s.documents?.[kind];if(!doc)return [];
 const result:EditField[]=[];
 for(const [k,v] of Object.entries(doc.extracted||{})){
   if(k==='line_items' && Array.isArray(v)){v.forEach((item,i)=>{if(item && typeof item==='object')Object.entries(item).forEach(([field,value])=>{const path=`line_items[${i}].${field}`;result.push({path,value,confidence:doc.confidence[path],confirmed:doc.confirmed_fields.includes(path),flagged:s.validation?.issues.some(x=>x.locations.some(l=>l===`${kind}.${path}`))||false})})});continue;}
   result.push({path:k,value:v,confidence:doc.confidence[k],confirmed:doc.confirmed_fields.includes(k),flagged:s.validation?.issues.some(x=>x.locations.some(l=>l===`${kind}.${k}`))||false});
 }
 return result;
}
function FieldRow({field,kind,shipment,refresh}:{field:EditField;kind:Kind;shipment:Shipment;refresh:()=>Promise<void>}){
 const [editing,setEditing]=useState(false),[value,setValue]=useState(niceText(field.value)==='Not extracted'?'':niceText(field.value));
 const [reason,setReason]=useState('Corrected against the uploaded source document'),[busy,setBusy]=useState(false),[error,setError]=useState('');
 const percent=field.confidence===undefined?null:Math.round(field.confidence*100);
 const uncertain=percent!==null&&percent<85&&!field.confirmed;
 async function save(){setBusy(true);setError('');try{
    let finalValue:unknown=value.trim();
    if(Array.isArray(field.value))finalValue=value.split(',').map(x=>x.trim()).filter(Boolean);
    else if(typeof field.value==='number'){
      const n=Number(value.replaceAll(',',''));if(!Number.isFinite(n))throw new Error('Enter a valid number.');finalValue=n;
    }
    if(!reason.trim()||reason.trim().length<8)throw new Error('Provide a correction reason (at least 8 characters).');
    await api(`/shipments/${shipment.shipment_id}/documents/${kind}/field`,{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({field_path:field.path,value:finalValue,reason,expected_revision:shipment.revision})});
    setEditing(false);await refresh();
   }catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function confirm(){setBusy(true);setError('');try{await api(`/shipments/${shipment.shipment_id}/documents/${kind}/confirm`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({field_path:field.path,expected_revision:shipment.revision})});await refresh();}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const label=field.path.replace(/^line_items\[(\d+)\]\./,(_,i)=>`Item ${Number(i)+1} · `);
 return <div className={`field-row ${field.flagged?'flagged':''}`}><div className="field-meta"><span>{fieldLabel(label)}</span><div className="field-badges">{field.confirmed&&<span className="mini good-text">Human confirmed</span>}{percent!==null&&<span className={`mini ${uncertain?'danger-text':'muted'}`} title="Model self-estimated confidence; not a calibrated probability">AI {percent}%</span>}{field.flagged&&<span className="mini danger-text">Check</span>}</div></div><div className="field-value">{niceText(field.value)}</div>{editing?<div className="field-form"><label>Corrected value<input value={value} onChange={e=>setValue(e.target.value)} aria-label={`Edit ${field.path}`}/></label><label>Reason for change<input value={reason} onChange={e=>setReason(e.target.value)} aria-label="Correction reason"/></label>{error&&<Notice error={error}/>}<div className="action-row"><button type="button" disabled={busy} className="btn primary small" onClick={()=>void save()}>{busy?'Saving…':'Save correction'}</button><button type="button" className="btn ghost small" onClick={()=>{setEditing(false);setError('')}}>Cancel</button></div></div>:<div className="field-actions"><button type="button" className="link-button" onClick={()=>{setEditing(true);setValue(niceText(field.value)==='Not extracted'?'':niceText(field.value))}}><Icon name="edit" size={14}/> Edit</button>{percent!==null&&!field.confirmed&&<button type="button" className="link-button" disabled={busy} onClick={()=>void confirm()}><Icon name="check" size={14}/> Confirm from source</button>}</div>}{error&&!editing&&<Notice error={error}/>}</div>
}
function Reviewer({id,kind,shipment,refresh}:{id:string;kind:Kind;shipment:Shipment;refresh:()=>Promise<void>}){
 const doc=shipment.documents?.[kind];const fields=flatten(shipment,kind);
 return <div className="review-grid"><section className="source-panel"><div className="review-panel-top"><span><Icon name="file" size={18}/> Original {KIND_NAMES[kind]}</span><span className="mini muted">PRIVATE SOURCE</span></div><SourceViewer id={id} kind={kind}/></section><section className="field-panel"><div className="review-panel-top"><span><Icon name="edit" size={17}/> AI draft · editable fields</span><span className="mini muted">REV {shipment.revision}</span></div><div className="field-panel-body"><p className="small muted">AI confidence is an uncalibrated self-estimate. Verify against the source before confirming or editing. Every change is audited.</p>{!doc||fields.length===0?<div className="empty"><h3>No draft data</h3><p>Upload this document to extract fields with Gemini.</p><Link href={`/shipments/${id}/upload`} className="btn primary">Upload document</Link></div>:fields.map(f=><FieldRow key={`${kind}-${f.path}-${shipment.revision}`} field={f} kind={kind} shipment={shipment} refresh={refresh}/>)}</div></section></div>
}
export default function ReviewPage(){const {id}=useParams<{id:string}>();const [kind,setKind]=useState<Kind>('invoice');
 useEffect(()=>{const q=new URLSearchParams(window.location.search).get('kind');if(KINDS.includes(q as Kind))setKind(q as Kind)},[]);
 return <PageState id={id}>{(s,refresh)=><><PageIntro eyebrow="HUMAN-IN-THE-LOOP REVIEW" title="Document reviewer" description="Inspect the original source and correct AI-extracted fields side by side." action={<Link href={`/shipments/${id}/checks`} className="btn secondary"><Icon name="alert" size={16}/>{s.validation?.issues.length||0} issue(s)</Link>}/><div className="kind-tabs" aria-label="Select document">{KINDS.map(k=><button type="button" className={k===kind?'active':''} key={k} onClick={()=>{setKind(k);window.history.replaceState(null,'',`?kind=${k}`)}}>{KIND_NAMES[k]}</button>)}</div><Reviewer id={id} kind={kind} shipment={s} refresh={refresh}/></>}</PageState>
}
