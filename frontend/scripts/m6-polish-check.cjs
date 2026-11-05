// Dependency-free, structural regression checks for final Milestone 6 refinements.
// These supplement (not replace) TypeScript, Next.js build, and real browser checks.
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
function file(p){return fs.readFileSync(path.join(root,p),'utf8')}
function requireIncludes(filename,phrases){const text=file(filename);for(const phrase of phrases){if(!text.includes(phrase))throw Error(`${filename}: missing ${phrase}`)}}
requireIncludes('app/(workspace)/shipments/[id]/manual/page.tsx', ['SourcePreview','mt-manual-workspace','mt-manual-mobile-switch','data-mobile-view','isDate','convertValue','mt-manual-confirm','invoiceMismatch','Save verified manual entry']);
requireIncludes('components/SourcePreview.tsx',['/api/relay/shipments/','URL.revokeObjectURL','createPortal','Open in tab','aria-modal','Esc','zoom','preview-page','mt-preview-pannable','pageCount']);
requireIncludes('app/(workspace)/shipments/[id]/review/page.tsx',['SourcePreview','manual_verified','Document details','Line items','mt-review-sticky']);
requireIncludes('app/(workspace)/shipments/[id]/upload/page.tsx',['mt-upload-filename','mt-upload-file-state','Enter ','Reading ','Retry extraction']);
requireIncludes('app/(workspace)/shipments/[id]/history/page.tsx',['data.actors','mt-history-toolbar','Source access','Manager approvals']);
requireIncludes('components/Shell.tsx',['New shipment','/history','Overview','setOpen(false)']);
requireIncludes('app/(workspace)/shipments/page.tsx',['mt-revision-prefix','mt-shipment-skeleton']);
requireIncludes('app/(workspace)/shipments/page.tsx',["status==='Mismatch'","status==='Needs review'"]);
requireIncludes('app/manifest-theme.css',['mt-manual-workspace','mt-manual-source-side','mt-preview-overlay','mt-upload-filename','mt-shipment-skeleton','prefers-reduced-motion','mt-history-toolbar select','scroll-behavior:auto!important']);
requireIncludes('app/api/relay/[...path]/route.ts',['x-page-count','x-page-number']);
requireIncludes('app/manifest-theme.css',['mt-preview-page-controls','mt-preview-raster','font-size:max(14px,1em)']);
console.log('Milestone 6 structural checks passed (source preview, mobile, audit, upload, loading and safeguards).');
