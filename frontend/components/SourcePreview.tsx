'use client';
import {useEffect,useRef,useState} from 'react';
import {createPortal} from 'react-dom';
import {Icon} from '@/components/Icon';
import type {Kind} from '@/lib/types';
import {KIND_NAMES} from '@/lib/types';

type Props={shipmentId:string;kind:Kind;highlightField?:string;expandLabel?:string};
/** Authenticated, source-only PDF/image viewer. No stored original is modified.
 * Mobile PDFs are rendered as paged images by the authenticated backend, rather
 * than relying on mobile browsers to respect the PDF iframe's #zoom parameter.
 */
export function SourcePreview({shipmentId,kind,highlightField='',expandLabel='Expand document'}:Props){
 const [source,setSource]=useState(''),[mime,setMime]=useState(''),[busy,setBusy]=useState(true),[error,setError]=useState('');
 const [located,setLocated]=useState<boolean|null>(null),[page,setPage]=useState(1),[pageCount,setPageCount]=useState(1);
 const [zoom,setZoom]=useState(100),[expanded,setExpanded]=useState(false),[isMobile,setIsMobile]=useState(false);
 const [raster,setRaster]=useState(''),[rasterBusy,setRasterBusy]=useState(false),[rasterError,setRasterError]=useState('');
 const closeRef=useRef<HTMLButtonElement>(null);
 const isPdf=mime.includes('pdf');

 useEffect(()=>{
  const media=window.matchMedia('(max-width:760px)');
  function update(){setIsMobile(media.matches);if(media.matches)setZoom(z=>Math.max(200,z))}
  update();media.addEventListener('change',update);
  return()=>media.removeEventListener('change',update);
 },[]);
 useEffect(()=>{
  let active=true;let objectUrl='';setBusy(true);setError('');setSource('');setLocated(null);setPageCount(1);setPage(1);
  const endpoint=`/api/relay/shipments/${encodeURIComponent(shipmentId)}/documents/${kind}/file${highlightField?`?highlight_field=${encodeURIComponent(highlightField)}`:''}`;
  fetch(endpoint,{cache:'no-store'}).then(async response=>{
   if(!response.ok){let problem='Original document could not be opened.';try{const data=await response.json();if(typeof data.detail==='string')problem=data.detail}catch{}throw new Error(problem)}
   const found=response.headers.get('x-evidence-found');const foundPage=Number(response.headers.get('x-evidence-page')||1);
   const blob=await response.blob();if(!active)return;
   objectUrl=URL.createObjectURL(blob);setSource(objectUrl);setMime(blob.type||response.headers.get('content-type')||'');
   setLocated(highlightField?found==='true':null);setPage(Number.isFinite(foundPage)&&foundPage>0?foundPage:1);
  }).catch(e=>{if(active)setError((e as Error).message)}).finally(()=>{if(active)setBusy(false)});
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[shipmentId,kind,highlightField]);

 // The image-only mobile fallback renders one high-resolution PDF page at a time.
 // Controls magnify the rendered image itself, not an unreliable PDF URL fragment.
 useEffect(()=>{
  if(!isMobile||!source||!isPdf){setRaster('');return;}
  let active=true;let objectUrl='';setRasterBusy(true);setRasterError('');setRaster('');
  const params=new URLSearchParams({page:String(page)});
  if(highlightField)params.set('highlight_field',highlightField);
  fetch(`/api/relay/shipments/${encodeURIComponent(shipmentId)}/documents/${kind}/preview-page?${params}`,{cache:'no-store'})
   .then(async response=>{
    if(!response.ok){const payload=await response.json().catch(()=>({}));throw new Error(typeof payload.detail==='string'?payload.detail:'Cannot render this PDF page. Open the original in a new tab.');}
    const count=Number(response.headers.get('x-page-count')||1);
    const blob=await response.blob();if(!active)return;
    objectUrl=URL.createObjectURL(blob);setRaster(objectUrl);
    if(Number.isInteger(count)&&count>0)setPageCount(count);
   })
   .catch(e=>{if(active)setRasterError((e as Error).message)})
   .finally(()=>{if(active)setRasterBusy(false)});
  return()=>{active=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[isMobile,source,isPdf,shipmentId,kind,highlightField,page]);

 useEffect(()=>{
  if(!expanded)return;
  const previousOverflow=document.body.style.overflow;
  document.body.style.overflow='hidden';closeRef.current?.focus();
  function onKey(event:KeyboardEvent){if(event.key==='Escape')setExpanded(false)}
  document.addEventListener('keydown',onKey);
  return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey)};
 },[expanded]);

 const minZoom=isMobile?100:75,maxZoom=isMobile?300:250,step=isMobile?50:25;
 const zoomOut=()=>setZoom(z=>Math.max(minZoom,z-step));
 const zoomIn=()=>setZoom(z=>Math.min(maxZoom,z+step));
 const displayed=source&&isPdf?`${source}#page=${page}&zoom=${zoom}`:source;
 const pageControls=isPdf&&isMobile&&source?<div className="mt-preview-page-controls" role="group" aria-label="PDF page navigation">
  <button type="button" className="btn secondary small" disabled={page<=1||rasterBusy} onClick={()=>setPage(p=>Math.max(1,p-1))} aria-label="Previous PDF page">Previous</button>
  <span aria-live="polite">Page {page} of {pageCount}</span>
  <button type="button" className="btn secondary small" disabled={page>=pageCount||rasterBusy} onClick={()=>setPage(p=>Math.min(pageCount,p+1))} aria-label="Next PDF page">Next</button>
 </div>:null;
 const viewer=(full:boolean)=><div className={`mt-preview-document ${full?'mt-preview-full':''} ${isMobile?'mt-preview-pannable':''}`}>
  {busy?<p role="status">Opening original source…</p>:error?<p role="alert">{error}</p>:
   isPdf&&isMobile?(rasterBusy?<p role="status">Rendering page {page}…</p>:rasterError?<p role="alert">{rasterError} Use “Open in tab” if this document cannot be rendered.</p>:
    raster?<img className="mt-preview-raster" src={raster} alt={`Original ${KIND_NAMES[kind]}, page ${page} of ${pageCount}`} draggable={false} style={{width:`${zoom}%`}}/>:<p>Page preview unavailable.</p>):
   isPdf?<iframe key={`${displayed}-${full?'full':'inline'}`} title={`${KIND_NAMES[kind]} original PDF`} src={displayed}/>:
   source?<img className={isMobile?'mt-preview-raster':''} src={source} alt={`${KIND_NAMES[kind]} original source`} draggable={false} style={isMobile?{width:`${zoom}%`}:undefined}/>:
   <p>No original document is available.</p>}
 </div>;
 const actions=<div className="mt-preview-actions" role="group" aria-label="Document zoom and viewing options">
  <button type="button" className="btn secondary small" onClick={zoomOut} disabled={!source||zoom<=minZoom||(!isPdf&&!isMobile)} aria-label="Zoom out">−</button>
  <span className="mt-preview-zoom" aria-live="polite">{zoom}%</span>
  <button type="button" className="btn secondary small" onClick={zoomIn} disabled={!source||zoom>=maxZoom||(!isPdf&&!isMobile)} aria-label="Zoom in">+</button>
  <button type="button" className="btn secondary small" onClick={()=>setExpanded(true)} disabled={!source}><Icon name="eye" size={16}/>{expandLabel}</button>
  {source&&<a className="btn secondary small" href={displayed} target="_blank" rel="noopener noreferrer" aria-label="Open original document in a new tab">Open in tab <Icon name="arrow-right" size={14}/></a>}
 </div>;
 return <div className="mt-source-preview">
  <div className="mt-source-preview-bar"><strong>Original {KIND_NAMES[kind].toLowerCase()}</strong>{actions}</div>
  {highlightField&&located!==null&&<p className={`mt-source-result ${located?'found':''}`}>{located?'Matching source text located; examine the highlighted page.':'Precise evidence location unavailable. Check the original; scans may not have searchable text.'}</p>}
  {viewer(false)}{pageControls}
  {isMobile&&isPdf&&source&&<p className="mt-preview-mobile-tip">The page starts enlarged for readability. Swipe inside the document to pan; use − to fit more on screen.</p>}
  {expanded&&createPortal(<div className="mt-preview-overlay" role="dialog" aria-modal="true" aria-label={`Expanded ${KIND_NAMES[kind]}`}>
   <div className="mt-preview-dialog"><div className="mt-preview-overlay-head"><strong>{KIND_NAMES[kind]} · Original source</strong>
    <div className="mt-preview-actions"><button className="btn secondary small" type="button" onClick={zoomOut} disabled={zoom<=minZoom||(!isPdf&&!isMobile)} aria-label="Zoom out in expanded view">−</button><span className="mt-preview-zoom">{zoom}%</span><button className="btn secondary small" type="button" onClick={zoomIn} disabled={zoom>=maxZoom||(!isPdf&&!isMobile)} aria-label="Zoom in in expanded view">+</button><button ref={closeRef} type="button" className="btn primary" onClick={()=>setExpanded(false)}>Close <Icon name="close" size={16}/></button></div>
   </div>{viewer(true)}{pageControls}<p className="mt-preview-hint">{isMobile?'Zoom with + or − and swipe to pan; use Previous/Next for multipage PDFs.':'Use the built-in PDF toolbar or open the original in a new tab.'}</p></div>
  </div>,document.body)}
 </div>;
}
