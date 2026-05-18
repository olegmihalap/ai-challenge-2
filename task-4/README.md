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

All are **required** unless already set in the environment. Invalid or inconsistent values cause startup failure with an explicit error.

| Variable | Meaning |
|----------|---------|
| `ATC_RUNWAY_COUNT` | Positive integer number of parallel runways (`R0 … R{n-1}`). |
| `ATC_GATE_COUNT` | Positive integer number of gates (`G0 … G{n-1}`). |
| `ATC_GROUND_CREW_COUNT` | Positive integer — maximum concurrent gate occupations (see report). |
| `ATC_RUNWAY_LENGTHS_METERS` | Comma-separated lengths; **must provide exactly `ATC_RUNWAY_COUNT` positive numbers** (meters). Used for “heavy hauler” feasibility (`minRunwayLengthM` on a flight). |
| `ATC_BUFFER_TAKEOFF_MINUTES` | Non-negative separation between consecutive **takeoffs** on the same runway. |
| `ATC_BUFFER_LANDING_MINUTES` | Non-negative separation between consecutive **landings** on the same runway. |
| `ATC_BUFFER_MIXED_MINUTES` | Non-negative separation for **takeoff ↔ landing** transitions on the same runway. |
| `ATC_GATE_TURNAROUND_MINUTES` | Non-negative minimum idle time on a gate between consecutive flights. |
| `ATC_DEPENDENCY_BUFFER_MINUTES` | Non-negative extra delay after a dependency completes before the dependent may begin its first scheduled segment. |
| `ATC_MAX_SCHEDULE_HORIZON_MINUTES` | Positive minute boundary — all runway/gate segments must finish by this time. |
| `ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES` | Positive landing occupancy on the runway. |
| `ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES` | Positive takeoff occupancy on the runway. |
| `ATC_ARRIVAL_GATE_BLOCK_MINUTES` | Positive gate handling block after landing. |
| `ATC_DEPARTURE_GATE_BLOCK_MINUTES` | Positive gate block before takeoff (pushback/prep). |

### Example `.env` fragment

```bash
export ATC_RUNWAY_COUNT=2
export ATC_GATE_COUNT=3
export ATC_GROUND_CREW_COUNT=4
export ATC_RUNWAY_LENGTHS_METERS=2800,3200
export ATC_BUFFER_TAKEOFF_MINUTES=2
export ATC_BUFFER_LANDING_MINUTES=2
export ATC_BUFFER_MIXED_MINUTES=3
export ATC_GATE_TURNAROUND_MINUTES=5
export ATC_DEPENDENCY_BUFFER_MINUTES=15
export ATC_MAX_SCHEDULE_HORIZON_MINUTES=800
export ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES=5
export ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES=5
export ATC_ARRIVAL_GATE_BLOCK_MINUTES=20
export ATC_DEPARTURE_GATE_BLOCK_MINUTES=25
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
        "ATC_RUNWAY_COUNT": "2",
        "ATC_GATE_COUNT": "3",
        "ATC_GROUND_CREW_COUNT": "4",
        "ATC_RUNWAY_LENGTHS_METERS": "2800,3200",
        "ATC_BUFFER_TAKEOFF_MINUTES": "2",
        "ATC_BUFFER_LANDING_MINUTES": "2",
        "ATC_BUFFER_MIXED_MINUTES": "3",
        "ATC_GATE_TURNAROUND_MINUTES": "5",
        "ATC_DEPENDENCY_BUFFER_MINUTES": "15",
        "ATC_MAX_SCHEDULE_HORIZON_MINUTES": "800",
        "ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES": "5",
        "ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES": "5",
        "ATC_ARRIVAL_GATE_BLOCK_MINUTES": "20",
        "ATC_DEPARTURE_GATE_BLOCK_MINUTES": "25"
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
| `submit_flight` | Submit `flightNumber`, `operationType` (`arrival` \| `departure`), `priority` (`high` \| `medium` \| `low`), optional `dependencies` (existing flight UUIDs), optional `minRunwayLengthM`. Invalidates the current schedule until regenerated. |
| `generate_schedule` | Recomputes a full deterministic schedule for all non-cancelled flights; replaces any prior assignment. |
| `get_airport_status` | JSON summary: counts, runway/gate usage hints, constraint settings, blocked/waiting flights, completion minute when a schedule exists. |
| `cancel_flight` | Marks a flight cancelled and clears assignments so dependents are reassessed on the next `generate_schedule`. |
| `analyze_schedule_bottleneck` | Longest dependency chain on the **current** schedule (wall-clock span). Errors if no schedule has been generated yet. |

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

## Operational notes

- **Dependency IDs** must reference flights already submitted (`submit_flight` returns UUID `flightId`s).
- Any **submit** or **cancel** clears the active schedule; call **`generate_schedule`** again before trusting timeline/status/bottleneck output.
