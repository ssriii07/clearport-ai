/* Lightweight review-map mapping tests. Run: npm run test:evidence */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const path=require('node:path');
const ts=require('typescript');
const root=path.resolve(__dirname,'..');
const cache=new Map();
function load(rel){
 const resolved=path.join(root,rel);
 if(cache.has(resolved))return cache.get(resolved).exports;
 const module={exports:{}};cache.set(resolved,module);
 const source=fs.readFileSync(resolved,'utf8');
 const output=ts.transpileModule(source,{fileName:resolved,compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText;
 const localRequire=spec=>{
   if(spec.startsWith('@/'))return load(spec.slice(2)+'.ts');
   throw new Error('Unexpected dependency: '+spec);
 };
 const wrap=vm.runInThisContext('(function(require,module,exports){'+output+'\n})',{filename:resolved});
 wrap(localRequire,module,module.exports);
 return module.exports;
}
const {buildSources,requestText,getPath}=load('lib/evidence.ts');
const seed=JSON.parse(fs.readFileSync(path.resolve(root,'../backend/seed/shipments.json'),'utf8'))[0];
const shipment={...seed,revision:3,validation:{issues:[]}};
shipment.documents.invoice.source_available=true;
shipment.documents.packing_list.source_available=true;
shipment.documents.bill_of_lading.source_available=true;
const weights={code:'GROSS_WEIGHT_MISMATCH',message:'Weight differs',severity:'blocking',locations:['invoice.gross_weight_kg','packing_list.gross_weight_kg','bill_of_lading.gross_weight_kg'],details:{}};
let nodes=buildSources(shipment,weights);
assert.deepEqual(nodes.map(x=>x.value),['3120','3165','3120']);
assert.deepEqual(nodes.map(x=>x.kind),['invoice','packing_list','bill_of_lading']);
assert.equal(nodes.every(x=>x.hasOriginal),true);
const buyer={code:'BUYER_IMPORTER_MISMATCH',message:'Buyer differs',severity:'blocking',locations:['invoice.buyer_name'],details:{}};
shipment.documents.invoice.extracted.buyer_name='Eastbridge Imports Pvt. Ltd. (India)';
nodes=buildSources(shipment,buyer);
assert.equal(nodes.length,2);
assert.equal(nodes[0].value,'Eastbridge Imports Pvt. Ltd. (India)');
assert.equal(nodes[1].value,'Example Importer India Pvt Ltd');
assert.equal(nodes[1].isDocument,false);
assert.match(requestText(shipment,buyer,nodes),/No value will be changed or cleared/);
shipment.documents.invoice.source_available=false;
assert.equal(buildSources(shipment,buyer)[0].hasOriginal,false);
const missing={code:'MISSING_DOCUMENT',message:'No invoice',severity:'blocking',locations:['invoice'],details:{}};
assert.equal(buildSources(shipment,missing).length,0);
assert.equal(getPath(shipment.documents.invoice.extracted,'line_items[0].hsn_code'),'9405 11 00');
console.log('Evidence mapping checks passed (source values, identity conflict, provenance, missing source, line items, draft wording).');
