// A small scope check for the native select controls and their shared CSS.
// Does not replace browser visual testing or npm run build.
const fs = require('fs');
const path = require('path');
const root = path.join(__dirname,'..');
const read = name => fs.readFileSync(path.join(root,name),'utf8');
const pages = [
  'app/(workspace)/shipments/page.tsx',
  'app/(workspace)/shipments/[id]/history/page.tsx',
];
for (const page of pages) {
  if (!read(page).includes('<select')) throw new Error(`Missing dropdown on ${page}`);
}
const css = read('app/manifest-theme.css');
for (const item of [
  ':where(.mt-shell, .mt-login) select:not([multiple]):not([size])',
  '-webkit-appearance: none', 'appearance: none',
  'background-position: right 18px center',
  'background-repeat: no-repeat', 'padding-right: 48px !important',
  'focus',
]) if (!css.includes(item)) throw new Error(`Missing shared dropdown styling: ${item}`);
// Inventory all app-owned native selects and show any added later.
const appDir = path.join(root,'app');
function walk(dir) {
  return fs.readdirSync(dir,{withFileTypes:true}).flatMap(d =>
    d.isDirectory() ? walk(path.join(dir,d.name)) : d.name.endsWith('.tsx') ? [path.join(dir,d.name)] : []);
}
const controls = walk(appDir).flatMap(f => {
  const matches = read(path.relative(root,f)).match(/<select\b/g) || [];
  return matches.map(() => path.relative(root,f));
});
console.log(`Native dropdown inventory: ${controls.length} dropdown(s)`);
controls.forEach(f => console.log(' - ' + f));
if (controls.length !== 2) console.warn('Review newly added select controls visually too. Shared CSS will apply.');
console.log('Shared custom chevron and spacing checks passed.');
