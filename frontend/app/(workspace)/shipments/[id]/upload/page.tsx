'use client';
import {useState} from 'react';
import {useParams,useRouter} from 'next/navigation';
import {PageState,PageIntro,Notice} from '@/components/Elements';
import {Icon} from '@/components/Icon';
import {KINDS,KIND_NAMES,Kind} from '@/lib/types';
export default function UploadPage(){
 const {id}=useParams<{id:string}>(),router=useRouter();
 const [kind,setKind]=useState<Kind>('invoice'),[file,setFile]=useState<File|null>(null),[busy,setBusy]=useState(false),[err,setErr]=useState('');
 async function upload(revision:number){
   if(!file)return;setBusy(true);setErr('');
   try{
    if(!['application/pdf','image/png','image/jpeg'].includes(file.type))throw new Error('Please select a PDF, PNG or JPEG.');
    if(file.size>6*1024*1024)throw new Error('The maximum supported file size is 6 MB.');
    const form=new FormData();form.set('file',file);
    const response=await fetch(`/api/relay/shipments/${id}/documents/${kind}/upload?expected_revision=${revision}`,{method:'POST',body:form});
    if(response.status===401){window.location.href='/login';return;}
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(payload.detail||`Upload failed (${response.status})`)}
    router.push(`/shipments/${id}/review?kind=${kind}`);router.refresh();
   }catch(e){setErr((e as Error).message)}finally{setBusy(false)}
 }
 return <PageState id={id}>{s=><><PageIntro eyebrow="DOCUMENT INGESTION" title="Upload shipping documents" description="Original files stay private. Gemini returns a reviewable draft, not verified facts."/><div className="two-panels upload-layout"><section className="panel upload-main"><h3 className="panel-title">1. Choose document type</h3><div className="kind-grid">{KINDS.map(k=><button type="button" key={k} className={`kind-option ${kind===k?'selected':''}`} onClick={()=>{setKind(k);setFile(null);setErr('')}}><Icon name="file" size={20}/><span>{KIND_NAMES[k]}</span>{kind===k&&<Icon name="check" size={16}/>}</button>)}</div><h3 className="panel-title more-top">2. Add source file</h3><label className="file-drop"><Icon name="upload" size={28}/><strong>{file?file.name:'Choose PDF or image'}</strong><span>{file?`${(file.size/1024).toFixed(0)} KB selected`:'PDF, JPEG or PNG · 6 MB maximum'}</span><input type="file" accept=".pdf,.png,.jpg,.jpeg,application/pdf,image/png,image/jpeg" onChange={e=>{setFile(e.target.files?.[0]||null);setErr('')}}/></label><Notice error={err}/><button type="button" className="btn primary large" disabled={!file||busy} onClick={()=>void upload(s.revision)}><Icon name="upload" size={17}/>{busy?'Reading with Gemini…':'Upload & extract with AI'}</button>{busy&&<p className="small muted">The AI request may take some time. Do not refresh the page while it processes.</p>}</section><aside className="panel upload-aside"><div className="eyebrow">CURRENT DOCUMENTS</div>{KINDS.map(k=><div className="document-status" key={k}><Icon name="file" size={19}/><div><strong>{KIND_NAMES[k]}</strong><span>{s.documents?.[k]?.status||'Not provided'}</span></div></div>)}<div className="divider"/><h3 className="panel-title">Review controls</h3><p className="muted">Each upload replaces the draft for that document and increments the shipment revision. Any previous manager approval becomes invalid.</p><div className="notice info"><Icon name="shield" size={19}/> This demonstration uses fictional documents. Never use real client files with a free-tier model API.</div></aside></div></>}</PageState>;
}
