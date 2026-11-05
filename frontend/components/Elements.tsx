'use client';
import { useEffect,useState } from 'react';
import Link from 'next/link';
import { useParams,usePathname } from 'next/navigation';
import { Icon } from '@/components/Icon';
import { api } from '@/lib/api';
import type { Shipment } from '@/lib/types';
import {SuspendedContainer} from '@/components/Illustrations';
export function Status({status}:{status:string}){
  const clean=status.toLowerCase().replace(/_/g,' ');
  const c=status==='approved'||status==='exported'?'good':status==='mismatch'?'warn':'neutral';
  return <span className={`status ${c}`}><span className="status-dot"/>{clean}</span>;
}
export function Notice({error,kind='error'}:{error:string;kind?:'error'|'info'|'success'}){return error?<div className={`notice ${kind}`} role={kind==='error'?'alert':'status'}>{error}</div>:null;}
export function Loading({message='Loading shipment data…'}:{message?:string}){return <div className="loading" role="status"><span className="spinner"/>{message}</div>;}
export function Empty({title,description}:{title:string;description:string}){return <div className="empty"><span className="mt-empty-illustration"><SuspendedContainer/></span><h3>{title}</h3><p>{description}</p>{title==='No shipments yet'&&<Link className="btn primary" href="/shipments/new">+ New shipment</Link>}</div>;}
export function useShipment(id:string){
  const [data,setData]=useState<Shipment|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true);
  async function reload(){setLoading(true);setError('');try{setData(await api<Shipment>(`/shipments/${id}`));}catch(e){setError((e as Error).message)}finally{setLoading(false)}}
  useEffect(()=>{void reload();},[id]);
  return {data,setData,error,loading,reload};
}
const tabs=[['','Overview'],['upload','Upload'],['review','Review fields'],['checks','Cross-checks'],['history','History'],['export','Approval & export']];
export function ShipmentHeader({shipment}:{shipment:Shipment}){
  const path=usePathname(), id=shipment.shipment_id;
  return <div className="mt-shipment-chrome"><div className="crumb"><Link href="/shipments"><Icon name="arrow-left" size={15}/> All shipments</Link><span>/</span><span>{id}</span></div><div className="title-row"><div><div className="mt-subtle-label">Shipment · Revision {shipment.revision}</div><h1>{id}</h1><p className="subline">{shipment.importer_name}</p></div><Status status={!shipment.checks_clear&&shipment.blocking_issue_types?.some(c=>c.includes('MISMATCH'))?'mismatch':shipment.status}/></div><nav className="tabs" aria-label="Shipment pages">{tabs.map(([suffix,label])=>{const url=`/shipments/${id}${suffix?`/${suffix}`:''}`;return <Link key={label} href={url} aria-current={path===url?'page':undefined} className={path===url?'active':''}>{label}</Link>})}</nav></div>;
}
export function PageState({id,children}:{id:string;children:(shipment:Shipment,refresh:()=>Promise<void>)=>React.ReactNode}){
  const {data,error,loading,reload}=useShipment(id);
  if(loading&&!data)return <Loading/>;
  if(error&&!data)return <div className="panel"><Notice error={error}/><button className="btn secondary" onClick={()=>void reload()}><Icon name="refresh" size={16}/> Retry</button></div>;
  if(!data)return <Empty title="Shipment unavailable" description="We could not load this shipment."/>;
  return <><ShipmentHeader shipment={data}/>{error&&<Notice error={error}/>}<div className="page-body">{children(data,reload)}</div></>;
}
export function PageIntro({eyebrow,title,description,action}:{eyebrow?:string;title:string;description:string;action?:React.ReactNode}){
  return <div className="section-heading"><div>{eyebrow&&<div className="eyebrow">{eyebrow}</div>}<h2>{title}</h2><p className="muted">{description}</p></div>{action}</div>
}
export function ShipmentLoader(){const p=useParams();return String(p.id||'');}
