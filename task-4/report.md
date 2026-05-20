## Scheduling approach and key decisions

Scheduling happens in **one-minute steps**. The algorithm is **greedy**: it assigns flights one by one, instead of searching for a perfect overall solution.

First, flights are ordered by **dependencies**. Circular dependencies are detected and marked as `CYCLIC_DEPENDENCY` (those flights cannot be placed). When more than one flight is ready at the same time, the scheduler chooses in this order: **higher priority**, then **earlier submission time**, then **flight id** (alphabetically).

For each flight, it looks for the **earliest minute** that works. It tries runways and gates in a **fixed order** by index. That way, the same input always produces the same output (**deterministic** behaviour).

The scheduler checks **runway spacing** rules, **gate turnaround** gaps, and a simple **ground-crew limit**: across the whole airport, at most `GROUND_CREW_COUNT` flights may be on gates at the same minute (overlapping gate intervals). This is **not** a detailed model of teams at each stand. For dependencies, the child flight must wait until each parent finishes, plus `DEPENDENCY_BUFFER_MINUTES`. For arrivals, “finish” means the end of the gate segment; for departures, it means the end of the take-off segment.

How long runway and gate blocks last is controlled by environment variables with defaults. Details are in [`README.md`](README.md). When the user submits or cancels flights, **old assignments are removed immediately**, so MCP tools cannot show an outdated plan.

**Main limitation:** greedy search is straightforward and sufficiently fast here, but the schedule is **not guaranteed to be the best possible solution** overall.

To report bottlenecks, the code runs **dynamic programming** (a standard technique for chains on a graph) on scheduled flights only. The value **`elapsedMinutes`** is the real time from the start of the first flight in the longest chain to the end of the last flight in that chain.

## Tools and techniques

| Tool or library | How it was used |
|-----------------|-----------------|
| ChatGPT Pro | Understanding the task and writing prompts |
| Cursor | Writing the MCP server code |
| `@modelcontextprotocol/sdk` | Building the MCP server and stdio transport |
| `zod` | Checking environment variables and tool arguments |
| `vitest` | Automated tests based on the challenge brief |

## What worked / what did not

**What worked well:** configuration through environment variables, checked when the server starts; clear error reasons (for example `NO_SUITABLE_RUNWAY`, cycles, time horizon); read-only tools that show the same data as the underlying JSON.

**What did not / limitations:** ground crew is only a **cap on simultaneous gate use**, not separate ramp teams per stand. The scheduler also does **not** try to keep as many flights as possible when some cannot be placed. If a flight cannot be scheduled, dependent flights fail in a simple, predictable way instead of running a heavy global optimization.
