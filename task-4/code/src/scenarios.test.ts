import { describe, expect, it } from "vitest";
import { loadAirportConfig } from "./config.js";
import type { AirportConfig } from "./config.js";
import type { FlightRecord } from "./domain.js";
import { buildSchedule } from "./scheduler.js";
import { AirportState } from "./state.js";

function sampleCfg(override: Partial<AirportConfig> = {}): AirportConfig {
  return {
    runwayCount: 2,
    gateCount: 3,
    groundCrewCount: 4,
    runwayLengthsM: [2800, 3200],
    bufferTakeoffMinutes: 2,
    bufferLandingMinutes: 2,
    bufferMixedMinutes: 3,
    gateTurnaroundMinutes: 5,
    dependencyBufferMinutes: 15,
    maxScheduleHorizonMinutes: 800,
    arrivalRunwayBlockMinutes: 5,
    departureRunwayBlockMinutes: 5,
    arrivalGateBlockMinutes: 20,
    departureGateBlockMinutes: 25,
    ...override,
  };
}

function runwayGap(
  prev: "takeoff" | "landing",
  next: "takeoff" | "landing",
  cfg: AirportConfig,
): number {
  if (prev === "takeoff" && next === "takeoff") return cfg.bufferTakeoffMinutes;
  if (prev === "landing" && next === "landing") return cfg.bufferLandingMinutes;
  return cfg.bufferMixedMinutes;
}

function assertRunwayFeasible(cfg: AirportConfig, built: ReturnType<typeof buildSchedule>): void {
  for (const segments of built.runwayTimeline) {
    const sorted = [...segments].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      expect(next.startMinute).toBeGreaterThanOrEqual(
        prev.endMinute + runwayGap(prev.kind, next.kind, cfg),
      );
    }
  }
}

function assertGateFeasible(cfg: AirportConfig, built: ReturnType<typeof buildSchedule>): void {
  for (const segments of built.gateTimeline) {
    const sorted = [...segments].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      expect(next.startMinute).toBeGreaterThanOrEqual(prev.endMinute + cfg.gateTurnaroundMinutes);
    }
  }
}

describe("Scenario 1 — Morning Rush (priorities)", () => {
  it("schedules mixed ops without conflicts and prefers higher priority earlier under contention", () => {
    const cfg = sampleCfg({ runwayCount: 1, gateCount: 2, groundCrewCount: 6 });
    const flights: FlightRecord[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        flightNumber: "HV001",
        operationType: "arrival",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        flightNumber: "HV002",
        operationType: "departure",
        priority: "medium",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        flightNumber: "HV003",
        operationType: "arrival",
        priority: "low",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 2,
        cancelled: false,
      },
      {
        id: "44444444-4444-4444-8444-444444444444",
        flightNumber: "HV004",
        operationType: "departure",
        priority: "low",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 3,
        cancelled: false,
      },
    ];

    const built = buildSchedule(cfg, flights);
    assertRunwayFeasible(cfg, built);
    assertGateFeasible(cfg, built);

    expect(built.unscheduled.size).toBe(0);
    expect(built.assignments.size).toBe(4);

    const highStart = built.assignments.get(flights[0]!.id)!.opStartMinute;
    const lowArrStart = built.assignments.get(flights[2]!.id)!.opStartMinute;
    expect(highStart).toBeLessThanOrEqual(lowArrStart);

    const medDep = built.assignments.get(flights[1]!.id)!;
    const lowDep = built.assignments.get(flights[3]!.id)!;
    expect(medDep.opStartMinute).toBeLessThanOrEqual(lowDep.opStartMinute);
  });
});

describe("Scenario 2 — Heavy Hauler", () => {
  it("keeps an oversized departure unscheduled while scheduling others", () => {
    const cfg = sampleCfg({ runwayLengthsM: [2500, 2700] });
    const flights: FlightRecord[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        flightNumber: "WW900",
        operationType: "departure",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 4000,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        flightNumber: "WW901",
        operationType: "arrival",
        priority: "low",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
    ];

    const built = buildSchedule(cfg, flights);
    expect(built.unscheduled.get(flights[0]!.id)?.reason).toBe("NO_SUITABLE_RUNWAY");
    expect(built.assignments.has(flights[1]!.id)).toBe(true);
  });
});

describe("Scenario 3 — Connecting flight", () => {
  it("respects dependency buffer between inbound arrival and outbound departure", () => {
    const cfg = sampleCfg({ runwayCount: 2, gateCount: 3 });
    const inboundId = "cccccccc-cccc-4ccc-8ccc-cccccccccccc";
    const outboundId = "dddddddd-dddd-4ddd-8ddd-dddddddddddd";

    const flights: FlightRecord[] = [
      {
        id: inboundId,
        flightNumber: "CX100",
        operationType: "arrival",
        priority: "medium",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: outboundId,
        flightNumber: "CX200",
        operationType: "departure",
        priority: "medium",
        dependencies: [inboundId],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
    ];

    const built = buildSchedule(cfg, flights);
    expect(built.assignments.size).toBe(2);

    const inbound = built.assignments.get(inboundId)!;
    const outbound = built.assignments.get(outboundId)!;

    const inboundDone = inbound.arrivalGateEnd!;
    const outboundGateStart = outbound.departureGateStart!;
    expect(outboundGateStart).toBeGreaterThanOrEqual(inboundDone + cfg.dependencyBufferMinutes);
  });
});

describe("Determinism", () => {
  it("buildSchedule is deterministic for identical inputs", () => {
    const cfg = sampleCfg();
    const flights: FlightRecord[] = [
      {
        id: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
        flightNumber: "D1",
        operationType: "departure",
        priority: "low",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: "ffffffff-ffff-4fff-8fff-ffffffffffff",
        flightNumber: "A1",
        operationType: "arrival",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
    ];

    const a = buildSchedule(cfg, flights);
    const b = buildSchedule(cfg, flights);

    expect(JSON.stringify([...a.assignments.entries()].sort())).toBe(
      JSON.stringify([...b.assignments.entries()].sort()),
    );
    expect(JSON.stringify([...a.unscheduled.entries()].sort())).toBe(
      JSON.stringify([...b.unscheduled.entries()].sort()),
    );
  });

  it("AirportState fingerprint matches across regenerate without changes", () => {
    const cfg = sampleCfg();
    const env = {
      ATC_RUNWAY_COUNT: String(cfg.runwayCount),
      ATC_GATE_COUNT: String(cfg.gateCount),
      ATC_GROUND_CREW_COUNT: String(cfg.groundCrewCount),
      ATC_RUNWAY_LENGTHS_METERS: cfg.runwayLengthsM.join(","),
      ATC_BUFFER_TAKEOFF_MINUTES: String(cfg.bufferTakeoffMinutes),
      ATC_BUFFER_LANDING_MINUTES: String(cfg.bufferLandingMinutes),
      ATC_BUFFER_MIXED_MINUTES: String(cfg.bufferMixedMinutes),
      ATC_GATE_TURNAROUND_MINUTES: String(cfg.gateTurnaroundMinutes),
      ATC_DEPENDENCY_BUFFER_MINUTES: String(cfg.dependencyBufferMinutes),
      ATC_MAX_SCHEDULE_HORIZON_MINUTES: String(cfg.maxScheduleHorizonMinutes),
      ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES: String(cfg.arrivalRunwayBlockMinutes),
      ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES: String(cfg.departureRunwayBlockMinutes),
      ATC_ARRIVAL_GATE_BLOCK_MINUTES: String(cfg.arrivalGateBlockMinutes),
      ATC_DEPARTURE_GATE_BLOCK_MINUTES: String(cfg.departureGateBlockMinutes),
    };

    const loaded = loadAirportConfig(env);
    const state = new AirportState(loaded);

    state.submitFlight({
      flightNumber: "X",
      operationType: "arrival",
      priority: "medium",
    });
    state.submitFlight({
      flightNumber: "Y",
      operationType: "departure",
      priority: "low",
    });

    state.generateSchedule();
    const f1 = state.getDeterminismFingerprint();
    state.generateSchedule();
    const f2 = state.getDeterminismFingerprint();
    expect(f1).toBe(f2);
  });
});

describe("Cyclic dependencies", () => {
  it("marks cyclic flights as CYCLIC_DEPENDENCY", () => {
    const cfg = sampleCfg();
    const a = "11111111-1111-4111-8111-111111111111";
    const b = "22222222-2222-4222-8222-222222222222";
    const flights: FlightRecord[] = [
      {
        id: a,
        flightNumber: "CA",
        operationType: "arrival",
        priority: "high",
        dependencies: [b],
        minRunwayLengthM: 0,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: b,
        flightNumber: "CB",
        operationType: "departure",
        priority: "high",
        dependencies: [a],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
    ];

    const built = buildSchedule(cfg, flights);
    expect(built.unscheduled.get(a)?.reason).toBe("CYCLIC_DEPENDENCY");
    expect(built.unscheduled.get(b)?.reason).toBe("CYCLIC_DEPENDENCY");
    expect(built.assignments.size).toBe(0);
  });
});
