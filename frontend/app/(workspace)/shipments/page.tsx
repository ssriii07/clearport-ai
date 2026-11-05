'use client';
import Link from 'next/link';
import {useEffect,useState} from 'react';
import {api} from '@/lib/api';
import type {Shipment} from '@/lib/types';
import {Icon} from '@/components/Icon';
import {Notice,Empty} from '@/components/Elements';
type Filter='all'|'review'|'approval'|'ready';
function shipmentState(s:Shipment){if(!s.checks_clear)return s.blocking_issue_types?.some(code=>code.includes('MISMATCH'))?'Mismatch':'Needs review';if(!s.approved_current_revision)return 'Needs review';return s.status==='exported'?'Exported':'Approved';}
export default function Shipments(){
 const[list,setList]=useState<Shipment[]>([]),[busy,setBusy]=useState(true),[err,setErr]=useState(''),[search,setSearch]=useState(''),[filter,setFilter]=useState<Filter>('all');
 async function load(){setBusy(true);setErr('');try{setList(await api<Shipment[]>('/shipments'))}catch(e){setErr((e as Error).message)}finally{setBusy(false)}}
 useEffect(()=>{void load()},[]);
 const filtered=list.filter(s=>`${s.shipment_id} ${s.importer_name} ${s.supplier_name||''}`.toLowerCase().includes(search.toLowerCase()))
 .filter(s=>{const status=shipmentState(s);return filter==='all'||(filter==='review'&&status==='Mismatch')||(filter==='approval'&&status==='Needs review')||(filter==='ready'&&(status==='Approved'||status==='Exported'));});
 return <section className="mt-list-page"><div className="mt-heading-row"><div><h1>Shipments</h1><p>Review documents, resolve discrepancies and prepare verified data for export.</p></div><Link className="btn primary" href="/shipments/new"><Icon name="upload" size={17}/> New shipment</Link></div>
 <div className="mt-list-toolbar"><div className="search-box"><Icon name="search" size={17}/><input aria-label="Search shipments" value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search shipment or importer"/></div><label className="mt-filter-label">Status <select aria-label="Filter by status" value={filter} onChange={e=>setFilter(e.target.value as Filter)}><option value="all">All</option><option value="review">Mismatch</option><option value="approval">Needs review</option><option value="ready">Approved or exported</option></select></label><button type="button" className="btn secondary" onClick={()=>void load()} disabled={busy}><Icon name="refresh" size={16}/> Refresh</button></div>
 {err&&<Notice error={err}/>}
 {busy?<div className="mt-list-loading mt-shipment-skeleton" role="status" aria-label="Loading shipments"><div className="mt-skeleton-heading"/><div className="mt-skeleton-row"/><div className="mt-skeleton-row"/><div className="mt-skeleton-row"/><span className="sr-only">Loading shipments…</span></div>:filtered.length===0?<Empty title={list.length?'No matching shipments':'No shipments yet'} description={list.length?'Try a different search or status filter.':'Upload your first set of documents to see AI extraction and cross-checks in action.'}/>:<div className="mt-table-wrap"><table className="mt-shipment-table"><thead><tr><th>Shipment ID</th><th>Supplier</th><th>Importer</th><th>Status</th><th>Revision</th><th><span className="sr-only">Open</span></th></tr></thead><tbody>{filtered.map(s=><tr key={s.shipment_id}><td><Link className="table-link" href={`/shipments/${s.shipment_id}`}>{s.shipment_id}</Link></td><td>{s.supplier_name||'—'}</td><td>{s.importer_name}</td><td><span className={`mt-status ${shipmentState(s)==='Mismatch'?'mismatch':['Approved','Exported'].includes(shipmentState(s))?'confirmed':'needs'}`}><span className="mt-dot"/>{shipmentState(s)}</span></td><td><span className="mt-revision-prefix">Revision </span>{s.revision}</td><td><Link className="mt-table-open" aria-label={`Open ${s.shipment_id}`} href={`/shipments/${s.shipment_id}/review`}><Icon name="arrow-right" size={18}/></Link></td></tr>)}</tbody></table></div>}
</section>
}
