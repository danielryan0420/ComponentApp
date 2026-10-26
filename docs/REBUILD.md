# Rebuild Guide

This document is a complete, from-scratch guide to recreating ComponentApp
("Factory Scheduler — Gantt") if the repository or its history were lost.

## 0. Important: where the code actually lives

The `main` branch of this repo currently has only a placeholder README. The
real, working application was built and committed on a different branch:
**`claude/component-app-spec-a67x9b`** (two commits: "Build Factory Scheduler
— Gantt single-file app", then "Restyle UI to match the reference app"). All
file contents, structure, and logic described below reflect that branch. If
you still have access to it, the fastest "rebuild" is simply:

```sh
git fetch origin
git checkout claude/component-app-spec-a67x9b
```

Everything past this point assumes that branch (or its equivalent recreated
from scratch) is gone and you're rebuilding from this description alone.

## 1. Prerequisites

The app itself needs **nothing but a modern web browser** — there is no
server, no database, no build pipeline. Dev tooling (sample data generation
and automated tests) needs:

- **Node.js** 18+ (any recent LTS; uses native ESM `import`, `node:fs`,
  `node:path`, `node:url`).
- **npm** (bundled with Node).
- A machine that can launch headless Chromium (Puppeteer downloads its own
  Chromium build on `npm install`).
- Internet access to `cdn.sheetjs.com` at runtime (the app loads SheetJS
  from there — see Gotchas).

No API keys, cloud accounts, or secrets are required anywhere in this project.

## 2. Cloning / initializing

```sh
git clone <repo-url> ComponentApp
cd ComponentApp
```

If recreating from nothing, just `mkdir ComponentApp && cd ComponentApp && git init`
and recreate the files described in "Project structure" below.

## 3. Dependencies

Create `package.json` with:

- `name`: `componentapp`
- `description`: "Factory Scheduler — Gantt: a single-file HTML production
  scheduling visualizer."
- `private: true`
- `scripts`:
  - `gen` → `node tools/gen-sample.mjs` (writes a sample workbook)
  - `test` → `node tools/gen-sample.mjs && node tools/test.mjs` (regenerates
    the sample, then runs the headless self-test)
- `devDependencies`:
  - `puppeteer` (^25.x) — headless Chromium for the self-test
  - `xlsx` (^0.18.x) — used only by the Node-side sample generator (the
    browser app itself uses the CDN build, not this npm package)

Install with:

```sh
npm install
```

`.gitignore` should exclude: `node_modules/`, `package-lock.json`,
`schedule-export.xlsx` (the file the app writes when you click Export).

## 4. Configuration / environment variables

**There are none.** This app has no `.env` file, no server-side config, no
secrets, and no runtime feature flags. The only "configuration" is the
in-browser `const`/`let` block at the top of the `<script>` in `index.html`:

- `PRIORITY_LINE` — the MRP line code (`'71E'`) treated as priority for the
  "All Lines ↔ priority line" toggle and date-tie-breaking.
- `MINUTES_PER_DAY` — default 480, recomputed at load time from the workbook's
  `Shifts` tab if present.
- `dayWidth` — Gantt zoom level in pixels/day (clamped 30–200 by the zoom
  buttons).

To change the priority line or default zoom, edit these constants directly;
there's no external config surface.

## 5. Data / "database" setup

There is no database. All data is supplied at runtime by the user as an Excel
workbook (`.xlsx`/`.xls`/`.csv`), held only in browser memory for the session
— nothing is persisted to disk or any backend. Reloading the page clears the
loaded data.

### Expected workbook shape (the "Mount Orders Template")

Real-world data is expected to originate from **SAP** and/or an **EOP**
export; the app does not call any SAP/EOP API directly — a human exports the
workbook and drags it onto the app. Column matching is alias-tolerant and
case-insensitive (see `COL` and `SHEET_ALIASES` in `index.html`). Worksheets:

| Tab | Required? | Purpose |
|---|---|---|
| Orders | ✅ | One row per production order: id, material, MRP controller/line, qty, basic start/finish, scheduled timestamp, mount-scan timestamp, sequence. |
| BOM | ✅ | Per-order component demand (order, component, description, open/required qty). |
| On Hand | ✅ | Current inventory by material + storage location (SLOC). |
| Units Per Day | optional | Per MRP-controller/line production capacity (units/day). |
| Shifts | optional | Shift start/stop times, used to compute `MINUTES_PER_DAY`. |
| Component Exclusions | optional | Materials that should never be flagged as short. |
| SLOC Lead Times | optional | Per-SLOC lead time, description, and Include/Exclude flag (Exclude SLOCs' inventory is ignored). |
| Critical Components | optional | Materials whose shortage marks an order "critical" (red) instead of just "missing" (yellow). |
| Master Data | optional | Material → MRP controller/procurement type, and MRP controller → owner, used for the Call Back export. |

Missing `Orders`/`BOM`/`On Hand` (or their required columns) is a **blocking
error**; missing anything else raises a **warning** with a "Proceed Anyway"
option — see `validateWorkbook()` in `index.html`.

### Sample data

`tools/gen-sample.mjs` generates `sample-data.xlsx`, a hand-tuned workbook
exercising every status path (fully covered, non-critical shortage, critical
shortage, an excluded component with no inventory, and inventory parked in an
Exclude SLOC that must be ignored). Regenerate it with `npm run gen`.

## 6. Running locally

No build step. Either:

- Double-click / open `index.html` directly in a browser, or
- Serve the directory with any static file server, e.g. `npx serve .` or
  `python3 -m http.server`, then visit it in a browser.

Then drag a workbook onto the window or click **Load Workbook**.

## 7. Tests

```sh
npm test
```

This runs `tools/gen-sample.mjs` (regenerate the sample workbook) then
`tools/test.mjs`, which:

1. Launches headless Chromium via Puppeteer and opens `index.html` over
   `file://`.
2. Injects the local `node_modules/xlsx` build in case the CDN is unreachable
   in the test environment.
3. Feeds it `sample-data.xlsx` via the `window.__app.loadArrayBuffer()` test
   hook (see bottom of `index.html`'s script — `window.__app` exposes
   `loadArrayBuffer`, `model`, `displayOrders`, `exportExcel`,
   `buildExportWorkbook`, `recompute`, `selectOrder`, `reorder` for testing).
4. Asserts: parsed order/line counts, correct Include-SLOC-only inventory
   totals, each sample order's expected status (WIP/scheduled/critical/etc.),
   that Gantt bars rendered, that Export produces exactly 3 sheets, and that
   dragging a critical order to the front of the sequence ("ripple") changes
   its status once it gets inventory priority.

There is no separate unit-test framework — this is a single end-to-end
functional script (15 assertions per its commit message).

## 8. Building / deploying

There is no build. To deploy, host the static files (`index.html` and
anything under `tools/` if you want the dev scripts alongside it) on any
static web host, S3 bucket, GitHub Pages, internal file share, etc. The only
runtime dependency is network access to `cdn.sheetjs.com` from the end user's
browser.

## 9. Project structure

```
index.html              — the entire application (HTML + CSS + JS, one file)
package.json             — dev-only metadata/scripts (puppeteer, xlsx)
.gitignore               — node_modules/, package-lock.json, schedule-export.xlsx
sample-data.xlsx         — generated sample workbook (via tools/gen-sample.mjs)
tools/
  gen-sample.mjs          — writes sample-data.xlsx covering every status path
  test.mjs                — Puppeteer headless functional self-test
  screenshot-*.png        — reference screenshots (splash, gantt, list, modal)
```

### Inside `index.html` (by section, top to bottom of the `<script>` block)

- **Constants & global state** — `PRIORITY_LINE`, `TODAY`, and mutable state:
  `rawData` (parsed workbook), `model` (computed domain model), `displayOrders`
  (current render order), `manualSeq` (user drag overrides), view toggles
  (`listView`, `allLines`, `searchTerm`, zoom, collapse state).
- **Utilities** — date helpers (`startOfDay`, `addWorkingDays`,
  `workingDaysBetween`, `parseDate` handling both Excel serials and JS Dates),
  string normalization/escaping (`norm`, `esc`), `toNum`.
- **Sheet parsing** (`SHEET_ALIASES`, `COL`, `pick`, `hasCol`, `parseSheet`,
  `findSheet`) — turns raw worksheet grids into `{headers, rows}` with
  alias-tolerant column lookup.
- **Validation** (`validateWorkbook`, `showValidation`, `closeValidation`) —
  checks required tabs/columns and surfaces the validation modal.
- **Model building** (`buildModel`) — the core transform: resolves lines from
  Units Per Day, shift minutes, SLOC include/exclude + lead times, critical/
  exclusion sets, Master Data lookups, on-hand inventory (Include SLOCs only),
  BOM-by-order, and the Orders list itself (typed as `wip` / `scheduled` /
  `unscheduled` based on which timestamps are present).
- **Sequencing + consumption** (`buildGlobalSequence`, `computeAll`,
  `classifyStatus`, `computeProjectedDates`) — orders a global queue (manual
  drag overrides first, then WIP → Scheduled → Unscheduled, each with its own
  tiebreak), walks it once allocating a shared inventory pool per component,
  and derives each order's status color and projected start/finish dates from
  per-line units-per-day capacity.
- **Rendering** — `render`/`renderSummary`/`renderGantt`/`renderLanes` (Gantt),
  `renderListView` (table view), `renderOrderModal`/`showCompModal` (detail
  modals), `showTip`/`hideTip` (hover tooltip).
- **Interaction** — `setupBarEvents`, `setupGanttDrag`, `setupListDrag`,
  `reorder` (drag-and-drop re-sequencing), `detectRipple` (flashes bars whose
  status got better/worse after a reorder).
- **Excel export** (`buildExportWorkbook`, `exportExcel`) — builds a 3-sheet
  workbook (List View, 7-Day Shortages, Call Back List grouped by component
  with owner/procurement/lead time) via SheetJS and triggers a download.
- **File loading** (`loadArrayBuffer`, `handleFile`) — reads the dropped/
  selected file, parses it with `XLSX.read`, validates, and (if OK or user
  proceeds) builds the model and triggers the first render.
- **Wire-up** (`DOMContentLoaded` handler) — binds all toolbar/file/drag
  listeners and exposes `window.__app` as a test hook.

## 10. Data flow (end to end)

1. User drops/selects a workbook → `handleFile` reads it as an `ArrayBuffer`.
2. `loadArrayBuffer` parses it with SheetJS, runs `validateWorkbook`.
3. If there are blocking errors, a modal stops here; warnings show a
   "Proceed Anyway" modal; otherwise it proceeds automatically.
4. `buildModel` transforms the raw sheets into the typed domain model
   (lines, inventory, BOM, orders, lookups).
5. `computeAll` builds the global order sequence, walks it once consuming a
   shared inventory pool per component (respecting Include/Exclude SLOCs and
   Component Exclusions, flagging Critical Components), and assigns each
   order a status color.
6. `computeProjectedDates` lays out each line's orders end-to-end on working
   days from today, using that line's units-per-day capacity.
7. `render` draws the Gantt or List view from `displayOrders`.
8. User interactions (search, zoom, view toggle, drag-to-reorder) mutate
   view state or `manualSeq` and call `recompute()`/`render()` again — the
   whole model is recomputed from scratch each time (no incremental diffing).
9. Export reads the current `displayOrders`/`model` and writes a new `.xlsx`
   via SheetJS; nothing is sent to a server.

## 11. External integrations

- **SheetJS (xlsx)** — loaded from `cdn.sheetjs.com` via a `<script>` tag;
  used both to parse uploaded workbooks and to build the exported workbook.
  This is the only external runtime dependency.
- **SAP / EOP** — referenced only as the real-world *source* of the Excel
  workbook a planner uploads (per the README's "Data may come from SAP and/or
  EOP" note). There is no direct API integration with SAP, EOP, or any other
  system in this codebase — all data entry is via manual file upload.
- **No Gmail, database, auth, or other service integrations exist** in this
  codebase.

## 12. Known gotchas

- **CDN dependency**: if `cdn.sheetjs.com` is unreachable, the app shows a
  "SheetJS CDN blocked" warning and disables file parsing entirely (there is
  no bundled fallback for the live app — only the test script loads a local
  `node_modules/xlsx` copy as a substitute).
- **Excel date serials**: dates may arrive as JS `Date` objects, Excel serial
  numbers (days since 1899-12-30), or strings; `parseDate` handles all three —
  if you add new date columns, route them through it.
- **Column aliasing is fragile by design**: `pick()`/`COL` tolerate header
  variations (e.g. "Bsc start" vs "Basic Start Date"), but an unexpected new
  header spelling will silently fail to match rather than error — check
  `COL` first when a column "disappears."
- **No persistence**: all state is in-memory; refreshing the browser discards
  the loaded workbook and any manual re-sequencing (`manualSeq`).
- **Global recompute on every change**: `computeAll()` reprocesses every order
  and the entire inventory pool on every reorder/search/zoom — fine at current
  scale but something to watch if order volume grows substantially.
- **`PRIORITY_LINE` and the "E-Line" check in `visibleOrders()`** are
  hardcoded to this dataset's naming (`71E` / `'E-Line'`); adapting the app to
  a different factory's line codes means editing these constants/strings, not
  just the uploaded data.
- **`package.json`'s `repository.url`** points at a local development proxy
  artifact from when this branch was built, not a real remote — don't treat it
  as authoritative; use your actual git remote.
