'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {PageState,Notice} from '@/components/Elements';
import {api} from '@/lib/api';
import {Icon} from '@/components/Icon';
import type {Role,Shipment} from '@/lib/types';
function Actions({s,refresh}:{s:Shipment;refresh:()=>Promise<void>}){
 const id=s.shipment_id,revision=s.revision,checks=s.checks_clear,approved=s.approved_current_revision;
 const [role,setRole]=useState<Role|null>(null),[comment,setComment]=useState('Reviewed sample documents and the automatic cross-check report.'),[busy,setBusy]=useState(false),[error,setError]=useState(''),[success,setSuccess]=useState('');
 useEffect(()=>{api<{role:Role}>('/auth/me').then(u=>setRole(u.role)).catch(()=>{})},[]);
 async function approve(){setBusy(true);setError('');setSuccess('');try{await api(`/shipments/${id}/approve`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({expected_revision:revision,comment})});setSuccess('Manager approval recorded for this revision.');await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 async function exportCsv(){setBusy(true);setError('');setSuccess('');try{const r=await fetch(`/api/relay/shipments/${id}/export`,{method:'POST'});if(!r.ok){const d=await r.json().catch(()=>({}));throw new Error(d.detail||'Export failed')}const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`${id}.csv`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);setSuccess('CSV downloaded successfully.');await refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 const count=s.validation?.issues.length||0;const numberDocs=Object.keys(s.documents||{}).length;const noSource=Object.values(s.documents||{}).some(d=>d&&!d.source_available);
 return <><div className="mt-compact-intro"><h2>Approval & export</h2><p>Release only after automatic checks pass and the documentation manager approves the current revision.</p></div>
 <div className={`mt-release-status ${checks?'ok':'blocking'}`}>{checks?<><Icon name="check" size={19}/> Automatic checks passed. {approved?'Approved for CSV export.':'Manager approval required.'}</>:<><Icon name="alert" size={19}/> Resolve {count} blocking {count===1?'issue':'issues'} before requesting manager approval. <Link href={`/shipments/${id}/checks`}>Review issues <Icon name="arrow-right" size={15}/></Link></>}</div>
 <div className="mt-release-checklist" aria-label="Release readiness"><div><Icon name={numberDocs===3?'check':'alert'} size={17}/><span>Document records</span><strong>{numberDocs}/3</strong></div><div><Icon name={checks?'check':'alert'} size={17}/><span>Cross-checks</span><strong>{checks?'Passed':'Blocked'}</strong></div><div><Icon name={approved?'check':'clock'} size={17}/><span>Manager sign-off</span><strong>{approved?'Approved':'Pending'}</strong></div></div>
 <div className="two-panels mt-export-panels"><section className="panel"><h3 className="panel-title">Manager sign-off</h3><p className="muted">Approval is tied to revision {revision}. Editing a document invalidates that approval.</p>
 {role==='manager'&&!approved&&checks?<><label className="field-label">Approval note<textarea value={comment} onChange={e=>setComment(e.target.value)} maxLength={500} rows={2}/></label><button className="btn primary" disabled={busy} onClick={()=>void approve()}><Icon name="shield" size={17}/> {busy?'Approving…':'Approve revision'}</button></>:approved?<div className="success-line"><Icon name="check" size={20}/> Current revision approved</div>:role==='executive'?<div className="notice info">Only a manager can approve. Resolve checks, then sign in with the manager account to sign off.</div>:!checks?<p className="muted">Approval unavailable until discrepancies are resolved.</p>:<p>Checking your role…</p>}</section>
 <section className="panel"><h3 className="panel-title">CSV export</h3><p className="muted">Uses an explicitly assumed filing-software import layout, not an official customs schema.</p>
 <button className="btn primary" title={!checks?'Resolve blocking discrepancies first':!approved?'Manager approval is required for the current revision':''} disabled={busy||!checks||!approved} onClick={()=>void exportCsv()}><Icon name="download" size={17}/>{busy?'Working…':'Download verified CSV'}</button>
 {!checks&&<Link className="inline-link small" href={`/shipments/${id}/checks`}>Review blocking issues <Icon name="arrow-right" size={15}/></Link>}
 </section></div>
 {noSource&&<p className="mt-demo-limitation">Demo limitation: one or more seeded document records have no original attached. Automatic checks and revision approval are demonstrable, but those documents cannot be confirmed from source without uploading originals.</p>}
 <Notice error={error}/><Notice error={success} kind="success"/></>;
}
export default function ExportPage(){const{id}=useParams<{id:string}>();return <PageState id={id}>{(s,refresh)=><Actions s={s} refresh={refresh}/>}</PageState>}
