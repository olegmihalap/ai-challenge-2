import type { FlightRecord, ScheduledAssignment } from "../domain.js";

export type BottleneckChainResult =
  | {
      longestDependencyChainFlightIds: string[];
      longestDependencyChainFlightNumbers: string[];
      elapsedMinutes: number;
      explanation: string;
    }
  | {
      longestDependencyChainFlightIds: [];
      longestDependencyChainFlightNumbers: [];
      elapsedMinutes: 0;
      explanation: string;
    };

function segmentStart(flight: FlightRecord, slot: ScheduledAssignment): number {
  return flight.operationType === "arrival"
    ? slot.arrivalRunwayStart!
    : slot.departureGateStart!;
}

function segmentEnd(flight: FlightRecord, slot: ScheduledAssignment): number {
  return flight.operationType === "arrival" ? slot.arrivalGateEnd! : slot.departureRunwayEnd!;
}

function compareChains(
  a: { ids: string[]; start: number; end: number },
  b: { ids: string[]; start: number; end: number },
): number {
  const da = a.end - a.start;
  const db = b.end - b.start;
  if (da !== db) return db - da;
  return a.ids.join(",").localeCompare(b.ids.join(","));
}

/**
 * Longest dependency chain among scheduled flights by wall-clock span from first segment start
 * to last completion in the chain (scheduled reality).
 */
export function analyzeBottleneckChain(
  flights: FlightRecord[],
  assignments: Map<string, ScheduledAssignment>,
): BottleneckChainResult {
  const byId = new Map(flights.map((f) => [f.id, f] as const));
  const scheduledIds = new Set(assignments.keys());

  const memo = new Map<string, { ids: string[]; start: number; end: number }>();

  function bestEndingAt(v: string): { ids: string[]; start: number; end: number } {
    if (memo.has(v)) return memo.get(v)!;
    const f = byId.get(v);
    const slot = assignments.get(v);
    if (!f || !slot) {
      const empty = { ids: [] as string[], start: 0, end: 0 };
      memo.set(v, empty);
      return empty;
    }

    const startV = segmentStart(f, slot);
    const endV = segmentEnd(f, slot);

    const depsIn = f.dependencies.filter((d) => scheduledIds.has(d)).slice().sort();

    if (depsIn.length === 0) {
      const solo = { ids: [v], start: startV, end: endV };
      memo.set(v, solo);
      return solo;
    }

    let best: { ids: string[]; start: number; end: number } | null = null;
    for (const d of depsIn) {
      const sub = bestEndingAt(d);
      if (sub.ids.length === 0) continue;
      const cand = { ids: [...sub.ids, v], start: sub.start, end: endV };
      if (!best || compareChains(cand, best) < 0) best = cand;
    }

    if (!best) {
      const solo = { ids: [v], start: startV, end: endV };
      memo.set(v, solo);
      return solo;
    }

    memo.set(v, best);
    return best;
  }

  let globalBest: { ids: string[]; start: number; end: number } | null = null;

  for (const id of scheduledIds) {
    const cand = bestEndingAt(id);
    if (cand.ids.length === 0) continue;
    if (!globalBest || compareChains(cand, globalBest) < 0) globalBest = cand;
  }

  if (!globalBest || globalBest.ids.length === 0) {
    return {
      longestDependencyChainFlightIds: [],
      longestDependencyChainFlightNumbers: [],
      elapsedMinutes: 0,
      explanation: "No scheduled flights available for bottleneck analysis.",
    };
  }

  const numbers = globalBest.ids.map((id) => byId.get(id)?.flightNumber ?? id);

  return {
    longestDependencyChainFlightIds: globalBest.ids,
    longestDependencyChainFlightNumbers: numbers,
    elapsedMinutes: globalBest.end - globalBest.start,
    explanation:
      "Wall-clock span from the chain root first segment start to the chain leaf completion on the current schedule.",
  };
}
