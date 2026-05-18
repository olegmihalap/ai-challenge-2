# Task 4 Report — Airport ATC MCP

Implementation source and package: [`code/`](code/) (build with `npm run build` inside that directory).

## Scheduling approach

The scheduler is a **discrete-time greedy constructive algorithm** with **deterministic tie-breaking**:

1. **Cycle detection** — Dependency edges among active flights are scanned with Kahn topological sorting; nodes left with residual in-degree participate in cycles and are marked `CYCLIC_DEPENDENCY` without runway placement attempts.
2. **Topological priority queue** — Remaining flights are processed when their dependencies are satisfied. Among ready flights, ordering is `(priority → submission order → lexicographic flight id)` so higher-priority flights claim earlier feasible slots when competing for the same resources.
3. **Placement search** — For each flight, earliest legal **minute** `t` is scanned upward until `ATC_MAX_SCHEDULE_HORIZON_MINUTES`. For each candidate `(t, runway R, gate G)` (nested in ascending index order for determinism):
   - **Arrival**: runway landing `[t, t+rw)`, gate `[t+rw, t+rw+gate)`.
   - **Departure**: gate `[t, t+gate)`, runway takeoff `[t+gate, t+gate+rw)`.
4. **Feasibility checks** — Same-runway consecutive movements enforce configured separation buffers (`takeoff→takeoff`, `landing→landing`, mixed). Gates enforce turnaround gaps. **Ground crew** is modeled as a **peak concurrent gate-occupancy cap**: gate intervals may overlap across gates only up to `ATC_GROUND_CREW_COUNT` simultaneous occupations (validated with a sweep-line counter).
5. **Dependencies** — A dependent’s earliest start is `max(completion(dep) + ATC_DEPENDENCY_BUFFER_MINUTES)`. Completion is end of gate handling for arrivals and end of runway takeoff for departures.

Strengths: predictable runtime for modest horizons, easy to reason about, deterministic across identical inputs. Weaknesses: not globally optimal (greedy), horizon scanning is \(O(\text{horizon} \cdot R \cdot G \cdot F)\) worst case—acceptable for challenge-sized queues.

## Cancellation behavior

Submitting or cancelling flights **invalidates** stored assignments immediately so tools/resources cannot surface a stale plan. Regeneration recomputes dependents against updated cancellations.

## Bottleneck analysis

On the active schedule graph restricted to **scheduled** flights, dynamic programming memoizes the best dependency chain ending at each node (max predecessor by wall-clock span `completion(last) − start(first)`). Tie-break uses lexicographic flight-id ordering for stability.

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

- Crew modeling is intentionally simple (gate-interval concurrency). Real ATC would separate ramp teams by stand category, tow teams, de-icing windows, etc.
- No partial salvage scheduling trying to fit “maximum subset”—if a flight blocks itself, dependents fail predictably instead of reordering the entire MILP.

Future improvement would be an optional **interval-graph** or **CP-SAT** backend behind the same MCP surface if schedule quality becomes critical.
