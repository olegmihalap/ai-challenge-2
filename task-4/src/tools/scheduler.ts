import type { AirportConfig } from "../config.js";
import type {
  FlightRecord,
  ScheduledAssignment,
  ScheduledGateInterval,
  ScheduledRunwayInterval,
} from "../domain.js";
import { priorityRank } from "../domain.js";

function compareFlights(a: FlightRecord, b: FlightRecord): number {
  const pr = priorityRank(a.priority) - priorityRank(b.priority);
  if (pr !== 0) return pr;
  const so = a.submissionOrder - b.submissionOrder;
  if (so !== 0) return so;
  return a.id.localeCompare(b.id);
}

function runwayGapMinutes(
  prev: "takeoff" | "landing",
  next: "takeoff" | "landing",
  cfg: AirportConfig,
): number {
  if (prev === "takeoff" && next === "takeoff") return cfg.bufferTakeoffMinutes;
  if (prev === "landing" && next === "landing") return cfg.bufferLandingMinutes;
  return cfg.bufferMixedMinutes;
}

export type UnscheduleReason =
  | "CYCLIC_DEPENDENCY"
  | "DEPENDS_ON_CANCELLED_FLIGHT"
  | "DEPENDS_ON_UNSCHEDULED_FLIGHT"
  | "NO_SUITABLE_RUNWAY"
  | "NO_FEASIBLE_SLOT"
  | "EXCEEDS_SCHEDULING_HORIZON";

export type UnscheduledEntry = { reason: UnscheduleReason; detail?: string };

export type BuiltSchedule = {
  assignments: Map<string, ScheduledAssignment>;
  unscheduled: Map<string, UnscheduledEntry>;
  runwayTimeline: ScheduledRunwayInterval[][];
  gateTimeline: ScheduledGateInterval[][];
};

function findCyclicFlightIds(flights: FlightRecord[]): Set<string> {
  const active = flights.filter((f) => !f.cancelled);
  const idSet = new Set(active.map((f) => f.id));
  const dependents = new Map<string, string[]>();

  for (const f of active) {
    const ds = f.dependencies.filter((d) => idSet.has(d)).slice().sort();
    for (const d of ds) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(f.id);
    }
  }
  for (const [, arr] of dependents) arr.sort((a, b) => a.localeCompare(b));

  const indeg = new Map<string, number>();
  for (const f of active) {
    const ds = f.dependencies.filter((d) => idSet.has(d));
    indeg.set(f.id, ds.length);
  }

  const queue = active.filter((f) => indeg.get(f.id) === 0).sort(compareFlights).map((f) => f.id);
  const processed = new Set<string>();

  while (queue.length) {
    const id = queue.shift()!;
    processed.add(id);
    for (const w of dependents.get(id) ?? []) {
      indeg.set(w, (indeg.get(w) ?? 0) - 1);
      if (indeg.get(w) === 0) {
        queue.push(w);
        queue.sort((a, b) =>
          compareFlights(
            active.find((x) => x.id === a)!,
            active.find((x) => x.id === b)!,
          ),
        );
      }
    }
  }

  const cyclic = new Set<string>();
  for (const f of active) {
    if (!processed.has(f.id)) cyclic.add(f.id);
  }
  return cyclic;
}

function topologicalOrder(flights: FlightRecord[], cyclic: Set<string>): FlightRecord[] {
  const active = flights.filter((f) => !f.cancelled && !cyclic.has(f.id));
  const idSet = new Set(active.map((f) => f.id));
  const dependents = new Map<string, string[]>();

  for (const f of active) {
    const ds = f.dependencies.filter((d) => idSet.has(d)).slice().sort();
    for (const d of ds) {
      if (!dependents.has(d)) dependents.set(d, []);
      dependents.get(d)!.push(f.id);
    }
  }
  for (const [, arr] of dependents) arr.sort((a, b) => a.localeCompare(b));

  const indeg = new Map<string, number>();
  for (const f of active) {
    const ds = f.dependencies.filter((d) => idSet.has(d));
    indeg.set(f.id, ds.length);
  }

  const queue = active.filter((f) => indeg.get(f.id) === 0).sort(compareFlights).map((f) => f.id);
  const order: FlightRecord[] = [];

  while (queue.length) {
    const id = queue.shift()!;
    order.push(active.find((f) => f.id === id)!);
    for (const w of dependents.get(id) ?? []) {
      indeg.set(w, (indeg.get(w) ?? 0) - 1);
      if (indeg.get(w) === 0) {
        queue.push(w);
        queue.sort((a, b) =>
          compareFlights(
            active.find((f) => f.id === a)!,
            active.find((f) => f.id === b)!,
          ),
        );
      }
    }
  }

  return order;
}

function maxConcurrentGateUsage(intervals: ScheduledGateInterval[], cand: ScheduledGateInterval): number {
  type Ev = { t: number; d: number };
  const evs: Ev[] = [];
  for (const g of intervals) {
    evs.push({ t: g.startMinute, d: 1 });
    evs.push({ t: g.endMinute, d: -1 });
  }
  evs.push({ t: cand.startMinute, d: 1 });
  evs.push({ t: cand.endMinute, d: -1 });
  evs.sort((a, b) => (a.t === b.t ? b.d - a.d : a.t - b.t));
  let cur = 0;
  let peak = 0;
  for (const e of evs) {
    cur += e.d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

function gateInsertionOk(
  gateIdx: number,
  cand: ScheduledGateInterval,
  gates: ScheduledGateInterval[][],
  turnaround: number,
  crewLimit: number,
  allGateIntervals: ScheduledGateInterval[],
): boolean {
  const list = gates[gateIdx];
  const merged = [...list, cand].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < merged.length; i++) {
    const prev = merged[i - 1]!;
    const next = merged[i]!;
    if (prev.endMinute + turnaround > next.startMinute) return false;
  }
  return maxConcurrentGateUsage(allGateIntervals, cand) <= crewLimit;
}

function runwayInsertionOk(
  runwayIdx: number,
  cand: ScheduledRunwayInterval,
  runwayTracks: ScheduledRunwayInterval[][],
  cfg: AirportConfig,
): boolean {
  const list = [...runwayTracks[runwayIdx], cand].sort((a, b) => a.startMinute - b.startMinute);
  for (let i = 1; i < list.length; i++) {
    const prev = list[i - 1]!;
    const next = list[i]!;
    const gap = runwayGapMinutes(prev.kind, next.kind, cfg);
    if (prev.endMinute + gap > next.startMinute) return false;
  }
  return true;
}

function completionMinute(flight: FlightRecord, slot: ScheduledAssignment, cfg: AirportConfig): number {
  if (flight.operationType === "arrival") {
    return slot.arrivalGateEnd!;
  }
  return slot.departureRunwayEnd!;
}

function earliestStartFromDeps(
  flight: FlightRecord,
  assignments: Map<string, ScheduledAssignment>,
  flightsById: Map<string, FlightRecord>,
  cfg: AirportConfig,
): number {
  let m = 0;
  for (const did of flight.dependencies) {
    const dep = flightsById.get(did);
    const slot = assignments.get(did);
    if (!dep || !slot) continue;
    m = Math.max(m, completionMinute(dep, slot, cfg) + cfg.dependencyBufferMinutes);
  }
  return m;
}

function fitsHorizon(endMinute: number, cfg: AirportConfig): boolean {
  return endMinute <= cfg.maxScheduleHorizonMinutes;
}

function suitableRunwayExists(flight: FlightRecord, cfg: AirportConfig): boolean {
  return cfg.runwayLengthsM.some((len) => len >= flight.minRunwayLengthM);
}

function minNeededHorizon(flight: FlightRecord, cfg: AirportConfig): number {
  if (flight.operationType === "arrival") {
    return cfg.arrivalRunwayBlockMinutes + cfg.arrivalGateBlockMinutes;
  }
  return cfg.departureGateBlockMinutes + cfg.departureRunwayBlockMinutes;
}

function tryAssignFlight(
  flight: FlightRecord,
  cfg: AirportConfig,
  runwayTracks: ScheduledRunwayInterval[][],
  gateTracks: ScheduledGateInterval[][],
  allGateIntervals: ScheduledGateInterval[],
  assignments: Map<string, ScheduledAssignment>,
  flightsById: Map<string, FlightRecord>,
): ScheduledAssignment | null {
  const maxLenRequired = flight.minRunwayLengthM;
  const suitableRunways: number[] = [];
  for (let r = 0; r < cfg.runwayCount; r++) {
    if (cfg.runwayLengthsM[r]! >= maxLenRequired) suitableRunways.push(r);
  }
  if (suitableRunways.length === 0) return null;

  const lowerStart = earliestStartFromDeps(flight, assignments, flightsById, cfg);

  for (let t = lowerStart; t <= cfg.maxScheduleHorizonMinutes; t++) {
    for (const r of suitableRunways) {
      for (let g = 0; g < cfg.gateCount; g++) {
        let assignment: ScheduledAssignment;
        let rwSeg: ScheduledRunwayInterval;
        let gSeg: ScheduledGateInterval;

        if (flight.operationType === "arrival") {
          const rwStart = t;
          const rwEnd = rwStart + cfg.arrivalRunwayBlockMinutes;
          const gStart = rwEnd;
          const gEnd = gStart + cfg.arrivalGateBlockMinutes;
          if (!fitsHorizon(gEnd, cfg)) continue;

          rwSeg = {
            flightId: flight.id,
            runwayIndex: r,
            startMinute: rwStart,
            endMinute: rwEnd,
            kind: "landing",
          };
          gSeg = {
            flightId: flight.id,
            gateIndex: g,
            startMinute: gStart,
            endMinute: gEnd,
          };

          if (
            !runwayInsertionOk(r, rwSeg, runwayTracks, cfg) ||
            !gateInsertionOk(g, gSeg, gateTracks, cfg.gateTurnaroundMinutes, cfg.groundCrewCount, allGateIntervals)
          ) {
            continue;
          }

          assignment = {
            runwayIndex: r,
            gateIndex: g,
            opStartMinute: t,
            arrivalRunwayStart: rwStart,
            arrivalRunwayEnd: rwEnd,
            arrivalGateStart: gStart,
            arrivalGateEnd: gEnd,
          };
        } else {
          const dgStart = t;
          const dgEnd = dgStart + cfg.departureGateBlockMinutes;
          const rwStart = dgEnd;
          const rwEnd = rwStart + cfg.departureRunwayBlockMinutes;
          if (!fitsHorizon(rwEnd, cfg)) continue;

          gSeg = {
            flightId: flight.id,
            gateIndex: g,
            startMinute: dgStart,
            endMinute: dgEnd,
          };
          rwSeg = {
            flightId: flight.id,
            runwayIndex: r,
            startMinute: rwStart,
            endMinute: rwEnd,
            kind: "takeoff",
          };

          if (
            !gateInsertionOk(g, gSeg, gateTracks, cfg.gateTurnaroundMinutes, cfg.groundCrewCount, allGateIntervals) ||
            !runwayInsertionOk(r, rwSeg, runwayTracks, cfg)
          ) {
            continue;
          }

          assignment = {
            runwayIndex: r,
            gateIndex: g,
            opStartMinute: t,
            departureGateStart: dgStart,
            departureGateEnd: dgEnd,
            departureRunwayStart: rwStart,
            departureRunwayEnd: rwEnd,
          };
        }

        return assignment;
      }
    }
  }

  return null;
}

export function buildSchedule(cfg: AirportConfig, flights: FlightRecord[]): BuiltSchedule {
  const assignments = new Map<string, ScheduledAssignment>();
  const unscheduled = new Map<string, UnscheduledEntry>();

  const runwayTimeline: ScheduledRunwayInterval[][] = Array.from({ length: cfg.runwayCount }, () => []);
  const gateTimeline: ScheduledGateInterval[][] = Array.from({ length: cfg.gateCount }, () => []);
  const allGateIntervals: ScheduledGateInterval[] = [];

  const flightsById = new Map(flights.map((f) => [f.id, f] as const));

  const cyclic = findCyclicFlightIds(flights);
  for (const id of cyclic) {
    unscheduled.set(id, { reason: "CYCLIC_DEPENDENCY" });
  }

  const order = topologicalOrder(flights, cyclic);

  for (const flight of order) {
    const deps = flight.dependencies;
    for (const did of deps) {
      const depF = flightsById.get(did);
      if (!depF || depF.cancelled) {
        unscheduled.set(flight.id, {
          reason: "DEPENDS_ON_CANCELLED_FLIGHT",
          detail: `dependency ${did} missing or cancelled`,
        });
        break;
      }
      if (unscheduled.has(did) || cyclic.has(did)) {
        unscheduled.set(flight.id, {
          reason: "DEPENDS_ON_UNSCHEDULED_FLIGHT",
          detail: `dependency ${did} not scheduled`,
        });
        break;
      }
    }

    if (unscheduled.has(flight.id)) continue;

    if (!suitableRunwayExists(flight, cfg)) {
      unscheduled.set(flight.id, {
        reason: "NO_SUITABLE_RUNWAY",
        detail: `requires ${flight.minRunwayLengthM}m but longest runway is ${Math.max(...cfg.runwayLengthsM, 0)}m`,
      });
      continue;
    }

    const slot = tryAssignFlight(
      flight,
      cfg,
      runwayTimeline,
      gateTimeline,
      allGateIntervals,
      assignments,
      flightsById,
    );

    if (!slot) {
      const needed = minNeededHorizon(flight, cfg);
      const earliest = earliestStartFromDeps(flight, assignments, flightsById, cfg);
      const horizonFail = earliest + needed > cfg.maxScheduleHorizonMinutes;

      unscheduled.set(flight.id, {
        reason: horizonFail ? "EXCEEDS_SCHEDULING_HORIZON" : "NO_FEASIBLE_SLOT",
      });
      continue;
    }

    assignments.set(flight.id, slot);

    if (flight.operationType === "arrival") {
      runwayTimeline[slot.runwayIndex]!.push({
        flightId: flight.id,
        runwayIndex: slot.runwayIndex,
        startMinute: slot.arrivalRunwayStart!,
        endMinute: slot.arrivalRunwayEnd!,
        kind: "landing",
      });
      const gSeg: ScheduledGateInterval = {
        flightId: flight.id,
        gateIndex: slot.gateIndex,
        startMinute: slot.arrivalGateStart!,
        endMinute: slot.arrivalGateEnd!,
      };
      gateTimeline[slot.gateIndex]!.push(gSeg);
      allGateIntervals.push(gSeg);
    } else {
      const gSeg: ScheduledGateInterval = {
        flightId: flight.id,
        gateIndex: slot.gateIndex,
        startMinute: slot.departureGateStart!,
        endMinute: slot.departureGateEnd!,
      };
      gateTimeline[slot.gateIndex]!.push(gSeg);
      allGateIntervals.push(gSeg);
      runwayTimeline[slot.runwayIndex]!.push({
        flightId: flight.id,
        runwayIndex: slot.runwayIndex,
        startMinute: slot.departureRunwayStart!,
        endMinute: slot.departureRunwayEnd!,
        kind: "takeoff",
      });
    }

    for (const rw of runwayTimeline) rw.sort((a, b) => a.startMinute - b.startMinute);
    for (const gs of gateTimeline) gs.sort((a, b) => a.startMinute - b.startMinute);
    allGateIntervals.sort((a, b) => a.startMinute - b.startMinute);
  }

  return { assignments, unscheduled, runwayTimeline, gateTimeline };
}
