// Generates sample-data.xlsx matching the "Mount Orders Template" schema.
// Data is hand-tuned so every status path is exercised:
//   - fully covered orders (green)
//   - partial / missing coverage (yellow / red)
//   - a CRITICAL component shortage (red) that must dominate status
//   - an EXCLUDED component with zero inventory that must NOT flag a shortage
//   - inventory parked in an Exclude SLOC that must NOT count as available
// Run: node tools/gen-sample.mjs  ->  writes ./sample-data.xlsx
import * as XLSX from 'xlsx';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = join(__dirname, '..', 'sample-data.xlsx');

// Anchor relative dates to a fixed "today" so the sample is reproducible.
const TODAY = new Date(2026, 5, 17); // 2026-06-17 (month is 0-based)
const day = (n) => { const d = new Date(TODAY); d.setDate(d.getDate() + n); return d; };
const at = (n, h, m) => { const d = day(n); d.setHours(h, m, 0, 0); return d; };

// ---- Units Per Day: 5 production lines (MRP Controller -> Line -> capacity) ----
const unitsPerDay = [
  ['MRP Controller', 'Line', 'Units Per Day'],
  ['71A', 'A-Line', 13],
  ['71C', 'C-Line', 20],
  ['71D', 'D-Line', 10],
  ['71E', 'E-Line', 3],   // PRIORITY_LINE
  ['71M', 'E-Frame', 1],
];

// ---- Shifts: 3rd shift is overnight (start > stop) ----
const shifts = [
  ['', 'Start Time', 'Stop Time'],
  ['1st shift', '6:30', '14:30'],
  ['2nd shift', '14:30', '22:30'],
  ['3rd shift', '22:30', '6:30'],
];

// ---- SLOC Lead Times: Include vs Exclude governs available inventory ----
const slocLeadTimes = [
  ['SLOC', 'Lead Time', 'Description', 'Include/Exclude Inventory?'],
  ['0050', 0, 'WIP', 'Include'],
  ['1000', 0, 'Warehouse', 'Include'],
  ['1088', 1, 'Inbound from GK', 'Include'],
  ['1051', 2, 'GK', 'Include'],
  ['1054', '', 'MRB - Exclude', 'Exclude'],
  ['1099', '', 'Electronics MRB', 'Exclude'],
];

// ---- Component & material reference ----
// component code -> [description, procurementType(E/F/X), mrpController]
const COMP = {
  500001: ['Steel Bracket',    'F', '65A'],
  500002: ['Drive Bearing',    'F', '65B'], // CRITICAL
  500003: ['Wire Harness',     'F', '64G'],
  500004: ['Bolt Kit',         'E', '71A'],
  500005: ['Foam Filler',      'F', '65Z'], // EXCLUDED component
  500006: ['Seal Gasket',      'F', '65A'],
  500007: ['Main Controller',  'F', '65B'], // CRITICAL
  500008: ['Frame Weldment',   'E', '71M'],
};
const CRITICAL = [500002, 500007];
const EXCLUSIONS = [500005];

// MRP Controller -> Owner (right-hand lookup block in Master Data)
const OWNER = { '65A': 'GK FAB', '65B': 'L/H', '64G': 'BLOCK HOUSE', '65Z': 'GK FAB', '71A': 'IN-HOUSE', '71M': 'IN-HOUSE' };

// ---- Orders ----
// [Order, MRPctrlr, FG Material, Qty, bscStartOffset, basicFinOffset, scheduled(Date|''), mountScan(Date|''), seq]
const orderDefs = [
  // WIP (MountScanTime present) — already on the floor
  ['O1001', '71E', 'FG-E1', 3,  -1, 1,  '',        at(-1, 7, 0),  1],
  ['O1002', '71A', 'FG-A1', 13, -1, 0,  '',        at(-1, 8, 0),  2],
  // Scheduled (ScheduledTimeStamp present, no MountScan)
  ['O2001', '71E', 'FG-E2', 3,   2, 4,  day(2),    '',            3],
  ['O2002', '71C', 'FG-C1', 20,  3, 5,  day(3),    '',            4],
  ['O2003', '71D', 'FG-D1', 10,  5, 7,  day(5),    '',            5],
  // Unscheduled (neither)
  ['O3001', '71A', 'FG-A2', 13,  0, 2,  '',        '',            6],
  ['O3002', '71M', 'FG-M1', 1,   0, 3,  '',        '',            7],
  ['O3003', '71E', 'FG-E3', 3,   0, 2,  '',        '',            8],
];

// ---- BOM: per-order component demand (Open Quantity = remaining qty for the order) ----
// order -> [[component, qty], ...]
const bomDefs = {
  O1001: [[500001, 3], [500002, 3], [500004, 3]],
  O1002: [[500003, 13], [500006, 13]],
  O2001: [[500002, 3], [500007, 3]],
  O2002: [[500001, 20], [500005, 20], [500006, 20]],
  O2003: [[500008, 10], [500004, 10]],
  O3001: [[500001, 13], [500003, 13]],
  O3002: [[500007, 1]],
  O3003: [[500002, 3], [500005, 3]],
};

// ---- On Hand: component inventory by SLOC. Tuned vs. total demand:
//   500001: demand 3+20+13=36, available(Include)=30  -> shortage of 6
//   500002: demand 3+3+3=9,   available(Include)=6 (+10 in Exclude SLOC ignored) -> CRITICAL short
//   500003: demand 13+13=26,  available=30 -> covered
//   500004: demand 3+10=13,   available=20 -> covered
//   500005: demand 20+3=23,   available=0  -> EXCLUDED, must NOT flag
//   500006: demand 13+20=33,  available=40 -> covered
//   500007: demand 3+1=4,     available=3  -> CRITICAL short
//   500008: demand 10,        available=10 -> exactly covered
const onHand = [
  ['Material', 'SLoc', 'Unrestricted'],
  [500001, '1000', 30],
  [500002, '0050', 6],
  [500002, '1054', 10],   // Exclude SLOC — must be ignored
  [500003, '1088', 30],
  [500004, '1000', 20],
  // 500005 intentionally absent (excluded component)
  [500006, '1000', 40],
  [500007, '0050', 3],
  [500008, '1000', 10],
];

// ---- Build Orders / BOM rows ----
const orders = [['Order', 'Material', 'MRP ctrlr', 'Target qty', 'Unit', 'Bsc start', 'Basic fin.', 'ScheduledTimeStamp', 'MountScanTime', 'Sequence']];
const bom = [['Order', 'Material', 'Material Description', 'Open Quantity', 'UOM']];
for (const [ord, mrp, mat, qty, s, f, sched, scan, seq] of orderDefs) {
  orders.push([ord, mat, mrp, qty, 'EA', day(s), day(f), sched, scan, seq]);
  for (const [comp, cqty] of bomDefs[ord]) {
    bom.push([ord, comp, COMP[comp][0], cqty, 'EA']);
  }
}

// ---- Critical Components / Component Exclusions (single-column lists) ----
const critical = [['Material'], ...CRITICAL.map((m) => [m])];
const exclusions = [['Material'], ...EXCLUSIONS.map((m) => [m])];

// ---- Master Data: left block (Material/MRPController/ProcType) + right block (MRP/Owner) ----
const ownerRows = Object.entries(OWNER);
const masterRows = Object.entries(COMP);
const master = [['Material', 'MRP Controller', 'Procurement Type', '', 'MRP', 'Owner']];
const maxLen = Math.max(masterRows.length, ownerRows.length);
for (let i = 0; i < maxLen; i++) {
  const left = masterRows[i] ? [Number(masterRows[i][0]), masterRows[i][1][2], masterRows[i][1][1]] : ['', '', ''];
  const right = ownerRows[i] ? [ownerRows[i][0], ownerRows[i][1]] : ['', ''];
  master.push([left[0], left[1], left[2], '', right[0], right[1]]);
}

// ---- Assemble workbook ----
const wb = XLSX.utils.book_new();
const add = (name, aoa) => XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), name);
add('Orders', orders);
add('BOM', bom);
add('On Hand', onHand);
add('Units Per Day', unitsPerDay);
add('Shifts', shifts);
add('Component Exclusions', exclusions);
add('SLOC Lead Times', slocLeadTimes);
add('Critical Components', critical);
add('Master Data', master);

XLSX.writeFile(wb, OUT, { cellDates: true });
console.log('Wrote', OUT);
console.log('Orders:', orderDefs.length, '| BOM rows:', bom.length - 1, '| On Hand rows:', onHand.length - 1);
