# Task 4 — Gap Audit

**Audit date:** 2026-05-19 (updated after operation-duration defaults pass)  
**Scope:** Compare `task-4/` implementation against `task-4/task.md` and the acceptance checklist in the audit brief. Build/test commands were run in `task-4/code/`.

---

## Audit summary

- **Overall status:** **PASS WITH NOTES**
- **Top risks**
  1. **Local `.env` at `task-4/.env`** — Present on disk (untracked); must not be committed; root `.gitignore` does not ignore it (only `task-4/code/.gitignore` ignores `code/.env`).
  2. **No root `package.json`** — Install/build/test only from `task-4/code/`; README documents this, but automated graders expecting `cd task-4 && npm test` will fail unless they read README.
  3. **Default operation durations** — If graders omit block-minute env vars, scheduling uses built-in defaults (10/10/20/20); schedules may differ from a tuned `.env` but startup succeeds with only official `task.md` vars.
- **Recommended next action:** Treat as submission-ready after confirming repo is public and `.env` is not committed; optionally add P1 tests (bottleneck, indirect cancel, invalid runway length) and root `.gitignore` entry for `task-4/.env`.

---

## 1. Build status

| Command | Location | Result |
|---------|----------|--------|
| `npm install` | `task-4/code/` | **Pass** (224 packages, 0 vulnerabilities) |
| `npm run build` (`tsc -p tsconfig.json`) | `task-4/code/` | **Pass** — `dist/` emitted |
| `npm install` / `npm run build` | `task-4/` root | **N/A** — no `package.json` at root |
| Broken scripts | — | None observed; `start`, `dev`, `test`, `build` all defined |

**Install command used:** `cd task-4/code && npm install`  
**Build command used:** `cd task-4/code && npm run build`  
**Commands from `task-4/` root:** Not available (no root package).

---

## 2. Test status

| Command | Location | Result |
|---------|----------|--------|
| `npm test` (`vitest run`) | `task-4/code/` | **Pass** — **29 tests**, **4 files** |
| `npm test` | `task-4/` root | **N/A** |

### Test files

| File | Tests | Focus |
|------|-------|--------|
| `code/src/config.test.ts` | 15 | Official vars only + defaults, optional duration overrides, `ATC_*` aliases, validation |
| `code/src/scenarios.test.ts` | 8 | Morning Rush, Heavy Hauler, Connecting Flight, determinism, runway shape, cycles |
| `code/src/regression.test.ts` | 4 | Cancellation + dependents, horizon, gate bottleneck, ground crew |
| `code/src/mcp.smoke.test.ts` | 2 | Tool/resource registration manifest + in-memory MCP list |

### Scenario coverage vs task brief

| Scenario / area | Automated | Notes |
|-----------------|-----------|--------|
| Morning Rush | **Yes** | Priorities, runway/gate gap feasibility |
| Heavy Hauler | **Yes** | `NO_SUITABLE_RUNWAY`, others still schedule |
| Connecting Flight | **Yes** | Dependency buffer on gate start |
| Cancellation + dependents | **Yes** | Direct dependent; not indirect chain |
| Horizon overflow | **Partial** | Accepts `EXCEEDS_SCHEDULING_HORIZON` or `NO_FEASIBLE_SLOT` |
| Gate / ground crew bottleneck | **Yes** | Peak concurrent gate cap |
| Circular dependency | **Yes** | `CYCLIC_DEPENDENCY` |
| Deterministic repeat scheduling | **Yes** | Fingerprint + `buildSchedule` equality |
| Config validation | **Yes** | Missing, non-integer, zero/negative, negative buffer, length count mismatch |
| Invalid runway length value | **No** | Code throws; not in `config.test.ts` |
| MCP registration smoke | **Yes** | Not full stdio e2e |
| Bottleneck analysis logic | **No** | Tool registered; no unit tests on `bottleneck.ts` |
| Repeated `generate_schedule` no duplicate ops | **Inferred** | `buildSchedule` rebuilds maps; no explicit regression test |
| MCP stdio live client | **No** | In-memory transport only |

---

## 3. Existing implemented features

### Runtime

- TypeScript MCP server: `task-4/code/src/index.ts` → `dist/index.js`.
- **Stdio transport** (`StdioServerTransport`); no HTTP port.
- Startup loads dotenv: `task-4/.env` then `task-4/code/.env` (`loadEnv.ts`).
- Invalid config: message on stderr, `process.exit(1)` (`index.ts` + `config.ts`).
- No `console.log` in `src/`; fatal paths use `console.error`.
- Tools/resources registered in `createMcpServer()` before `connect()` (smoke test + code review).
- **MCP startup with valid env:** tested (subprocess, 500ms) — **0 bytes stdout/stderr** until killed; **inferred** long-running stdio wait.

### Config

- All task capacity/buffer concepts via env: runway/gate/crew counts, runway lengths, takeoff/landing/mixed buffers, gate turnaround, dependency buffer, max horizon.
- **Official names supported** with `ATC_*` and legacy aliases; **spec name wins** when both set (`config.test.ts`).
- Runway capability for Heavy Hauler: `RUNWAY_LENGTHS` + `runwayRequirement.minLength` / `minRunwayLengthM`.
- Four **operation-duration** env vars optional with defaults 10/10/20/20 (documented in README; modeling assumptions, not in `task.md` table).

### Domain model

- `FlightRecord`: flight number, operation type, priority, dependencies, `minRunwayLengthM`, submission order, cancelled flag.
- Submit creates UUID; duplicate `flightNumber` allowed (documented).
- Dependencies: UUIDs of existing flights only; unknown ID throws at submit.

### Scheduler

- Full replace on `generate_schedule` (`buildSchedule` new maps; submit/cancel invalidates).
- Greedy discrete-minute placement with deterministic ordering (priority → submission order → id).
- Runway separation (takeoff/landing/mixed), gate turnaround, runway length, horizon, dependency buffer, cycle detection.
- Ground crew: peak concurrent gate intervals ≤ `GROUND_CREW_COUNT`.
- Unschedule reasons: `CYCLIC_DEPENDENCY`, `DEPENDS_ON_CANCELLED_FLIGHT`, `DEPENDS_ON_UNSCHEDULED_FLIGHT`, `NO_SUITABLE_RUNWAY`, `NO_FEASIBLE_SLOT`, `EXCEEDS_SCHEDULING_HORIZON`.

### MCP tools

| Tool | Registered | Schema / errors |
|------|------------|-----------------|
| `submit_flight` | Yes | Zod; `toolError` on business errors |
| `generate_schedule` | Yes | JSON summary |
| `get_airport_status` | Yes | Structured JSON |
| `cancel_flight` | Yes | `flightId` UUID |
| `analyze_bottleneck` | Yes | Errors if schedule stale |
| `analyze_schedule_bottleneck` | Yes | Deprecated alias |

### MCP resources

| URI | Registered | Content |
|-----|------------|---------|
| `airport://flight-queue` | Yes | All flights + `schedulingStatus`, reasons, assignment |
| `airport://runways` | Yes | Lengths + booked intervals per runway |
| `airport://timeline` | Yes | Chronological segments + `dependsOnFlightIds` |

### Status

- `buildAirportStatus`: counts by state/operation, runway/gate utilization hints, constraint settings, `blockedOrUnscheduledFlights`, `scheduleCompletionMinute`, stale flag.

### Bottleneck

- `analyzeBottleneckChain`: longest scheduled dependency chain by wall-clock span; empty chain returns `elapsedMinutes: 0`; tie-break by span then lexicographic ids.

### Docs

- `task-4/README.md`: install, env tables (spec + legacy), MCP client JSON, tools, resources, tests, troubleshooting, submission note.
- `task-4/report.md`: scheduling approach, cancellation, bottleneck formula, trade-offs.
- `task-4/code/.env.example`: spec names.
- `task-4/code/README.md`: pointer to parent README.

---

## 4. Missing or incomplete features

### P0 — must fix for acceptance

| Gap | Expected | Actual | Impact | Suggested fix |
|-----|----------|--------|--------|---------------|
| *(none identified)* | Core tools, resources, config, scenarios | Implemented and tested | — | — |

### P1 — should fix

| Gap | Expected | Actual | Impact | Suggested fix |
|-----|----------|--------|--------|---------------|
| Bottleneck logic untested | Unit or integration tests for chain order, duration, empty schedule, ties | Only MCP registration smoke | Regressions in grading scenario | Add `bottleneck.test.ts` with small fixed schedules |
| Indirect cancellation chain | Cancel A → B depends on A → C depends on B all blocked | Only direct dependent tested | Edge case may break silently | Extend `regression.test.ts` |
| Invalid runway length env | Startup error for non-numeric / ≤0 length | Implemented in `config.ts` line 157–160 | Untested validation path | Add `config.test.ts` case |
| Ground crew **usage** in status | Capacity/usage if modeled | `groundCrew.configured` + model text only; no peak usage number | Status less actionable under crew binding | Expose peak concurrent gate usage from timelines in `status.ts` |
| Horizon reason ambiguity | Clear `EXCEEDS_SCHEDULING_HORIZON` when appropriate | Test accepts `NO_FEASIBLE_SLOT` too | Weaker diagnosability | Tighten test or improve reason selection in scheduler |
| No explicit `blocked` scheduling status | Queue may distinguish blocked vs unscheduled | Resource uses `unscheduled`; status uses `blockedOrUnscheduledFlights` | Consumers searching for `blocked` string miss it | Document alias or add `schedulingStatus: "blocked"` for dependency-blocked flights |
| `generate_schedule` idempotency | No duplicate timeline rows on repeat | Rebuild logic correct; no dedicated test | Low risk | Add test: two generates → same assignment count and timeline length |

### P2 — nice to have

| Gap | Expected | Actual | Impact | Suggested fix |
|-----|----------|--------|--------|---------------|
| Root `package.json` | Optional `cd task-4` workflow | Only `task-4/code/package.json` | Grader friction | Add root scripts delegating to `code/` |
| `task-4/.env` gitignore | Root env not committed | `code/.gitignore` only; `task-4/.env` untracked but not ignored at repo root | Accidental commit risk | Add `task-4/.env` to repo or task-4 `.gitignore` |
| Dependencies by flight number | Task examples use inbound/outbound narrative | UUID-only; README documents UUID | Clients using flight numbers fail submit | Optional resolver flightNumber → id |
| Runway resource “next free” | Optional availability hint | Only `bookedIntervals` | Manual inspection slightly harder | Compute next-free per runway |
| Priority in status counts | Richer ops picture | Counts by operation/state only | Minor | Add `byPriority` if needed |
| `analyze_schedule_bottleneck` duplicate | Single canonical tool | Extra alias registered | Noise in tool list | Keep documented alias only |
| Live stdio MCP e2e | Full protocol smoke | In-memory transport only | Rare transport regressions | Optional scripted stdio client test |

---

## 5. Risky or unclear areas

1. **Duplicate `flightNumber`** — Allowed by design; dependencies must use `flightId`. Could confuse manual testers using flight numbers in `dependencies`.
2. **Cancelled flights in status list** — `blockedOrUnscheduledFlights` includes `status: "cancelled"` alongside unscheduled; semantically fine but not literally “blocked only.”
3. **`likelyBindingConstraint`** — Heuristic string in status; not validated; may be wrong under mixed contention.
4. **Greedy scheduler** — Documented non-optimal; may leave feasible slots unused while marking `NO_FEASIBLE_SLOT` (acceptable per report).
5. **Stale schedule UX** — After submit/cancel, resources show `awaiting_schedule_regeneration` until `generate_schedule`; correct but easy to misread as broken.
6. **`task-4/.env` on disk** — Git status shows untracked `task-4/.env`; ensure it stays out of commits.
7. **Default operation durations** — Graders supplying only official `task.md` env vars get 10/10/20/20 block minutes unless overridden; documented, not a startup failure.

---

## 6. Exact recommended Cursor prompts

### P1

```
Add unit tests in task-4/code/src/bottleneck.test.ts for analyzeBottleneckChain: empty schedule, single flight, two-flight chain, tie-breaking, and ignored unscheduled/cancelled nodes.
```

```
In task-4/code/src/regression.test.ts, add a test: flight C depends on B depends on A; cancel A; generate_schedule; expect B and C unscheduled with DEPENDS_ON_CANCELLED_FLIGHT and unrelated flights still scheduled.
```

```
Add config.test.ts case: RUNWAY_LENGTHS contains "abc" or "0" and expect Invalid runway length at startup.
```

```
Extend buildAirportStatus to include peak concurrent gate usage (from gate timelines) under resources.groundCrew; add a regression assertion when groundCrewCount is 1.
```

### P2

```
Add task-4/package.json with scripts "install", "build", "test" that cd into code/ and run npm commands.
```

```
Add task-4/.gitignore ignoring .env and document in README that only .env.example is committed.
```

---

## 7. Priority order summary

1. Confirm submission hygiene (public repo, no `.env` committed) — **manual, no code**
2. P1: Bottleneck unit tests
3. P1: Indirect cancellation regression
4. P1: Invalid runway length config test
5. P1: Ground crew peak usage in `get_airport_status`
6. P2: Root package.json delegate + `task-4/.env` gitignore

---

## 8. Requirement checklist

| # | Requirement | Status | Notes |
|---|-------------|--------|-------|
| **1** | **Build and test** | | |
| 1.1 | `npm install` works | **Pass** | `task-4/code/` |
| 1.2 | `npm run build` works | **Pass** | |
| 1.3 | `npm test` works | **Pass** | 29 tests |
| 1.4 | Works from documented directory | **Pass** | README → `task-4/code` |
| **2** | **Runtime / MCP startup** | | |
| 2.1 | Server starts | **Pass** | Tested with full env; stdio silent |
| 2.2 | Stdio transport | **Pass** | Documented + implemented |
| 2.3 | No normal logs on stdout | **Pass** | Code review + smoke |
| 2.4 | Errors to stderr | **Pass** | `console.error` on config failure |
| 2.5 | Tools/resources before connect | **Pass** | `createMcpServer` then `connect` |
| 2.6 | Invalid config exits clearly | **Pass** | Tested + `config.test.ts` |
| **3** | **Environment configuration** | | |
| 3.1 | Runway count | **Pass** | `RUNWAY_COUNT` / `ATC_RUNWAY_COUNT` |
| 3.2 | Gate count | **Pass** | |
| 3.3 | Ground crew count | **Pass** | |
| 3.4 | Takeoff/landing/mixed buffers | **Pass** | |
| 3.5 | Gate turnaround | **Pass** | |
| 3.6 | Dependency buffer | **Pass** | |
| 3.7 | Max scheduling horizon | **Pass** | |
| 3.8 | Runway lengths / capability | **Pass** | `RUNWAY_LENGTHS` |
| 3.9 | Official env names | **Pass** | Spec preferred over `ATC_*` |
| 3.10 | Invalid config validation | **Partial** | Invalid length value not in tests |
| **4** | **Flight submission** | | |
| 4.1 | All fields in model | **Pass** | |
| 4.2 | `submit_flight` supports fields | **Pass** | incl. `runwayRequirement` |
| 4.3 | Dependencies documented | **Pass** | UUIDs in README |
| 4.4 | Runway requirement public shape | **Pass** | `{ minLength }` |
| 4.5 | Invalid op/priority rejected | **Pass** | Zod enum |
| 4.6 | Duplicate flightNumber | **Pass** | Deterministic allow; documented |
| 4.7 | Invalid dependency | **Pass** | Throw at submit |
| **5** | **Scheduling behavior** | | |
| 5.1 | Schedule replaced on generate | **Pass** | |
| 5.2 | No duplicate ops on repeat | **Pass** | Inferred |
| 5.3 | Deterministic | **Pass** | Tested |
| 5.4 | Cancelled skipped | **Pass** | |
| 5.5 | Queue shows unscheduled/cancelled | **Pass** | Resource + list |
| 5.6 | Chronological timeline | **Pass** | |
| 5.7 | Runway constraints | **Pass** | Gap tests in scenarios |
| 5.8 | Gate constraints | **Pass** | |
| 5.9 | Ground crew cap | **Pass** | regression test |
| 5.10 | Dependencies + buffer | **Pass** | Scenario 3 |
| 5.11 | Horizon | **Pass** | regression (partial reason) |
| 5.12 | Priority under contention | **Pass** | Morning Rush test |
| **6** | **Cancellation** | | |
| 6.1 | Cancel capability | **Pass** | `cancel_flight` |
| 6.2 | Mark cancelled, visible | **Pass** | |
| 6.3 | Removed from schedule on refresh | **Pass** | |
| 6.4 | Dependents re-evaluated | **Pass** | Direct case tested |
| 6.5 | Unrelated flights schedule | **Pass** | |
| **7** | **MCP tools** | | |
| 7.1 | submit_flight | **Pass** | |
| 7.2 | generate_schedule | **Pass** | |
| 7.3 | get_airport_status | **Pass** | |
| 7.4 | cancel_flight | **Pass** | |
| 7.5 | analyze_bottleneck | **Pass** | + deprecated alias |
| 7.6 | Documented in README | **Pass** | |
| **8** | **MCP resources** | | |
| 8.1 | flight-queue | **Pass** | Preferred URI |
| 8.2 | runways | **Pass** | |
| 8.3 | timeline | **Pass** | |
| **9** | **Airport status** | | |
| 9.1 | Counts by state/type | **Pass** | |
| 9.2 | Runway/gate capacity usage | **Pass** | Utilization indicators |
| 9.3 | Ground crew if modeled | **Partial** | Configured, not live peak |
| 9.4 | Constraint indicators | **Pass** | |
| 9.5 | Unscheduled/blocked + reasons | **Pass** | |
| 9.6 | Schedule completion time | **Pass** | When not stale |
| **10** | **Bottleneck analysis** | | |
| 10.1 | Tool exists | **Pass** | |
| 10.2 | Longest dependency chain | **Pass** | Code + report |
| 10.3 | Ordered flights + duration | **Pass** | |
| 10.4 | Ignores non-scheduled | **Pass** | Code review |
| 10.5 | Tests | **Fail** | No unit tests |
| **11** | **Validation scenarios** | | |
| 11.1 | Morning Rush | **Pass** | Automated |
| 11.2 | Heavy Hauler | **Pass** | Automated |
| 11.3 | Connecting Flight | **Pass** | Automated |
| 11.4 | Extra scenarios | **Partial** | Cancel/horizon/crew/gate/cycle/MCP smoke |
| **12** | **README.md** | | |
| 12.1 | Install/build/run/client | **Pass** | |
| 12.2 | All env vars + values | **Pass** | Required official vars + optional duration defaults |
| 12.3 | Tools/resources match code | **Pass** | |
| 12.4 | Testing instructions | **Pass** | |
| **13** | **report.md** | | |
| 13.1 | Scheduling approach | **Pass** | |
| 13.2 | Decisions / tools / what worked | **Pass** | |
| 13.3 | Priority, runway/gate/crew, deps, cancel, bottleneck, determinism | **Pass** | |
| **14** | **Submission readiness** | | |
| 14.1 | Source under task-4/ | **Pass** | `task-4/code/` |
| 14.2 | README + report at task-4/ | **Pass** | |
| 14.3 | No secrets committed | **Partial** | `.env` untracked; not in `git ls-files`; root ignore weak |
| 14.4 | Public repo documented | **Pass** | README submission section |
| 14.5 | .gitignore node_modules/dist/.env | **Partial** | `code/.gitignore` only |

---

## Appendix — Detailed section notes (audit brief sections 1–14)

### 1. Build and test status

- **Install:** `cd task-4/code && npm install` — **Pass**
- **Build:** `npm run build` — **Pass**
- **Test:** `npm test` — **Pass**, 29 tests, 4 files
- **Root `task-4/`:** No package.json; commands do not work from root without `cd code`
- **Broken scripts:** None

### 2. Runtime / MCP startup

| Check | Verdict | How verified |
|-------|---------|--------------|
| Starts successfully | Yes | Subprocess with `.env.example` vars |
| Stdio transport | Yes | Code + README |
| stdout clean | Yes | 0 stdout bytes in 500ms sample |
| stderr for errors | Yes | `loadAirportConfig({})` message |
| Registration before connect | Yes | `mcp.smoke.test.ts` |
| Invalid config | Yes | Exit 1 + tests |

### 3. Environment configuration

All listed official variables supported. Legacy `ATC_*` aliases work; spec wins. README documents both. Operation block minutes are optional with defaults 10/10/20/20 (`config.test.ts` covers official-only load, defaults, invalid overrides, `ATC_*` duration aliases). Invalid cases: missing required vars, bad integer, zero/negative counts, negative buffers, invalid duration overrides, runway count mismatch — tested; invalid runway **value** — code only.

### 4. Flight submission model

Full support via `submit_flight` and `AirportState.submitFlight`. Dependencies are **flight IDs (UUID)**, not flight numbers — README clear. `runwayRequirement.minLength` supported; legacy `minRunwayLengthM` accepted.

### 5. Scheduling behavior

Implementation matches brief; greedy limitations documented in `report.md`. No separate `blocked` queue status string — reasons on `unscheduled`.

### 6. Cancellation behavior

`cancelFlight` invalidates schedule; regeneration applies `DEPENDS_ON_CANCELLED_FLIGHT`. Direct dependent covered by tests.

### 7–10. MCP tools, resources, status, bottleneck

Preferred names and URIs used. Structured JSON outputs. `analyze_bottleneck` requires fresh schedule. Bottleneck algorithm in `bottleneck.ts` matches report; **not unit-tested**.

### 11–14. Tests, README, report, submission

README and report are complete and aligned with code. Test suite substantially covers mandatory scenarios plus several recommended extras. Submission layout correct; manual steps remain (public repo, env hygiene).

---

*End of gap audit.*
