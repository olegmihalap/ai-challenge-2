# Airport ATC MCP Server

This is an **MCP** “air traffic” demo: it schedules flights on runways and gates. The app talks through **stdin / stdout** only (no browser URL, no REST port).

More detail about how it works: [`report.md`](report.md).

You need **Node.js 18+** and **npm**.

## Setup

Open a terminal in the **`task-4`** folder, then:

```bash
npm install
npm run build
```

To run:

```bash
npm start
```

Other commands:

- `npm run dev` — run from source without building first  
- `npm test` — run tests  

## Settings (environment variables)

1. Copy [`.env.example`](.env.example) to `.env` in **`task-4`**, **or**
2. Put the same keys in your MCP app under **env**.

The program reads **`../.env`** (folder above `task-4`), then **`task-4/.env`**. Values in **`task-4/.env`** replace the same names from the first file.

Each setting has a **short name**. You can also use the **`ATC_...`** name from the tables. If both are set for one idea, the short name wins. Wrong or missing settings stop the program and print an error.

### Required

Use **whole numbers**. “0 or more” means `0`, `1`, `2`, …  

“1 or more” means `1`, `2`, `3`, …  

| Setting | Alternate names | Rule |
|---------|-----------------|------|
| `RUNWAY_COUNT` | `ATC_RUNWAY_COUNT` | 1 or more |
| `GATE_COUNT` | `ATC_GATE_COUNT` | 1 or more |
| `GROUND_CREW_COUNT` | `ATC_GROUND_CREW_COUNT` | 1 or more — how many gate jobs can run at once (whole airport) |
| `RUNWAY_LENGTHS` | `ATC_RUNWAY_LENGTHS`, `ATC_RUNWAY_LENGTHS_METERS` | Lengths in meters, separated by commas. **You need one length per runway.** Example: two runways → `2800,3200`. Each length must be greater than 0. |
| `TAKEOFF_BUFFER_MINUTES` | `ATC_TAKEOFF_BUFFER_MINUTES`, `ATC_BUFFER_TAKEOFF_MINUTES` | 0 or more |
| `LANDING_BUFFER_MINUTES` | `ATC_LANDING_BUFFER_MINUTES`, `ATC_BUFFER_LANDING_MINUTES` | 0 or more |
| `MIXED_OPERATION_BUFFER_MINUTES` | `ATC_MIXED_OPERATION_BUFFER_MINUTES`, `ATC_BUFFER_MIXED_MINUTES` | 0 or more |
| `GATE_TURNAROUND_MINUTES` | `ATC_GATE_TURNAROUND_MINUTES` | 0 or more |
| `DEPENDENCY_BUFFER_MINUTES` | `ATC_DEPENDENCY_BUFFER_MINUTES` | 0 or more |
| `MAX_SCHEDULING_HORIZON_MINUTES` | `ATC_MAX_SCHEDULE_HORIZON_MINUTES`, `ATC_MAX_SCHEDULING_HORIZON_MINUTES` | 1 or more |

### Optional (how long each step lasts in the plan)

If you skip these, the defaults are **10**, **10**, **20**, **20** minutes (see table).

| Setting | Alternate | Default |
|---------|-----------|---------|
| `ARRIVAL_RUNWAY_BLOCK_MINUTES` | `ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES` | 10 |
| `DEPARTURE_RUNWAY_BLOCK_MINUTES` | `ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES` | 10 |
| `ARRIVAL_GATE_BLOCK_MINUTES` | `ATC_ARRIVAL_GATE_BLOCK_MINUTES` | 20 |
| `DEPARTURE_GATE_BLOCK_MINUTES` | `ATC_DEPARTURE_GATE_BLOCK_MINUTES` | 20 |

If you set any of these, use a whole number **1 or more**.

## Connect an MCP client

The client starts **Node** and uses **`task-4`** as the working folder (`cwd`). Change the paths to match your PC.

```json
{
  "mcpServers": {
    "airport-atc": {
      "command": "node",
      "args": ["/full/path/to/task-4/dist/index.js"],
      "cwd": "/full/path/to/task-4"
    }
  }
}
```

Do **not** print random text to stdout — the MCP protocol needs a clean pipe.

**Simple use:** add flights → run **`generate_schedule`** → read the list below or ask for status / bottlenecks. After you **add** or **cancel** a flight, run **`generate_schedule`** again before you trust the timeline or **`analyze_bottleneck`**.

## Tools (what you can call)

The answers are JSON. Errors can come back as `isError`.

| Tool | What it does |
|------|----------------|
| `submit_flight` | Add one flight: number, type `arrival` or `departure`, priority `high` / `medium` / `low`. You can add **dependencies** (other flight IDs) and a **minimum runway length** (`runwayRequirement.minLength` or `minRunwayLengthM`). Gives back a **flight ID**. Old plan is thrown away until you schedule again. |
| `generate_schedule` | Builds a new plan for all flights that are not cancelled. |
| `get_airport_status` | Short report: how many flights, how busy runways/gates are, settings, whether the plan is out of date, finish time. |
| `cancel_flight` | Cancel one flight by **ID**. Old plan is thrown away until you schedule again. |
| `analyze_bottleneck` | Finds the slowest **chain of dependent** flights on the **current** plan. Fails if there is no fresh plan. |
| `analyze_schedule_bottleneck` | Old name for **`analyze_bottleneck`** — same thing. |

## Resources (read-only data)

Everything is JSON.

| Address (URI) | Short name | What you get |
|---------------|------------|--------------|
| `airport://flight-queue` | `flight_queue` | Every flight and its state (planned, not planned, cancelled, waiting for new plan…), plus reasons if not planned. |
| `airport://runways` | `runway_usage` | Length of each runway and time blocks reserved on it (from the last **`generate_schedule`**). |
| `airport://timeline` | `operations_timeline` | Events in time order: who uses which gate/runway when, and who they wait for (`dependsOnFlightIds`). |

Server name: **`airport-atc-mcp`** — version **1.0.0**.
