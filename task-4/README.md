# Airport ATC MCP Server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that models airport runway/gate scheduling, flight dependencies, and bottleneck analysis. The server speaks **stdio** only (no HTTP port).

Implementation details and design notes: [`report.md`](report.md).

## Prerequisites

- **Node.js** 18+ (20+ recommended)
- **npm**

## Install and build

From this directory (`task-4/`):

```bash
npm install
npm run build
```

This compiles TypeScript into `dist/`. To run without a prior build (development):

```bash
npm run dev
```

Run the test suite:

```bash
npm test
```

## Configuration (environment variables)

Copy [`.env.example`](.env.example) to `.env` in this directory and edit values, or set variables in your MCP client config.

### How `.env` files are loaded

On startup the server loads dotenv files in order (later files override earlier keys):

1. `../.env` — parent of this package (repository root, if present)
2. `.env` — in this directory (`task-4/.env`)

Variables already set in the process environment are not overwritten by dotenv.

### Name precedence

For each setting, **spec names** (left column below) are preferred over **`ATC_*` aliases** when multiple aliases are set. The first non-empty alias in the lookup list wins.

### Required variables

| Spec name | Accepted aliases | Value |
|-----------|------------------|-------|
| `RUNWAY_COUNT` | `ATC_RUNWAY_COUNT` | Positive integer |
| `GATE_COUNT` | `ATC_GATE_COUNT` | Positive integer |
| `GROUND_CREW_COUNT` | `ATC_GROUND_CREW_COUNT` | Positive integer — peak concurrent gate occupations airport-wide |
| `RUNWAY_LENGTHS` | `ATC_RUNWAY_LENGTHS`, `ATC_RUNWAY_LENGTHS_METERS` | Comma-separated positive numbers (meters); **exactly `RUNWAY_COUNT` values** |
| `TAKEOFF_BUFFER_MINUTES` | `ATC_TAKEOFF_BUFFER_MINUTES`, `ATC_BUFFER_TAKEOFF_MINUTES` | Non-negative integer — separation after takeoff before next runway use |
| `LANDING_BUFFER_MINUTES` | `ATC_LANDING_BUFFER_MINUTES`, `ATC_BUFFER_LANDING_MINUTES` | Non-negative integer — separation after landing |
| `MIXED_OPERATION_BUFFER_MINUTES` | `ATC_MIXED_OPERATION_BUFFER_MINUTES`, `ATC_BUFFER_MIXED_MINUTES` | Non-negative integer — takeoff/landing mix buffer |
| `GATE_TURNAROUND_MINUTES` | `ATC_GATE_TURNAROUND_MINUTES` | Non-negative integer — gap between gate users on the same stand |
| `DEPENDENCY_BUFFER_MINUTES` | `ATC_DEPENDENCY_BUFFER_MINUTES` | Non-negative integer — wait after a dependency completes before a dependent may start |
| `MAX_SCHEDULING_HORIZON_MINUTES` | `ATC_MAX_SCHEDULE_HORIZON_MINUTES`, `ATC_MAX_SCHEDULING_HORIZON_MINUTES` | Positive integer — latest minute the scheduler may place operations |

If any required variable is missing or invalid, the process exits with an error before accepting MCP traffic.

### Optional operation durations

These control how long runway and gate segments last in the discrete-time model (not in the official task brief; defaults are built-in assumptions):

| Spec name | Aliases | Default |
|-----------|---------|---------|
| `ARRIVAL_RUNWAY_BLOCK_MINUTES` | `ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES` | `10` |
| `DEPARTURE_RUNWAY_BLOCK_MINUTES` | `ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES` | `10` |
| `ARRIVAL_GATE_BLOCK_MINUTES` | `ATC_ARRIVAL_GATE_BLOCK_MINUTES` | `20` |
| `DEPARTURE_GATE_BLOCK_MINUTES` | `ATC_DEPARTURE_GATE_BLOCK_MINUTES` | `20` |

All must be **positive integers** when set.

## Run the server

After `npm run build`:

```bash
npm start
```

Equivalent:

```bash
node dist/index.js
```

The server blocks on **stdin/stdout** for MCP JSON-RPC. Do not pipe logs to stdout; errors during config load go to **stderr** and exit code `1`.

## Connect from an MCP client

Use a **stdio** MCP server entry pointing at the built entrypoint. Set `cwd` to this directory so `.env` resolves, or pass the same variables under `env`.

### Cursor / Claude Desktop (`mcp.json`)

```json
{
  "mcpServers": {
    "airport-atc": {
      "command": "node",
      "args": ["/absolute/path/to/ai-challenge-2/task-4/dist/index.js"],
      "cwd": "/absolute/path/to/ai-challenge-2/task-4"
    }
  }
}
```

Replace paths with your checkout location. Alternatively inline required env vars under `"env"` instead of using `.env`.

### Typical workflow

1. **`submit_flight`** — add arrivals/departures (invalidates any prior schedule).
2. **`generate_schedule`** — rebuild the plan for all non-cancelled flights.
3. Read **resources** (`airport://…`) or call **`get_airport_status`** / **`analyze_bottleneck`** on the fresh schedule.

Submitting or cancelling a flight clears assignments until **`generate_schedule`** runs again. **`analyze_bottleneck`** returns an error if the schedule is stale or missing.

## Tools reference

| Tool | Arguments | Description |
|------|-----------|-------------|
| `submit_flight` | `flightNumber` (string), `operationType` (`arrival` \| `departure`), `priority` (`high` \| `medium` \| `low`), optional `dependencies` (UUID strings of existing flights), optional `runwayRequirement.minLength` or legacy `minRunwayLengthM` (meters, default 0) | Registers a flight and invalidates the schedule. Returns `flightId` and flight record. |
| `generate_schedule` | _(none)_ | Runs the deterministic greedy scheduler; returns scheduled IDs, `unscheduled` reasons, `completionMinute`, and `determinismFingerprint`. |
| `get_airport_status` | _(none)_ | JSON snapshot: counts, runway/gate usage, config, blocked/waiting flights, completion time, stale flag. |
| `cancel_flight` | `flightId` (UUID) | Marks a flight cancelled and invalidates the schedule. |
| `analyze_bottleneck` | _(none)_ | Longest dependency chain by wall-clock span on the **current** generated schedule. Errors if schedule is stale. |
| `analyze_schedule_bottleneck` | _(none)_ | **Deprecated alias** for `analyze_bottleneck` (same behavior). |

Tool results are JSON text in MCP content parts. Validation or domain errors set `isError` with a message.

## Resources reference

| URI | MCP name | Description |
|-----|----------|-------------|
| `airport://flight-queue` | `flight_queue` | All flights with `schedulingStatus` (`scheduled`, `unscheduled`, `cancelled`, `awaiting_schedule_regeneration`), unschedule reason/detail, and assignment if any. |
| `airport://runways` | `runway_usage` | Per-runway length (meters) and booked runway intervals from the last generated schedule. |
| `airport://timeline` | `operations_timeline` | Chronological gate/runway segments per flight, including `dependsOnFlightIds`. |

All resources return `application/json`.

## Server metadata

- **MCP name:** `airport-atc-mcp`
- **Version:** `1.0.0`
- **Instructions (for clients):** submit flights, call `generate_schedule` to rebuild the plan, read resources for queue/runways/timeline, use `analyze_bottleneck` after scheduling.
