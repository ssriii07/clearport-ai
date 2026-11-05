'use client';
import {useState} from 'react';
import {useRouter} from 'next/navigation';
import Link from 'next/link';
import {api} from '@/lib/api';
import {Notice} from '@/components/Elements';
import {Icon} from '@/components/Icon';
import type {Shipment} from '@/lib/types';
export default function NewShipment(){const[importer,setImporter]=useState(''),[busy,setBusy]=useState(false),[error,setError]=useState('');const router=useRouter();
 async function submit(e:React.FormEvent){e.preventDefault();setBusy(true);setError('');try{const s=await api<Shipment>('/shipments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({importer_name:importer})});router.push(`/shipments/${s.shipment_id}/upload`);router.refresh()}catch(e){setError((e as Error).message)}finally{setBusy(false)}}
 return <div className="mt-creation"><Link href="/shipments" className="inline-link"><Icon name="arrow-left" size={16}/> All shipments</Link><h1>New shipment</h1><p>Start by naming the importer, then upload the commercial invoice, packing list and bill of lading.</p><form onSubmit={submit} className="panel"><label htmlFor="importer-name">Importer name</label><input id="importer-name" autoFocus required minLength={2} maxLength={150} value={importer} onChange={e=>setImporter(e.target.value)} placeholder="Fictional Importer Pvt. Ltd."/>{error&&<Notice error={error}/>}<div className="action-row"><button className="btn primary" type="submit" disabled={busy||importer.trim().length<2}>{busy?'Creating…':'Create shipment'} <Icon name="arrow-right" size={16}/></button><Link className="btn secondary" href="/shipments">Cancel</Link></div></form></div>
}
