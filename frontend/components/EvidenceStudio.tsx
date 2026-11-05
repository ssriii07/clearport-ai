'use client';

import {useEffect, useMemo, useState, type CSSProperties} from 'react';
import Link from 'next/link';
import {Icon} from '@/components/Icon';

import {type Kind, type Shipment} from '@/lib/types';
import {fieldLabel} from '@/lib/api';

import {buildSources, titleOf, labelOf, requestText} from '@/lib/evidence';
export default function EvidenceStudio({shipment,onInspect,initialIssue=0}:{shipment:Shipment;onInspect:(kind:Kind,field:string)=>void;initialIssue?:number}) {
  const issues=shipment.validation?.issues||[];
  const [current,setCurrent]=useState(0);
  const [locked,setLocked]=useState(0);
  const [hovered,setHovered]=useState<number|null>(null);
  const [requestOpen,setRequestOpen]=useState(false);
  const [draft,setDraft]=useState('');
  const [toast,setToast]=useState('');
  const [tracing,setTracing]=useState(false);
  useEffect(()=>{setCurrent(Math.max(0,Math.min(initialIssue,(shipment.validation?.issues.length||1)-1)));setLocked(0);setHovered(null);setRequestOpen(false)},[shipment.shipment_id,shipment.revision,initialIssue]);
  const issue=issues[Math.min(current,issues.length-1)];
  const sources=useMemo(()=>issue?buildSources(shipment,issue):[],[shipment,issue]);
  const selectedIndex=Math.min(hovered??locked,Math.max(sources.length-1,0));
  const selected=sources[selectedIndex];
  const values=sources.map(x=>x.value).filter(x=>x!=='Not extracted');
  const distinct=new Set(values.map(v=>v.toLocaleLowerCase().replaceAll(',','').trim()));
  const divergent=distinct.size>1;
  function chooseIssue(index:number){setCurrent(index);setLocked(0);setHovered(null);setRequestOpen(false);setTracing(false)}
  async function copyDraft(){
    try {await navigator.clipboard.writeText(draft);setToast('Request copied. No message was sent.');}
    catch {setToast('Copy unavailable here. Select and copy the draft text manually.');}
  }
  if(!issues.length)return <section className="studio-clear" aria-label="Evidence studio"><span className="studio-clear-icon"><Icon name="check" size={24}/></span><div><div className="eyebrow">EVIDENCE STUDIO</div><h3>Nothing conflicting in the automated checks.</h3><p>AI extraction is still a draft. Verify source documents and obtain manager approval before export.</p></div><Link className="btn secondary" href={`/shipments/${shipment.shipment_id}/export`}>Review release controls <Icon name="arrow-right" size={16}/></Link></section>;
  if(!issue)return null;
  return <section className="evidence-studio" aria-label="Interactive evidence studio">
    <div className="studio-toolbar"><div className="studio-heading"><span className="studio-asterisk" aria-hidden="true">✳</span><div><span className="eyebrow">SIGNATURE WORKSPACE · LIVE SHIPMENT DATA</span><h3>Evidence <em>Studio.</em></h3><p>Follow the contradiction, not just the warning.</p></div></div><div className="studio-count"><span className="pulse-dot"/>{issues.length} blocking {issues.length===1?'check':'checks'} to investigate</div></div>
    <div className="studio-layout">
      <aside className="studio-issues" aria-label="Discrepancy list"><div className="studio-column-head">01 / THE QUESTIONS <span>{String(issues.length).padStart(2,'0')}</span></div><div className="studio-issues-scroll">{issues.map((item,index)=><button type="button" key={`${item.code}-${index}`} onClick={()=>chooseIssue(index)} className={`studio-issue ${index===current?'active':''}`} aria-pressed={index===current}><span className="studio-issue-index">{String(index+1).padStart(2,'0')}</span><strong>{labelOf(item)}</strong><small>{item.message}</small><Icon name="arrow-right" size={16}/></button>)}</div><div className="studio-side-note"><Icon name="shield" size={17}/><span>We never silently resolve source conflicts. Edits are reviewed and audited.</span></div></aside>
      <div className="studio-map" aria-label="Evidence connections"><div className="studio-map-kicker"><span>02 / FOLLOW THE EVIDENCE</span><button type="button" className="studio-replay" onClick={()=>{setTracing(false);requestAnimationFrame(()=>setTracing(true));window.setTimeout(()=>setTracing(false),1700)}}><Icon name="refresh" size={15}/> Replay trace</button></div><h4>{titleOf(issue)}</h4><p>{issue.message}</p><div className={`studio-nodes ${tracing?'tracing':''}`}>
          {sources.map((source,index)=><button type="button" key={source.id} className={`studio-node ${selectedIndex===index?'focused':''}`} onMouseEnter={()=>setHovered(index)} onMouseLeave={()=>setHovered(null)} onFocus={()=>setHovered(index)} onBlur={()=>setHovered(null)} onClick={()=>{setLocked(index);setHovered(null)}} aria-pressed={locked===index}><span className="studio-node-label"><span className="studio-node-dot"/>{source.label}</span><strong>{source.value}</strong><small>{fieldLabel(source.field)}</small>{index===selectedIndex&&<span className="studio-node-spot"/>}</button>)}
          {sources.length>0&&<div className="studio-threads" aria-hidden="true">{sources.map((source,index)=><span key={source.id} className={`studio-thread ${selectedIndex===index?'active':''}`} style={{'--thread-number':index,'--thread-count':sources.length} as CSSProperties}/>)}</div>}
          <div className="studio-judgement"><span className="studio-judgement-symbol">!</span><div><span>HUMAN DECISION REQUIRED</span><strong>{divergent?'Source values disagree':'Validation needs human review'}</strong></div></div>
        </div><div className="studio-map-foot"><span><span className="tiny-glow"/> Inspect a source by hovering or clicking</span><span>Revision {shipment.revision} · no automatic resolution</span></div></div>
      <aside className="studio-inspector" aria-live="polite"><div className="studio-column-head">03 / UNDER THE SURFACE</div>{selected?<><div className="studio-inspector-top"><span className="studio-inspector-number">0{selectedIndex+1}</span><h4>{selected.label}</h4><p>{fieldLabel(selected.field)}</p></div><div className="studio-inspector-value"><span>REPORTED VALUE</span><strong>{selected.value}</strong></div><p className="studio-inspector-explain">{selected.isDocument?(selected.hasOriginal?'An authenticated original is attached. Open it in the document reviewer to verify this value.':'This document has no attached original; do not mark the value source-verified.'):(selected.kind==='calculated'?'This figure was calculated by a deterministic cross-check, not read directly from a PDF.':'This value comes from the shipment master record, not a PDF extraction.')}</p>{selected.isDocument?<button type="button" className="studio-inspect-btn" onClick={()=>onInspect(selected.kind as Kind,selected.field)}><Icon name="eye" size={16}/>{selected.hasOriginal?'Inspect original + field':'Open editable draft'}<Icon name="arrow-right" size={15}/></button>:<div className="studio-inspect-static">{selected.kind==='calculated'?'Calculated by the deterministic validator':'Value from the shipment master record'}</div>}</>:<p className="muted">No individual source location was supplied by this validation rule.</p>}<div className="studio-inspector-bottom"><div className="studio-column-head">WHY IT MATTERS</div><p>{issue.message} The export stays blocked until the underlying issue is resolved and the manager approves the current revision.</p><button type="button" className="studio-request" onClick={()=>{setDraft(requestText(shipment,issue,sources));setRequestOpen(true)}}><Icon name="edit" size={15}/> Draft clarification request</button></div></aside>
    </div>
    <div className="studio-footer"><span><Icon name="shield" size={16}/> Actual cross-check results, not AI-guessed explanations</span><Link href={`/shipments/${shipment.shipment_id}/checks`} className="studio-all-checks">View all checks <Icon name="arrow-right" size={16}/></Link></div>
    {requestOpen&&<div className="studio-modal-overlay" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)setRequestOpen(false)}}><div className="studio-modal" role="dialog" aria-modal="true" aria-labelledby="studio-modal-title"><div className="studio-modal-head"><div><span className="eyebrow">DRAFT ONLY · NOT SENT</span><h3 id="studio-modal-title">Request corrected paperwork</h3></div><button type="button" aria-label="Close draft" className="studio-close" onClick={()=>setRequestOpen(false)}><Icon name="close" size={19}/></button></div><p>Review and copy this draft to contact the importer outside the application. No external message is sent or stored.</p><label className="field-label">Clarification draft<textarea rows={9} value={draft} onChange={e=>setDraft(e.target.value)}/></label><div className="studio-modal-actions"><button type="button" className="btn secondary" onClick={()=>setRequestOpen(false)}>Close</button><button type="button" className="btn primary" onClick={()=>void copyDraft()}>Copy request <Icon name="arrow-right" size={15}/></button></div>{toast&&<p className="small" role="status">{toast}</p>}</div></div>}
  </section>;
}
