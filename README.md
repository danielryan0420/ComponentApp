# ComponentApp — Factory Scheduler (Gantt)

> **Branch status:** The `main` branch currently contains only this README — no
> application code is committed here yet. A complete, working implementation
> exists on the unmerged remote branch **`claude/component-app-spec-a67x9b`**
> (commits "Build Factory Scheduler — Gantt single-file app" and "Restyle UI to
> match the reference app"). Everything below documents **that** implementation
> so the app isn't lost if the branch is deleted. If you're reading this after
> the branch has been merged, this note is stale and can be removed.

## What it does

Factory Scheduler — Gantt is a single-file, client-side web app for visualizing
and re-sequencing a factory's production order backlog. A planner drops in a
production-scheduling Excel workbook (the "Mount Orders Template" — typically
exported from SAP and/or an EOP system) and the app:

- Classifies every order as **WIP**, **Scheduled**, or **Unscheduled**.
- Walks a global consumption sequence and allocates on-hand component
  inventory to orders in order, flagging **shortages** (and **critical**
  shortages for designated components).
- Projects start/finish dates per production line from each line's
  units-per-day capacity, skipping weekends.
- Renders an interactive **Gantt chart** (grouped by MRP controller/line, with
  a collapsible WIP section) and an equivalent **List View**.
- Lets the planner **drag-and-drop to re-sequence** orders and see the
  resulting status changes ("ripple") immediately.
- **Exports** a 3-sheet Excel workbook (List View, 7-Day Shortages, Call Back
  List) for sharing outside the app.

## Who it's for

Production/MRP planners and schedulers who need a fast, no-install way to turn
a raw SAP/EOP export into a visual schedule, spot component shortages before
they block the line, and re-prioritize orders.

## Main features

- Alias-tolerant, case-insensitive parsing of a 9-tab Excel workbook, with a
  blocking-error / warn-and-proceed validation modal.
- WIP-aware, SLOC-aware inventory allocation (Include vs. Exclude storage
  locations), critical-component flagging, and component-exclusion overrides.
- Gantt + List views, zoom, search/filter, "All Lines" vs. priority-line
  toggle.
- Order detail modal (Inventory Log) and per-component inventory modal.
- Drag-to-resequence with visual "ripple" feedback on status changes.
- One-click Excel export of the current schedule and shortages.

## Tech stack

- **Plain HTML/CSS/JavaScript** — a single `index.html`, no framework, no
  build step.
- **[SheetJS (xlsx)](https://sheetjs.com/)** loaded from a CDN at runtime for
  spreadsheet parsing/writing (the app degrades with an on-screen warning if
  the CDN is blocked).
- **Node.js + Puppeteer + xlsx (npm)** for the dev-only tooling: generating a
  sample workbook and running a headless-browser self-test. Not required to
  run the app itself.

## Quick start

```sh
# On the branch that has the app (claude/component-app-spec-a67x9b):
git checkout claude/component-app-spec-a67x9b
open index.html          # or: double-click it / serve it with any static server
```

Drop an Excel workbook matching the expected schema onto the window, or click
**Load Workbook**. See `docs/USER_GUIDE.md` for how to use the app and
`docs/REBUILD.md` for full setup, dev tooling, and how to rebuild it from
scratch.

## Docs

- [docs/REBUILD.md](docs/REBUILD.md) — prerequisites, setup, config, project
  structure, data flow, and how to rebuild this app from scratch.
- [docs/USER_GUIDE.md](docs/USER_GUIDE.md) — screen-by-screen guide, common
  workflows, and troubleshooting/FAQ for end users.
