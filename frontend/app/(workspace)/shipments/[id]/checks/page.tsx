'use client';
import Link from 'next/link';
import {useParams} from 'next/navigation';
import {PageState} from '@/components/Elements';
import {Icon} from '@/components/Icon';
import {Kind,KINDS,KIND_NAMES,Issue} from '@/lib/types';
const title=(code:string)=>code.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
function comparison(issue:Issue){const numeric=issue.code==='GROSS_WEIGHT_MISMATCH'||issue.code==='PACKAGE_MISMATCH';const values=Object.entries(issue.details||{});
 return <div className="mt-issue-values">{values.map(([key,value])=>{const number=Number(value);const display=numeric&&Number.isFinite(number)?`${number.toLocaleString('en-IN')}${issue.code==='GROSS_WEIGHT_MISMATCH'?' kg':' packages'}`:String(value);
 const label=KINDS.includes(key as Kind)?KIND_NAMES[key as Kind]:key==='invoice_buyer'?'Invoice buyer':key==='shipment_importer'?'Shipment record importer':key.replaceAll('_',' ');
 return <div key={key}><small>{label}</small><strong>{display}</strong></div>})}</div>;
}
export default function Checks(){const{id}=useParams<{id:string}>();return <PageState id={id}>{s=><div className="mt-checks-page"><div className="mt-compact-intro"><h2>Cross-document checks</h2><p>Deterministic checks compare the original document values. Conflicts require human resolution.</p></div>
 {s.checks_clear?<div className="notice success"><Icon name="check" size={18}/> All automatic checks passed. Manager approval of this revision is still required for export.</div>:<div className="notice info"><Icon name="alert" size={18}/> {s.validation?.issues.length||0} blocking issues. Resolve the source discrepancies before manager approval or export.</div>}
 <div className="issue-stack">{s.validation?.issues.map((issue,index)=>{const loc=issue.locations?.[0]||'invoice.invoice_number';const k=loc.split('.')[0] as Kind;const safe=KINDS.includes(k)?k:'invoice';const field=loc.split('.').slice(1).join('.');return <section className="issue-card mt-compact-issue" key={`${issue.code}-${index}`}><span className="issue-icon"><Icon name="alert" size={20}/></span><div className="issue-content"><div className="issue-top"><strong>{title(issue.code)}</strong><span className="mt-status mismatch"><span className="mt-dot"/>Mismatch</span></div><p>{issue.message}</p>{comparison(issue)}
 {issue.code==='BUYER_IMPORTER_MISMATCH'&&<p className="mt-help-text">The buyer was read from the commercial invoice; the importer comes from the shipment record, not another PDF. Check the shipment identity before changing any source value.</p>}
 {issue.code==='GROSS_WEIGHT_MISMATCH'&&<p className="mt-help-text">The source weights differ by {Math.max(...Object.values(issue.details).map(Number).filter(Number.isFinite))-Math.min(...Object.values(issue.details).map(Number).filter(Number.isFinite))} kg. If the actual documents disagree, request corrected paperwork—do not change correct source values just to pass validation.</p>}
 <div className="mt-resolution-actions"><Link className="btn secondary" href={`/shipments/${id}/review?kind=${safe}&field=${encodeURIComponent(field)}`}><Icon name="eye" size={16}/> Inspect evidence</Link><Link className="inline-link" href={`/shipments/${id}/review?kind=${safe}`}>Review original <Icon name="arrow-right" size={16}/></Link></div></div></section>})}</div>
 {!s.checks_clear&&<p className="mt-help-text mt-checks-help">Correct an AI transcription only if the original supports the correction. If the PDFs themselves disagree, request a corrected document and upload it. Every edit is audited; no conflict is silently waived.</p>}
 {s.checks_clear&&<Link href={`/shipments/${id}/export`} className="btn primary">Continue to approval <Icon name="arrow-right" size={16}/></Link>}</div>}</PageState>}
