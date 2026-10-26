# User Guide — Factory Scheduler (Gantt)

> This guide covers the app as implemented on branch
> `claude/component-app-spec-a67x9b`. If your copy of `index.html` looks
> different, you may be on a different version — the screens and buttons
> described below match that build.

## What this app is for

Factory Scheduler turns a production-scheduling Excel workbook into an
interactive, color-coded Gantt chart (or table) so a planner can see at a
glance which orders are at risk of a component shortage, re-prioritize orders
by dragging them, and export a clean report. It runs entirely in your browser
— nothing is uploaded to a server.

## Getting started

1. Open `index.html` in a browser (Chrome, Edge, or Firefox recommended).
2. You'll see the **splash screen** with the factory icon and a drop zone.
3. Either **drag your Excel workbook onto the window**, or **click "Drop Excel
   file here or click to browse"** to pick a file from disk.
4. If your workbook is missing required information, a **validation screen**
   appears before anything loads (see "Validation modal" below).

### What file do I need?

A workbook with (ideally) these tabs: `Orders`, `BOM`, `On Hand`,
`Units Per Day`, `Shifts`, `Component Exclusions`, `SLOC Lead Times`,
`Critical Components`, `Master Data`. Column headers don't have to match
exactly — the app recognizes common variations (e.g. "Order #" or "Order ID"
both work for the order number column). Only **Orders**, **BOM**, and
**On Hand** are strictly required; the rest unlock extra features but the app
will still run without them (with a warning).

## The screens

### 1. Splash / drop screen

Shown before any data is loaded. Just a drop target — nothing to configure
here. Disappears automatically once a workbook loads successfully.

### 2. Header toolbar

Always visible at the top once the app is open:

| Control | What it does |
|---|---|
| **Load Workbook** | Opens a file picker to load (or replace) the workbook. |
| **Gantt** / **List View** | Switches between the timeline chart and the flat/grouped table. The active one is highlighted. |
| **All Lines** / **Priority (71E)** | Toggles whether you see every production line or only the priority line (line `71E`). |
| **Search box** | Type an order number or material number to highlight matches; non-matching bars/rows dim rather than disappear. |
| **− / +** (Zoom) | Shrinks/widens the Gantt's day columns. Has no effect in List View. |
| **Export** | Downloads an `.xlsx` report of the current schedule (see "Exporting" below). |
| ⚠ **CDN warning** | If shown, your browser couldn't reach the SheetJS CDN — file loading is disabled until that's resolved (check your network/firewall). |

Below the toolbar is a **summary bar**: a horizontal colored strip showing the
proportion of orders in each status, plus a text count ("N orders · WIP 2 ·
Scheduled 5 · Critical 1 ..."), and a **legend** mapping each color to its
status name.

### 3. Gantt view (default)

A timeline with one row ("lane") per production line, grouped under its MRP
controller code (e.g. "71A (A-Line)"). Each lane header shows the line's
units-per-day capacity and order count.

- **WIP (n)** is a collapsible section at the top — click it to expand/collapse
  orders already in progress on the floor.
- Each **bar** represents one order, positioned by its projected start date
  and sized by its projected duration. The bar shows the order ID and
  quantity/date range.
- **Hover** over a bar to see a tooltip with its component-by-component
  coverage (ok / short / excluded).
- **Click** a bar to select it (outlined in gold) and open the **order detail
  modal**.
- **Drag a bar onto another bar** to move it in the schedule's priority order
  — see "Re-sequencing orders" below.
- A vertical **today line** marks the current date; weekend columns are
  shaded.

### 4. List View

The same orders as a sortable-feeling, grouped table (grouped by MRP
controller) instead of a timeline. Columns: Order, Material, Line, Qty,
Status, Projected (date range), Shortages (lists any short components).

- Click a **group header** to collapse/expand that group.
- Click a **row** to select it and open the order detail modal.
- **Drag a row onto another row** to re-sequence, same as in Gantt.

### 5. Order detail modal

Opens when you click a bar or row. Shows:

- Order ID and status pill (e.g. "Critical", "Scheduled", "Ready").
- Key fields: Material, Line (MRP controller + line name + capacity),
  Quantity, Mount scan date, Scheduled date, Basic start/finish, and the
  app's own **Projected start/finish** (with duration in days).
- An **Inventory Log** table: every component this order needs, with
  Description, Need, Avail(able), Procurement type, Owner, Lead time, and a
  status pill (ok / short N / critical / excluded).
- Click any **component name** in that table to open the **component modal**
  (see next).
- **Close** button or click outside the modal to dismiss.

### 6. Component modal

Opens from a component link in the order detail modal. Shows:

- The component ID with **critical**/**excluded** badges if applicable.
- Procurement type (with in-house/purchased/both hint), MRP controller, Owner.
- Total available quantity, broken out as "Include" SLOCs (counted) vs.
  "excluded SLOCs" (not counted toward availability).
- A per-SLOC breakdown table: SLOC, Description, Qty, Lead time, and whether
  that SLOC is Included or Excluded from availability.

### 7. Validation modal

Appears automatically right after you load a file, **only if** something's
off with the workbook:

- **Errors (must fix)** — e.g. a required tab or column is missing. If there
  are any errors, you can only **Cancel**; the workbook won't load until you
  fix it and re-upload.
- **Warnings** — e.g. an optional tab is missing (related features will be
  disabled, but the rest of the app still works). You can click **Proceed
  Anyway** to load the data regardless, or **Cancel** to go back.

## Understanding order status / colors

| Color | Label | Meaning |
|---|---|---|
| Dark gray | WIP | In progress on the floor, fully covered. |
| Light gray | WIP (short) | In progress, but missing a component. |
| Teal/blue | Scheduled | Has a scheduled date, fully covered. |
| Purple | Scheduled (short) | Has a scheduled date, missing a component. |
| Green | Ready | Not yet scheduled, but fully covered — could start now. |
| Olive/yellow | Missing | Not yet scheduled, missing a non-critical component. |
| Red | Critical | Missing a component flagged as "critical" — highest priority to chase down. |

Components marked under **Component Exclusions** never cause a shortage flag,
even with zero inventory — they're assumed to be handled outside this
process. Inventory sitting in a SLOC marked **Exclude** (per SLOC Lead Times)
is never counted as available, even if the quantity is nonzero.

## Common workflows

### Load and review today's schedule

1. Open the app, drop in today's exported workbook.
2. Resolve any validation errors; proceed past warnings if acceptable.
3. Scan the **summary bar** for how many orders are Critical/Missing.
4. Switch to **List View** and look at the **Shortages** column, or stay in
   Gantt and hover bars for the tooltip breakdown.

### Investigate a shortage

1. Click the affected order's bar/row to open its detail modal.
2. Check the **Inventory Log** for which component(s) are short and by how
   much.
3. Click the component name to see exactly which SLOCs have inventory, the
   lead time, and who owns procurement for it.

### Re-sequence orders (what-if prioritization)

1. In either view, **drag** an order's bar/row and **drop it onto** another
   order to move it just ahead of that order in the global sequence.
2. The schedule recomputes instantly; any order whose status changed as a
   result briefly **flashes red (worse)** or **green (better)** — this is the
   "ripple" effect, showing the knock-on impact of your reprioritization.
3. This is all in-memory — reloading the page or loading a new file resets
   any manual re-sequencing.

### Export a report

1. Click **Export** in the toolbar.
2. An `.xlsx` downloads (`schedule-export.xlsx`) with three sheets:
   - **List View** — every visible order with status and projected dates.
   - **7-Day Shortages** — short components for orders projected to finish
     within 7 working days.
   - **Call Back List** — shortages grouped by component, with total short
     quantity, owner, procurement type, lead time, and which orders need it —
     useful for following up with purchasing/procurement.
3. Export only includes whatever is currently **visible** (respects the
   All Lines / Priority Line toggle), not the search filter.

### Narrow to one line or one order

- Use **All Lines ↔ Priority (71E)** to focus on just the priority line.
- Use the **search box** to highlight a specific order or material number
  across whichever view you're in (non-matches dim, they don't disappear).

## Troubleshooting / FAQ

**"⚠ SheetJS CDN blocked — file parsing unavailable" appears and I can't load
anything.**
Your network/browser is blocking `cdn.sheetjs.com`. Allow that domain through
your firewall/proxy, or open the app on a network that can reach it.

**I get a validation screen with errors and can't proceed.**
One of the required tabs (`Orders`, `BOM`, `On Hand`) or a required column on
one of them is missing or misnamed. Check your workbook's tab names and
headers against the list in the splash screen ("Required: Orders, Units Per
Day, BOM, On Hand, SLOC Lead Times, Critical Components" — note Orders/BOM/On
Hand are the hard requirements; the others just unlock features).

**A component shows as short but I know we have stock.**
Check whether that inventory is sitting in a SLOC marked **Exclude** under
*SLOC Lead Times* — excluded SLOCs are intentionally not counted as available.

**A component I expected to be flagged isn't.**
It may be listed in **Component Exclusions**, which means it never flags a
shortage regardless of inventory.

**My dates look wrong / off by a lot.**
The app reads dates from your workbook as either real dates or Excel's serial
number format; if a date cell is stored as plain text in an unusual format it
may not parse. Re-save the relevant column as an actual Excel date.

**I dragged an order and nothing changed.**
Dragging only changes anything if it affects the shared inventory allocation
order — if nothing about availability changed, status colors can stay the
same even though the sequence moved.

**I refreshed the page and lost my re-sequencing / loaded file.**
Expected — nothing is saved. The app keeps all data in memory for the current
browser tab only. Export to Excel before refreshing if you need to keep a
record.

**Can I use a CSV instead of Excel?**
The file picker accepts `.csv` as well as `.xlsx`/`.xls`, but a CSV can only
represent one sheet — since the app needs multiple tabs (Orders, BOM, On
Hand, etc.), a multi-tab `.xlsx`/`.xls` workbook is required in practice.
