# Task 4 Report — Airport ATC MCP

Implementation source and package: [`code/`](code/) (build with `npm run build` inside that directory).

## Scheduling approach

The scheduler is a **discrete-time greedy constructive algorithm** with **deterministic tie-breaking**:

1. **Cycle detection** — Dependency edges among active flights are scanned with Kahn topological sorting; nodes left with residual in-degree participate in cycles and are marked `CYCLIC_DEPENDENCY` without runway placement attempts.
2. **Topological priority queue** — Remaining flights are processed when their dependencies are satisfied. Among ready flights, ordering is `(priority → submission order → lexicographic flight id)` so higher-priority flights claim earlier feasible slots when competing for the same resources.
3. **Placement search** — For each flight, earliest legal **minute** `t` is scanned upward until `MAX_SCHEDULING_HORIZON_MINUTES`. For each candidate `(t, runway R, gate G)` (nested in ascending index order for determinism):
   - **Arrival**: runway landing `[t, t+rw)`, gate `[t+rw, t+rw+gate)`.
   - **Departure**: gate `[t, t+gate)`, runway takeoff `[t+gate, t+gate+rw)`.
   where `rw` and `gate` come from the operation-duration env vars below.
4. **Feasibility checks** — Same-runway consecutive movements enforce configured separation buffers (`takeoff→takeoff`, `landing→landing`, mixed). Gates enforce turnaround gaps. **Ground crew** is modeled as a **peak concurrent gate-occupancy cap**: at any minute, the number of overlapping gate intervals across all gates may not exceed `GROUND_CREW_COUNT` (validated with a sweep-line counter). This is not a per-stand crew roster; it limits how many flights can be on-gate simultaneously airport-wide.
5. **Dependencies** — A dependent’s earliest start is `max(completion(dep) + DEPENDENCY_BUFFER_MINUTES)`. Completion is end of gate handling for arrivals and end of runway takeoff for departures.

### Operation duration configuration

Segment lengths use **optional** env overrides with code defaults (modeling assumptions not in `task.md`). Spec names are preferred; `ATC_*` names are backwards-compatible aliases. When unset:

| Role | Spec name | Default (minutes) |
|------|-----------|-------------------|
| Arrival runway block | `ARRIVAL_RUNWAY_BLOCK_MINUTES` | 10 |
| Departure runway block | `DEPARTURE_RUNWAY_BLOCK_MINUTES` | 10 |
| Arrival gate block | `ARRIVAL_GATE_BLOCK_MINUTES` | 20 |
| Departure gate block | `DEPARTURE_GATE_BLOCK_MINUTES` | 20 |

Set any of these (or their `ATC_*` aliases) to tune scheduling segment lengths; values must be positive integers.

See [`README.md`](README.md) for the full env table and example overrides.

Strengths: predictable runtime for modest horizons, easy to reason about, deterministic across identical inputs. Weaknesses: not globally optimal (greedy), horizon scanning is \(O(\text{horizon} \cdot R \cdot G \cdot F)\) worst case—acceptable for challenge-sized queues.

## Cancellation behavior

Submitting or cancelling flights **invalidates** stored assignments immediately so tools/resources cannot surface a stale plan. Regeneration recomputes dependents against updated cancellations.

## Bottleneck analysis

On the active schedule graph restricted to **scheduled** flights, dynamic programming memoizes the best dependency chain ending at each node. The reported **`elapsedMinutes`** is the wall-clock span of that chain on the schedule:

\[
\text{elapsedMinutes} = \text{completion}(\text{last flight in chain}) - \text{start}(\text{first flight in chain})
\]

where **start** is the first scheduled segment start (runway start for arrivals, gate start for departures) and **completion** is the last segment end (gate end for arrivals, runway end for departures). Dependency buffers are reflected indirectly in scheduled start times, not added again in this formula. Tie-break uses lexicographic flight-id ordering for stability.

## Tools and techniques

- `@modelcontextprotocol/sdk` with `McpServer` + `StdioServerTransport`
- `zod` for env + tool argument validation
- `vitest` for regression scenarios described in the challenge brief

## What worked / what did not

**Worked**

- Environment-driven configuration with strict startup validation.
- Explicit unschedule reasons (`NO_SUITABLE_RUNWAY`, cycle detection, horizon violations).
- Resource-only inspection keeps AI clients aligned with ground truth JSON.

**Trade-offs / limits**

- Crew modeling is intentionally simple (peak concurrent gate intervals). Real ATC would separate ramp teams by stand category, tow teams, de-icing windows, etc.
- No partial salvage scheduling trying to fit “maximum subset”—if a flight blocks itself, dependents fail predictably instead of reordering the entire MILP.

Future improvement would be an optional **interval-graph** or **CP-SAT** backend behind the same MCP surface if schedule quality becomes critical.
