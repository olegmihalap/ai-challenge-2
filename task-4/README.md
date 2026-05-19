# Task 4 — AI-ready Airport ATC MCP Server

TypeScript MCP server (stdio) that accepts flights, schedules runway/gate operations under separation buffers and crew limits, handles dependencies and cancellations, and exposes tools plus JSON resources for inspection.

**Source and runnable package:** [`task-4/code/`](code/) (install, build, and run from there). This file, [`task.md`](task.md), and [`report.md`](report.md) stay at the `task-4/` root per the challenge layout.

## Requirements

- Node.js 18+

### Environment files

On startup the server loads, in order:

1. [`task-4/.env`](.env) at the challenge root (optional)
2. [`task-4/code/.env`](code/.env) — optional overrides; create with `cp code/.env.example code/.env` if you only work inside `code/`. Duplicate keys override the root file.

So you can keep a single `.env` at the repo `task-4/` root, only under `code/`, or both. MCP clients may still pass the same variables in the server `env` block instead of using files.

## Install and build

```bash
cd task-4/code
npm install
npm run build
```

Development (no separate build step):

```bash
cd task-4/code
npm run dev
```

## Environment variables

Configuration is read at startup. **Official task variables are required** (no defaults). **Operation-duration variables are optional** — if omitted, built-in modeling defaults apply (see below). Invalid or inconsistent values cause startup failure with an explicit error.

When both a spec name and a legacy `ATC_*` name are set, **the spec name wins**.

### Official spec variables (airport capacity and buffers) — required

| Variable | Legacy aliases (backwards compatible) | Meaning |
|----------|---------------------------------------|---------|
| `RUNWAY_COUNT` | `ATC_RUNWAY_COUNT` | Positive integer — parallel runways (`R0 … R{n-1}`). |
| `GATE_COUNT` | `ATC_GATE_COUNT` | Positive integer — gates (`G0 … G{n-1}`). |
| `GROUND_CREW_COUNT` | `ATC_GROUND_CREW_COUNT` | Positive integer — max **concurrent** gate occupations (see [report](report.md)). |
| `RUNWAY_LENGTHS` | `ATC_RUNWAY_LENGTHS`, `ATC_RUNWAY_LENGTHS_METERS` | Comma-separated lengths in meters; **exactly `RUNWAY_COUNT` positive values**. Used with `runwayRequirement.minLength` on submit. |
| `TAKEOFF_BUFFER_MINUTES` | `ATC_TAKEOFF_BUFFER_MINUTES`, `ATC_BUFFER_TAKEOFF_MINUTES` | Non-negative separation between consecutive **takeoffs** on the same runway. |
| `LANDING_BUFFER_MINUTES` | `ATC_LANDING_BUFFER_MINUTES`, `ATC_BUFFER_LANDING_MINUTES` | Non-negative separation between consecutive **landings** on the same runway. |
| `MIXED_OPERATION_BUFFER_MINUTES` | `ATC_MIXED_OPERATION_BUFFER_MINUTES`, `ATC_BUFFER_MIXED_MINUTES` | Non-negative separation for **takeoff ↔ landing** on the same runway. |
| `GATE_TURNAROUND_MINUTES` | `ATC_GATE_TURNAROUND_MINUTES` | Non-negative idle time on a gate between consecutive flights. |
| `DEPENDENCY_BUFFER_MINUTES` | `ATC_DEPENDENCY_BUFFER_MINUTES` | Non-negative delay after a dependency **completes** before the dependent may start. |
| `MAX_SCHEDULING_HORIZON_MINUTES` | `ATC_MAX_SCHEDULE_HORIZON_MINUTES`, `ATC_MAX_SCHEDULING_HORIZON_MINUTES` | Positive minute boundary — all runway/gate segments must finish by this time. |

### Operation duration variables (scheduling segment lengths) — optional

These define how long each flight occupies the runway and gate during scheduling. They are **not** listed in the original `task.md` env table; they are **implementation modeling assumptions**. You may omit them and use the defaults below, or set overrides (positive integers only). Legacy `ATC_*` names remain supported.

| Variable | Legacy alias | Default | Meaning |
|----------|--------------|---------|---------|
| `ARRIVAL_RUNWAY_BLOCK_MINUTES` | `ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES` | `10` | Landing occupancy on the runway. |
| `DEPARTURE_RUNWAY_BLOCK_MINUTES` | `ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES` | `10` | Takeoff occupancy on the runway. |
| `ARRIVAL_GATE_BLOCK_MINUTES` | `ATC_ARRIVAL_GATE_BLOCK_MINUTES` | `20` | Gate handling after landing. |
| `DEPARTURE_GATE_BLOCK_MINUTES` | `ATC_DEPARTURE_GATE_BLOCK_MINUTES` | `20` | Gate block before takeoff (pushback/prep). |

Example overrides (from commented lines in [`code/.env.example`](code/.env.example)): `5` / `5` runway blocks, `20` / `25` gate blocks.

### Example `.env` fragment

```bash
export RUNWAY_COUNT=2
export GATE_COUNT=3
export GROUND_CREW_COUNT=4
export RUNWAY_LENGTHS=2800,3200
export TAKEOFF_BUFFER_MINUTES=2
export LANDING_BUFFER_MINUTES=2
export MIXED_OPERATION_BUFFER_MINUTES=3
export GATE_TURNAROUND_MINUTES=5
export DEPENDENCY_BUFFER_MINUTES=15
export MAX_SCHEDULING_HORIZON_MINUTES=800
# Optional operation durations (defaults: 10 / 10 / 20 / 20)
# export ARRIVAL_RUNWAY_BLOCK_MINUTES=5
# export DEPARTURE_RUNWAY_BLOCK_MINUTES=5
# export ARRIVAL_GATE_BLOCK_MINUTES=20
# export DEPARTURE_GATE_BLOCK_MINUTES=25
```

## Run the server

After `npm run build` from `task-4/code`:

```bash
cd task-4/code
node dist/index.js
```

The server speaks MCP over **stdio** (no HTTP port).

## Connect from an MCP client (Cursor)

Use an **absolute** path to the built entrypoint (adjust the prefix to your clone):

```json
{
  "mcpServers": {
    "airport-atc": {
      "command": "node",
      "args": ["/absolute/path/to/ai-challenge-2/task-4/code/dist/index.js"],
      "env": {
        "RUNWAY_COUNT": "2",
        "GATE_COUNT": "3",
        "GROUND_CREW_COUNT": "4",
        "RUNWAY_LENGTHS": "2800,3200",
        "TAKEOFF_BUFFER_MINUTES": "2",
        "LANDING_BUFFER_MINUTES": "2",
        "MIXED_OPERATION_BUFFER_MINUTES": "3",
        "GATE_TURNAROUND_MINUTES": "5",
        "DEPENDENCY_BUFFER_MINUTES": "15",
        "MAX_SCHEDULING_HORIZON_MINUTES": "800"
      }
    }
  }
}
```

If you rely on `.env` files instead of `env`, ensure either `task-4/.env` exists or copy `task-4/code/.env.example` to `task-4/code/.env`; the server resolves them relative to the built files under `task-4/code/dist/`.

Optional pattern with **cwd** and a relative script path:

```json
{
  "mcpServers": {
    "airport-atc": {
      "command": "node",
      "args": ["dist/index.js"],
      "cwd": "/absolute/path/to/ai-challenge-2/task-4/code"
    }
  }
}
```

Restart the IDE/MCP host after changes.

## MCP tools

| Tool | Description |
|------|-------------|
| `submit_flight` | Submit `flightNumber`, `operationType` (`arrival` \| `departure`), `priority` (`high` \| `medium` \| `low`), optional `dependencies` (existing flight UUIDs), optional `runwayRequirement: { minLength }` (meters). Legacy flat `minRunwayLengthM` is still accepted; `runwayRequirement.minLength` wins when both are set. Invalidates the current schedule until regenerated. |
| `generate_schedule` | Recomputes a full deterministic schedule for all non-cancelled flights; replaces any prior assignment. |
| `get_airport_status` | JSON summary: counts, runway/gate usage hints, constraint settings, blocked/waiting flights, completion minute when a schedule exists. |
| `cancel_flight` | Marks a flight cancelled and clears assignments so dependents are reassessed on the next `generate_schedule`. |
| `analyze_bottleneck` | Longest dependency chain on the **current** schedule (wall-clock span). Errors if no schedule has been generated yet. `analyze_schedule_bottleneck` is a deprecated alias with identical behavior. |

### Example: `submit_flight` with runway requirement

```json
{
  "flightNumber": "UA8901",
  "operationType": "departure",
  "priority": "high",
  "runwayRequirement": { "minLength": 3500 }
}
```

## MCP resources (JSON)

| URI | Description |
|-----|-------------|
| `airport://flight-queue` | All flights with lifecycle/scheduling fields and last known assignment/unschedule reasons. |
| `airport://runways` | Runway lengths plus booked runway intervals from the last schedule. |
| `airport://timeline` | Chronological gate/runway segments; each row lists `dependsOnFlightIds` for traceability. |

## Validation / tests

From `task-4/code`:

```bash
npm test
```

Automated coverage includes the three challenge scenarios (Morning Rush, Heavy Hauler, Connecting Flight) plus cancellation, horizon overflow, gate/crew bottlenecks, config validation, and MCP registration smoke tests in `code/src/*.test.ts`.

### Manual scenario walkthrough (MCP client)

1. **Morning Rush** — Submit one high/medium/low arrival and one low departure; call `generate_schedule`; read `airport://flight-queue` and `airport://timeline`. Expect four scheduled flights, no overlapping runway/gate intervals, higher priority earlier when the single runway is contested.
2. **Heavy Hauler** — Submit a departure with `runwayRequirement: { "minLength": 4000 }` (or higher than all `RUNWAY_LENGTHS`); regenerate; confirm the flight stays `unscheduled` with `NO_SUITABLE_RUNWAY` while other flights can still schedule.
3. **Connecting Flight** — Submit an arrival, then a departure depending on the arrival’s `flightId`; regenerate; confirm outbound gate/runway starts only after inbound completion plus `DEPENDENCY_BUFFER_MINUTES`.

## Troubleshooting

- **Startup fails immediately** — A required official env var is missing or invalid (or an optional operation-duration override is not a positive integer). The process prints `Invalid airport configuration: …` on **stderr** and exits with code 1. Fix `.env` or the MCP client `env` block (see tables above).
- **MCP client shows no tools / JSON parse errors** — Do not print debug logs to **stdout**; the server uses stdio for MCP. Only `console.error` is used for fatal errors in `index.ts`.
- **`analyze_bottleneck` errors** — Call `generate_schedule` first. Submit/cancel clears the active plan until you regenerate.
- **Stale timeline or status** — After submit/cancel, resources show `awaiting_schedule_regeneration` until the next `generate_schedule`.

## Submission (manual)

Before final hand-in: make the **GitHub repository public** (per `task.md`); confirm **`.env` is not committed** (see `code/.gitignore`); push the latest `task-4/` tree.

## Operational notes

- **Flight identity** — Each `submit_flight` creates a new UUID. Duplicate `flightNumber` strings are allowed; clients should use `flightId` for cancel/dependencies. Behavior is deterministic (no merge/dedup).
- **Dependency IDs** must reference flights already submitted (`submit_flight` returns UUID `flightId`s).
- Any **submit** or **cancel** clears the active schedule; call **`generate_schedule`** again before trusting timeline/status/bottleneck output.
- **No visual UI or database** — in-memory state only; see [`report.md`](report.md).
