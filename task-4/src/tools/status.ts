import type { AirportConfig } from "../config.js";
import type { FlightRecord, OperationType } from "../domain.js";
import type { UnscheduledEntry } from "./scheduler.js";

export type AirportStatusPayload = {
  generatedAtIso: string | null;
  scheduleStale: boolean;
  flightCounts: {
    cancelled: number;
    scheduled: number;
    unscheduledAfterLastGeneration: number;
    awaitingSchedule: number;
    byOperationScheduled: Record<OperationType, number>;
    byOperationAwaiting: Record<OperationType, number>;
  };
  resources: {
    runways: {
      index: number;
      lengthMeters: number;
      movementsScheduled: number;
      utilizationIndicator: "idle" | "light" | "busy";
    }[];
    gates: {
      index: number;
      assignmentsScheduled: number;
      utilizationIndicator: "idle" | "light" | "busy";
    }[];
    groundCrew: {
      configured: number;
      model:
        | "Gate occupancy concurrency cap (each flight occupies its gate interval; peak concurrent gate intervals cannot exceed crew count)";
    };
  };
  constraintIndicators: {
    runwaySeparationBuffersMinutes: {
      takeoffToTakeoff: number;
      landingToLanding: number;
      mixed: number;
    };
    gateTurnaroundMinutes: number;
    dependencyBufferMinutes: number;
    maxHorizonMinutes: number;
    likelyBindingConstraint?: string;
  };
  scheduleCompletionMinute: number | null;
  blockedOrUnscheduledFlights: {
    flightId: string;
    flightNumber: string;
    operationType: OperationType;
    status: string;
    reasonCode?: string;
    detail?: string;
  }[];
};

function runwayMoves(runwayTimeline: { flightId: string }[][]): number[] {
  return runwayTimeline.map((r) => r.length);
}

function gateAssignments(gateTimeline: { flightId: string }[][]): number[] {
  return gateTimeline.map((g) => g.length);
}

function utilization(count: number, capacitySoftCap: number): "idle" | "light" | "busy" {
  if (count === 0) return "idle";
  if (count <= capacitySoftCap) return "light";
  return "busy";
}

export function buildAirportStatus(
  cfg: AirportConfig,
  flights: FlightRecord[],
  assignments: Map<string, unknown>,
  lastBuiltAtIso: string | null,
  scheduleStale: boolean,
  lastUnscheduled: Map<string, UnscheduledEntry>,
  runwayTimeline: { flightId: string }[][],
  gateTimeline: { flightId: string }[][],
): AirportStatusPayload {
  const byId = new Map(flights.map((f) => [f.id, f] as const));

  let cancelled = 0;
  let awaitingSchedule = 0;
  const awaitingByOp: Record<OperationType, number> = { arrival: 0, departure: 0 };
  let scheduled = 0;
  const scheduledByOp: Record<OperationType, number> = { arrival: 0, departure: 0 };

  for (const f of flights) {
    if (f.cancelled) {
      cancelled++;
      continue;
    }
    if (scheduleStale || lastBuiltAtIso === null) {
      awaitingSchedule++;
      awaitingByOp[f.operationType]++;
      continue;
    }
    if (assignments.has(f.id)) {
      scheduled++;
      scheduledByOp[f.operationType]++;
    }
  }

  const unscheduledAfterGen =
    scheduleStale || lastBuiltAtIso === null
      ? 0
      : flights.filter((f) => !f.cancelled && !assignments.has(f.id)).length;

  const moves = runwayMoves(runwayTimeline);
  const gateCounts = gateAssignments(gateTimeline);
  const totalMoves = moves.reduce((a, b) => a + b, 0);
  const totalGateOps = gateCounts.reduce((a, b) => a + b, 0);

  let likelyBinding: string | undefined;
  if (totalMoves >= cfg.runwayCount * 4 && totalGateOps >= cfg.gateCount * 3) {
    likelyBinding = "Runway and gate utilization both elevated — contention likely shared.";
  } else if (totalMoves > totalGateOps * 2) {
    likelyBinding = "Runway sequencing / separation buffers likely binding.";
  } else if (totalGateOps > totalMoves * 2) {
    likelyBinding = "Gate turnaround / gate concurrency likely binding.";
  }

  let completion: number | null = null;
  for (const [fid, slot] of assignments) {
    const f = byId.get(fid);
    if (!f || typeof slot !== "object" || slot === null) continue;
    const s = slot as {
      arrivalGateEnd?: number;
      departureRunwayEnd?: number;
    };
    const end =
      f.operationType === "arrival" ? s.arrivalGateEnd ?? null : s.departureRunwayEnd ?? null;
    if (end === null) continue;
    completion = completion === null ? end : Math.max(completion, end);
  }

  const blocked: AirportStatusPayload["blockedOrUnscheduledFlights"] = [];

  for (const f of flights) {
    if (f.cancelled) {
      blocked.push({
        flightId: f.id,
        flightNumber: f.flightNumber,
        operationType: f.operationType,
        status: "cancelled",
      });
      continue;
    }
    if (scheduleStale || lastBuiltAtIso === null) {
      blocked.push({
        flightId: f.id,
        flightNumber: f.flightNumber,
        operationType: f.operationType,
        status: "awaiting_schedule_regeneration",
      });
      continue;
    }
    if (!assignments.has(f.id)) {
      const u = lastUnscheduled.get(f.id);
      blocked.push({
        flightId: f.id,
        flightNumber: f.flightNumber,
        operationType: f.operationType,
        status: "unscheduled",
        reasonCode: u?.reason,
        detail: u?.detail,
      });
    }
  }

  return {
    generatedAtIso: lastBuiltAtIso,
    scheduleStale,
    flightCounts: {
      cancelled,
      scheduled,
      unscheduledAfterLastGeneration: unscheduledAfterGen,
      awaitingSchedule,
      byOperationScheduled: scheduledByOp,
      byOperationAwaiting: awaitingByOp,
    },
    resources: {
      runways: cfg.runwayLengthsM.map((lengthMeters, index) => ({
        index,
        lengthMeters,
        movementsScheduled: moves[index] ?? 0,
        utilizationIndicator: utilization(moves[index] ?? 0, 3),
      })),
      gates: Array.from({ length: cfg.gateCount }, (_, index) => ({
        index,
        assignmentsScheduled: gateCounts[index] ?? 0,
        utilizationIndicator: utilization(gateCounts[index] ?? 0, 3),
      })),
      groundCrew: {
        configured: cfg.groundCrewCount,
        model:
          "Gate occupancy concurrency cap (each flight occupies its gate interval; peak concurrent gate intervals cannot exceed crew count)",
      },
    },
    constraintIndicators: {
      runwaySeparationBuffersMinutes: {
        takeoffToTakeoff: cfg.bufferTakeoffMinutes,
        landingToLanding: cfg.bufferLandingMinutes,
        mixed: cfg.bufferMixedMinutes,
      },
      gateTurnaroundMinutes: cfg.gateTurnaroundMinutes,
      dependencyBufferMinutes: cfg.dependencyBufferMinutes,
      maxHorizonMinutes: cfg.maxScheduleHorizonMinutes,
      likelyBindingConstraint: likelyBinding,
    },
    scheduleCompletionMinute: scheduleStale ? null : completion,
    blockedOrUnscheduledFlights: blocked,
  };
}
