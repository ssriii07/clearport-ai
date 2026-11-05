const fs = require('node:fs');
const path = require('node:path');
const root=path.resolve(__dirname,'..');
const shell=fs.readFileSync(path.join(root,'components/Shell.tsx'),'utf8');
const review=fs.readFileSync(path.join(root,'app/(workspace)/shipments/[id]/review/page.tsx'),'utf8');
function ensure(v,reason){if(!v)throw new Error(reason)}
const shipmentLinks=(shell.match(/href=\{`\/shipments\/\$\{current\}/g)||[]).length;
const mobileOnly=(shell.match(/className=\{`mt-mobile-nav-only/g)||[]).length;
ensure(shipmentLinks===6 && mobileOnly===6,'Shipment top-navigation links must be mobile-only (5 deep links + overview)');
ensure(review.includes('Blocking issues') && review.includes('orderedIssues.map'), 'Show every blocking issue prominently');
ensure(review.includes('Awaiting source verification') && review.includes('confirmedFields'), 'Distinct unresolved and confirmed groups required');
ensure(review.includes('linkedFields') && review.includes('sourceAvailable'), 'Keep linked field actions and source checks');
ensure(!review.includes('Needs attention</h3>'), 'Old misleading combined attention header remains');
console.log('Mandatory M6 structural checks passed (desktop nav, mobile nav, review hierarchy and source controls).');
