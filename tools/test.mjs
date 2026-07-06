// Headless functional self-test: loads index.html in Chromium, feeds it
// sample-data.xlsx, and asserts the computed statuses, summary counts, the
// exclusion/critical/Exclude-SLOC behaviors, the export workbook, and ripple.
import puppeteer from 'puppeteer';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const xlsxDist = join(root, 'node_modules', 'xlsx', 'dist', 'xlsx.full.min.js');

let failures = 0;
const ok = (cond, msg) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${msg}`); if (!cond) failures++; };
const eq = (a, b, msg) => ok(a === b, `${msg} (got ${JSON.stringify(a)}, expected ${JSON.stringify(b)})`);

const browser = await puppeteer.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage();
page.on('pageerror', e => { console.log('PAGE ERROR:', e.message); failures++; });
page.on('console', m => { if (m.type() === 'error') console.log('CONSOLE ERROR:', m.text()); });

await page.goto('file://' + join(root, 'index.html'));
// Ensure XLSX is present even if the CDN was blocked in this sandbox.
await page.addScriptTag({ path: xlsxDist });
await page.evaluate(() => new Promise(r => (window.__app ? r() : window.addEventListener('DOMContentLoaded', r))));

// Feed the sample workbook.
const buf = readFileSync(join(root, 'sample-data.xlsx'));
await page.evaluate((b64) => {
  const bin = atob(b64); const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  window.__app.loadArrayBuffer(arr.buffer);
}, buf.toString('base64'));

const r = await page.evaluate(() => {
  const m = window.__app.model;
  const status = {}; window.__app.displayOrders.forEach(o => status[o.id] = o.status);
  const counts = {}; window.__app.displayOrders.forEach(o => counts[o.status] = (counts[o.status]||0)+1);
  const bars = document.querySelectorAll('#gantt .bar').length;
  const wb = window.__app.buildExportWorkbook();
  return {
    orderCount: m.orders.length,
    lineCount: m.lines.length,
    minutesPerDay: window.MINUTES_PER_DAY ?? null,
    status, counts, bars,
    avail500002: m.avail['500002'] || 0,
    exportSheets: wb ? wb.SheetNames : [],
  };
});

console.log('\n--- assertions ---');
eq(r.orderCount, 8, 'parsed 8 orders');
eq(r.lineCount, 5, 'parsed 5 production lines');
eq(r.avail500002, 6, '500002 available counts Include SLOCs only (6), ignores Exclude SLOC 1054');

eq(r.status.O1001, 'gray-dark', 'O1001 WIP fully covered');
eq(r.status.O1002, 'gray-dark', 'O1002 WIP fully covered');
eq(r.status.O2001, 'blue', 'O2001 scheduled, covered');
eq(r.status.O2002, 'blue', 'O2002 scheduled, covered (excluded comp 500005 must NOT flag)');
eq(r.status.O2003, 'blue', 'O2003 scheduled, covered');
eq(r.status.O3001, 'yellow', 'O3001 unscheduled, non-critical shortage (500001)');
eq(r.status.O3002, 'red', 'O3002 unscheduled, CRITICAL shortage (500007)');
eq(r.status.O3003, 'red', 'O3003 unscheduled, CRITICAL shortage (500002)');

eq(r.bars > 0, true, 'Gantt rendered bars');
ok(JSON.stringify(r.exportSheets) === JSON.stringify(['List View','7-Day Shortages','Call Back List']), `export has 3 sheets (got ${JSON.stringify(r.exportSheets)})`);

// Ripple: drag the last critical order to the front of the sequence and confirm
// at least one status changes (its components should now get inventory first).
const ripple = await page.evaluate(() => {
  const before = {}; window.__app.displayOrders.forEach(o => before[o.id] = o.status);
  window.__app.reorder('O3003', 'O1001'); // move O3003 ahead of WIP front
  const after = {}; window.__app.displayOrders.forEach(o => after[o.id] = o.status);
  return { before, after, o3003Before: before.O3003, o3003After: after.O3003 };
});
ok(JSON.stringify(ripple.before) !== JSON.stringify(ripple.after), 'reorder changes at least one status (ripple)');
eq(ripple.o3003After, 'green', 'O3003 becomes covered after moving to front of consumption');

await browser.close();
console.log(`\n${failures ? failures + ' FAILURE(S)' : 'ALL PASSED'}`);
process.exit(failures ? 1 : 0);
