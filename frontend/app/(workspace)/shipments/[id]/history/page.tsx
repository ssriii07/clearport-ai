'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {PageState,Loading,Notice,Empty} from '@/components/Elements';
import {api,formatDate} from '@/lib/api';
import type {History,Kind} from '@/lib/types';
import {KIND_NAMES} from '@/lib/types';
import {Icon} from '@/components/Icon';
type Group='all'|'review'|'access'|'approval'|'export';
type Entry={title:string;description:string;detail:string;date:string;group:Group;kind?:string;user?:number;count:number};
const documentName=(s:string)=>KIND_NAMES[s as Kind]||s.replaceAll('_',' ');
function Timeline({id}:{id:string}){const [data,setData]=useState<History|null>(null),[err,setErr]=useState(''),[filter,setFilter]=useState<Group>('all');
 useEffect(()=>{api<History>(`/shipments/${id}/history`).then(setData).catch(e=>setErr(e.message))},[id]);
 if(err)return <div><Notice error={err}/><button className="btn secondary" onClick={()=>window.location.reload()}>Retry</button></div>;
 if(!data)return <Loading message="Loading audit history…"/>;
 const entries:Entry[]=[...data.edits_and_confirmations.map(e=>{
  const access=e.action==='source_view',action=e.action;
  const names:Record<string,string>={source_view:`${documentName(e.document_kind)} viewed`,ai_upload:`${documentName(e.document_kind)} uploaded and extracted`,manual_source:`${documentName(e.document_kind)} saved for manual entry`,manual_entry:`${documentName(e.document_kind)} entered manually`,edit:'Field corrected',confirmed:'Field confirmed'};
  return {title:names[action]||action.replaceAll('_',' '),description:access?`Source access recorded · ${documentName(e.document_kind)}`:e.field_path==='*'?documentName(e.document_kind):`${documentName(e.document_kind)} · ${e.field_path.replaceAll('_',' ')}`,detail:access?'Authenticated view of the original document':e.reason,date:e.created_at,group:access?'access' as Group:'review' as Group,kind:e.document_kind,user:e.user_id,count:1};
 }),...data.approvals.map(e=>({title:'Manager approved revision',description:`Revision ${e.revision}`,detail:e.comment||'Approved',date:e.created_at,group:'approval' as Group,user:e.user_id,count:1})),...data.exports.map(e=>({title:'CSV exported',description:`Revision ${e.revision}`,detail:`Integrity hash: ${e.sha256.slice(0,16)}…`,date:e.created_at,group:'export' as Group,user:e.user_id,count:1}))].sort((a,b)=>b.date.localeCompare(a.date));
 const grouped:Entry[]=[];for(const event of entries){const last=grouped[grouped.length-1];const near=last&&Math.abs(new Date(event.date).getTime()-new Date(last.date).getTime())<10*60_000;
  if(event.group==='access'&&last?.group==='access'&&near&&last.kind===event.kind&&last.user===event.user){last.count++;continue;}grouped.push({...event});}
 const shown=grouped.filter(e=>filter==='all'||e.group===filter);
 return <><div className="mt-history-toolbar"><label htmlFor="audit-filter">Show events</label><select id="audit-filter" value={filter} onChange={e=>setFilter(e.target.value as Group)}><option value="all">All activity</option><option value="review">Uploads, corrections and confirmations</option><option value="access">Source access</option><option value="approval">Manager approvals</option><option value="export">CSV exports</option></select><span>{entries.length} original audit records retained</span></div>
 {shown.length===0?<Empty title="No matching events" description="Choose another event type to see the activity history."/>:<div className="timeline">{shown.map((e,i)=><div className="timeline-item" key={`${e.date}-${i}`}><span className="timeline-marker"><Icon name="history" size={17}/></span><div className="timeline-body"><strong>{e.title}{e.count>1?` · ${e.count} views`:''}</strong><span>{e.description}</span><p>{e.detail}</p><small>{formatDate(e.date)}{e.user!==undefined?` · ${data.actors?.[String(e.user)]?.email||`User #${e.user}`} (${data.actors?.[String(e.user)]?.role||'user'})`:''}</small></div></div>)}</div>}</>;
}
export default function HistoryPage(){const {id}=useParams<{id:string}>();return <PageState id={id}>{s=><div className="mt-history-page"><div className="mt-compact-intro"><h2>Decision history</h2><p>Uploads, verifications, corrections, approvals and exports, with full source-access records retained.</p></div><div className="panel"><Timeline id={s.shipment_id}/></div></div>}</PageState>}
