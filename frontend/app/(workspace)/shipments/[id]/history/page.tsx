'use client';
import {useEffect,useState} from 'react';
import {useParams} from 'next/navigation';
import {PageState,PageIntro,Loading,Notice,Empty} from '@/components/Elements';
import {api,formatDate} from '@/lib/api';
import type {History} from '@/lib/types';
import {Icon} from '@/components/Icon';
function Timeline({id}:{id:string}){const [data,setData]=useState<History|null>(null),[err,setErr]=useState('');useEffect(()=>{api<History>(`/shipments/${id}/history`).then(setData).catch(e=>setErr(e.message))},[id]);if(err)return <Notice error={err}/>;if(!data)return <Loading/>;
 const events=[...data.edits_and_confirmations.map(e=>({title:e.action.replaceAll('_',' '),description:`${e.document_kind}: ${e.field_path}`,detail:e.reason,date:e.created_at})),...data.approvals.map(e=>({title:'Manager approval',description:`Revision ${e.revision}`,detail:e.comment||'Approved',date:e.created_at})),...data.exports.map(e=>({title:'CSV exported',description:`Revision ${e.revision}`,detail:`SHA-256: ${e.sha256.slice(0,18)}…`,date:e.created_at}))].sort((a,b)=>b.date.localeCompare(a.date));
 return events.length===0?<Empty title="No history yet" description="Uploads, corrections, confirmations, approvals and exports will appear here."/>:<div className="timeline">{events.map((e,i)=><div className="timeline-item" key={i}><span className="timeline-marker"><Icon name="history" size={17}/></span><div className="timeline-body"><strong>{e.title}</strong><span>{e.description}</span><p>{e.detail}</p><small>{formatDate(e.date)}</small></div></div>)}</div>
}
export default function HistoryPage(){const {id}=useParams<{id:string}>();return <PageState id={id}>{s=><><PageIntro eyebrow="AUDITABILITY" title="Decision history" description="Track document uploads, corrections, approvals and exports in chronological order."/><div className="panel"><Timeline id={s.shipment_id}/></div></>}</PageState>}
