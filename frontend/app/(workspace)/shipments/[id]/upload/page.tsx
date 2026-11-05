'use client';
import Link from 'next/link';
import {useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {PageState,Notice} from '@/components/Elements';
import {Icon} from '@/components/Icon';
import {KINDS,KIND_NAMES,Kind,Shipment} from '@/lib/types';

export default function UploadPage(){
 const{id}=useParams<{id:string}>();const router=useRouter();
 const[files,setFiles]=useState<Partial<Record<Kind,File>>>({}),[processing,setProcessing]=useState<Kind|null>(null),[error,setError]=useState(''),[failed,setFailed]=useState<Kind|null>(null),[done,setDone]=useState<Kind[]>([]);
 function select(kind:Kind,file:File|null){setFiles(previous=>({...previous,[kind]:file||undefined}));setError('');setFailed(null)}
 async function upload(s:Shipment,refresh:()=>Promise<void>){let revision=s.revision;setError('');setFailed(null);setDone([]);
  const selected=KINDS.filter(kind=>Boolean(files[kind]));
  for(const kind of selected){const file=files[kind]!;
   if(!['application/pdf','image/png','image/jpeg'].includes(file.type)||file.size>6*1024*1024){setError(`${KIND_NAMES[kind]}: use a PDF, PNG or JPEG up to 6 MB.`);setFailed(kind);return}
   setProcessing(kind);const data=new FormData();data.set('file',file);
   try{const response=await fetch(`/api/relay/shipments/${id}/documents/${kind}/upload?expected_revision=${revision}`,{method:'POST',body:data});
    if(response.status===401){window.location.href='/login';return}
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.detail||`${KIND_NAMES[kind]} extraction failed (${response.status})`)}
    const updated=(await response.json()) as Shipment;revision=updated.revision;
    setDone(old=>[...old,kind]);setFiles(old=>({...old,[kind]:undefined}));
   }catch(e){setError(`${KIND_NAMES[kind]} couldn't be processed: ${(e as Error).message}. Retry this file or save its source for manual entry.`);setFailed(kind);setProcessing(null);await refresh();return}
  }
  setProcessing(null);await refresh();router.push(`/shipments/${id}/review`);router.refresh();
 }
 return <PageState id={id}>{(s,refresh)=><div className="mt-upload"><div className="mt-heading-row"><div><h2>Upload documents</h2><p>Upload the invoice, packing list and bill of lading. The AI reads each original to create a reviewable draft.</p></div></div>
 <p className="mt-upload-guidance">Accepted: PDF, PNG, JPEG · Maximum 6 MB per document · Scans and photos supported</p>
 <div className="mt-upload-slots">{KINDS.map((kind,i)=>{const f=files[kind];const doc=s.documents?.[kind];const isReading=processing===kind;return <label key={kind} className={`mt-upload-slot ${f?'has-file':''} ${isReading?'mt-reading':''}`}><span className="mt-upload-number">0{i+1}</span><Icon name="file" size={25}/><strong>{KIND_NAMES[kind]}</strong>
  <span className="mt-slot-state mt-upload-filename" title={f?.name||doc?.original_name||''}>{f?`${f.name} · ${(f.size/1024/1024).toFixed(2)} MB`:doc?.source_available?(doc.original_name||'Original attached'):'No original uploaded'}</span>
  <span className={`mt-upload-file-state ${done.includes(kind)?'ok':''}`}>{isReading?'Reading with AI…':done.includes(kind)?'Extraction complete':doc?.status==='manual_verified'?'Manual entry saved':doc?.status==='extracted'?'Extracted':doc?.status==='unreadable'?'Needs manual entry':'Ready for upload'}</span>
  <span className="mt-file-control">{f?'Change selection':doc?.source_available?'Replace document':'Choose file'}</span>
  <input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" aria-label={`Upload ${KIND_NAMES[kind]}`} disabled={Boolean(processing)} onChange={e=>select(kind,e.target.files?.[0]||null)}/></label>})}</div>
 <div className="mt-upload-bottom"><div><h3>AI extraction</h3><p>Selected documents are processed one at a time. No generated values are presented as verified until a human reviews the source.</p></div><button className="btn primary large" type="button" disabled={!!processing||!Object.values(files).some(Boolean)} onClick={()=>void upload(s,refresh)}><Icon name={processing?'refresh':'upload'} size={18}/>{processing?`Reading ${KIND_NAMES[processing]}…`:'Upload and extract'}</button></div>
 {processing&&<div className="mt-progress-msg" role="status"><span className="spinner"/> Reading {KIND_NAMES[processing]} with AI. Actual processing time depends on document quality; this is not a simulated percentage.</div>}
 {error&&<div className="mt-upload-error"><Notice error={error}/>{failed&&<div className="mt-error-actions"><button className="btn secondary" type="button" onClick={()=>void upload(s,refresh)}>Retry extraction</button><Link className="btn secondary" href={`/shipments/${id}/manual?kind=${failed}`}>Enter manually instead <Icon name="arrow-right" size={15}/></Link></div>}</div>}
 <div className="mt-upload-manual"><span>Document unreadable or AI unavailable?</span><div>{KINDS.map(k=><Link key={k} href={`/shipments/${id}/manual?kind=${k}`}>Enter {KIND_NAMES[k].toLowerCase()} manually</Link>)}</div></div>
 <p className="mt-privacy-note">Fictional documents only. Private source access is audited.</p></div>}</PageState>;
}
