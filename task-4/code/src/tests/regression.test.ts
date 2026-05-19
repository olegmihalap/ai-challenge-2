import { describe, expect, it } from "vitest";
import type { AirportConfig } from "../config.js";
import type { FlightRecord, ScheduledGateInterval } from "../domain.js";
import { buildSchedule } from "../tools/scheduler.js";
import { buildAirportStatus } from "../tools/status.js";
import { AirportState } from "../tools/state.js";

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

function assertNoGateOverlaps(cfg: AirportConfig, built: ReturnType<typeof buildSchedule>): void {
  for (const segments of built.gateTimeline) {
    const sorted = [...segments].sort((a, b) => a.startMinute - b.startMinute);
    for (let i = 1; i < sorted.length; i++) {
      const prev = sorted[i - 1]!;
      const next = sorted[i]!;
      expect(next.startMinute).toBeGreaterThanOrEqual(prev.endMinute + cfg.gateTurnaroundMinutes);
    }
  }
}

function peakConcurrentGateOccupation(intervals: ScheduledGateInterval[]): number {
  type Ev = { t: number; d: number };
  const evs: Ev[] = [];
  for (const g of intervals) {
    evs.push({ t: g.startMinute, d: 1 });
    evs.push({ t: g.endMinute, d: -1 });
  }
  evs.sort((a, b) => (a.t === b.t ? b.d - a.d : a.t - b.t));
  let cur = 0;
  let peak = 0;
  for (const e of evs) {
    cur += e.d;
    peak = Math.max(peak, cur);
  }
  return peak;
}

function allGateIntervals(built: ReturnType<typeof buildSchedule>): ScheduledGateInterval[] {
  return built.gateTimeline.flat();
}

function flightQueueSnapshot(state: AirportState) {
  const flights = state.listFlights();
  const assigns = state.getAssignments();
  const unsched = state.getLastUnscheduled();
  const stale = state.getScheduleStale();
  return flights.map((f) => {
    let schedulingStatus: string;
    if (f.cancelled) schedulingStatus = "cancelled";
    else if (stale) schedulingStatus = "awaiting_schedule_regeneration";
    else if (assigns.has(f.id)) schedulingStatus = "scheduled";
    else schedulingStatus = "unscheduled";

    const u = unsched.get(f.id);
    return {
      flightId: f.id,
      flightNumber: f.flightNumber,
      schedulingStatus,
      unscheduleReason: u?.reason,
    };
  });
}

function airportStatus(state: AirportState) {
  return buildAirportStatus(
    state.cfg,
    state.listFlights(),
    state.getAssignments(),
    state.getLastBuiltAt(),
    state.getScheduleStale(),
    state.getLastUnscheduled(),
    state.getRunwayTimeline(),
    state.getGateTimeline(),
  );
}

describe("P1 — cancellation with dependents", () => {
  it("blocks dependent outbound after inbound cancel; unrelated flights still schedule", () => {
    const cfg = sampleCfg({ runwayCount: 2, gateCount: 3, groundCrewCount: 6 });
    const state = new AirportState(cfg);

    const { flightId: inboundId } = state.submitFlight({
      flightNumber: "IN100",
      operationType: "arrival",
      priority: "medium",
    });
    const { flightId: outboundId } = state.submitFlight({
      flightNumber: "OUT200",
      operationType: "departure",
      priority: "medium",
      dependencies: [inboundId],
    });
    state.submitFlight({
      flightNumber: "FREE300",
      operationType: "arrival",
      priority: "low",
    });

    const first = state.generateSchedule();
    expect(first.assignments.has(inboundId)).toBe(true);
    expect(first.assignments.has(outboundId)).toBe(true);

    state.cancelFlight(inboundId);
    const second = state.generateSchedule();

    expect(state.getFlight(inboundId)?.cancelled).toBe(true);
    expect(second.assignments.has(inboundId)).toBe(false);
    expect(second.assignments.has(outboundId)).toBe(false);
    expect(second.unscheduled.get(outboundId)?.reason).toBe("DEPENDS_ON_CANCELLED_FLIGHT");

    const unrelated = state.listFlights().find((f) => f.flightNumber === "FREE300")!;
    expect(second.assignments.has(unrelated.id)).toBe(true);

    const queue = flightQueueSnapshot(state);
    const outboundInQueue = queue.find((f) => f.flightId === outboundId);
    expect(outboundInQueue).toBeDefined();
    expect(outboundInQueue!.schedulingStatus).toBe("unscheduled");
    expect(outboundInQueue!.unscheduleReason).toBe("DEPENDS_ON_CANCELLED_FLIGHT");

    const status = airportStatus(state);
    const outboundStatus = status.blockedOrUnscheduledFlights.find((f) => f.flightId === outboundId);
    expect(outboundStatus).toMatchObject({
      status: "unscheduled",
      reasonCode: "DEPENDS_ON_CANCELLED_FLIGHT",
    });
    expect(status.blockedOrUnscheduledFlights.some((f) => f.flightId === inboundId && f.status === "cancelled")).toBe(
      true,
    );
  });
});

describe("P1 — horizon overflow", () => {
  it("keeps impossible flights visible with horizon reason in schedule and status", () => {
    const cfg = sampleCfg({
      maxScheduleHorizonMinutes: 10,
      arrivalRunwayBlockMinutes: 5,
      arrivalGateBlockMinutes: 20,
      runwayCount: 2,
      gateCount: 2,
      groundCrewCount: 4,
    });
    const state = new AirportState(cfg);
    const { flightId } = state.submitFlight({
      flightNumber: "HZ001",
      operationType: "arrival",
      priority: "high",
    });

    const built = state.generateSchedule();
    const reason = built.unscheduled.get(flightId)?.reason;
    expect(["EXCEEDS_SCHEDULING_HORIZON", "NO_FEASIBLE_SLOT"]).toContain(reason);
    expect(built.assignments.has(flightId)).toBe(false);

    const queue = flightQueueSnapshot(state);
    expect(queue.find((f) => f.flightId === flightId)).toMatchObject({
      schedulingStatus: "unscheduled",
      unscheduleReason: reason,
    });

    const status = airportStatus(state);
    expect(status.flightCounts.unscheduledAfterLastGeneration).toBeGreaterThanOrEqual(1);
    expect(status.blockedOrUnscheduledFlights).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          flightId,
          flightNumber: "HZ001",
          status: "unscheduled",
          reasonCode: reason,
        }),
      ]),
    );
  });
});

describe("P1 — gate bottleneck", () => {
  it("serializes gate use with one gate and never overlaps intervals", () => {
    const cfg = sampleCfg({
      gateCount: 1,
      runwayCount: 2,
      groundCrewCount: 10,
      maxScheduleHorizonMinutes: 200,
    });
    const flights: FlightRecord[] = [
      {
        id: "11111111-1111-4111-8111-111111111111",
        flightNumber: "G1",
        operationType: "arrival",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: "22222222-2222-4222-8222-222222222222",
        flightNumber: "G2",
        operationType: "arrival",
        priority: "medium",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
      {
        id: "33333333-3333-4333-8333-333333333333",
        flightNumber: "G3",
        operationType: "departure",
        priority: "low",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 2,
        cancelled: false,
      },
    ];

    const built = buildSchedule(cfg, flights);
    assertNoGateOverlaps(cfg, built);

    const scheduled = flights.filter((f) => built.assignments.has(f.id));
    const blocked = flights.filter((f) => built.unscheduled.has(f.id));
    expect(scheduled.length + blocked.length).toBe(flights.length);

    for (const f of blocked) {
      const reason = built.unscheduled.get(f.id)?.reason;
      expect(["NO_FEASIBLE_SLOT", "EXCEEDS_SCHEDULING_HORIZON"]).toContain(reason);
    }

    if (blocked.length > 0) {
      const state = new AirportState(cfg);
      for (const f of flights) {
        state.submitFlight({
          flightNumber: f.flightNumber,
          operationType: f.operationType,
          priority: f.priority,
        });
      }
      state.generateSchedule();
      const status = airportStatus(state);
      expect(status.resources.gates[0]!.assignmentsScheduled).toBeGreaterThan(0);
      expect(status.constraintIndicators.likelyBindingConstraint).toBeDefined();
    }
  });
});

describe("P1 — ground crew bottleneck", () => {
  it("caps peak concurrent gate occupation and leaves overflow flights visible with reasons", () => {
    const cfg = sampleCfg({
      gateCount: 3,
      groundCrewCount: 1,
      runwayCount: 3,
      maxScheduleHorizonMinutes: 80,
    });
    const flights: FlightRecord[] = [
      {
        id: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
        flightNumber: "C1",
        operationType: "arrival",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 0,
        cancelled: false,
      },
      {
        id: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
        flightNumber: "C2",
        operationType: "arrival",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 1,
        cancelled: false,
      },
      {
        id: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
        flightNumber: "C3",
        operationType: "arrival",
        priority: "high",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 2,
        cancelled: false,
      },
      {
        id: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
        flightNumber: "C4",
        operationType: "arrival",
        priority: "medium",
        dependencies: [],
        minRunwayLengthM: 0,
        submissionOrder: 3,
        cancelled: false,
      },
    ];

    const built = buildSchedule(cfg, flights);
    const intervals = allGateIntervals(built);
    expect(peakConcurrentGateOccupation(intervals)).toBeLessThanOrEqual(cfg.groundCrewCount);

    const unscheduled = flights.filter((f) => built.unscheduled.has(f.id));
    expect(unscheduled.length).toBeGreaterThan(0);
    for (const f of unscheduled) {
      const reason = built.unscheduled.get(f.id)?.reason;
      expect(["NO_FEASIBLE_SLOT", "EXCEEDS_SCHEDULING_HORIZON"]).toContain(reason);
    }

    const state = new AirportState(cfg);
    for (const f of flights) {
      state.submitFlight({
        flightNumber: f.flightNumber,
        operationType: f.operationType,
        priority: f.priority,
      });
    }
    state.generateSchedule();
    const status = airportStatus(state);
    expect(status.resources.groundCrew.configured).toBe(1);
    expect(status.flightCounts.unscheduledAfterLastGeneration).toBeGreaterThan(0);
    expect(peakConcurrentGateOccupation(state.getGateTimeline().flat())).toBeLessThanOrEqual(
      cfg.groundCrewCount,
    );

    for (const fn of unscheduled.map((f) => f.flightNumber)) {
      expect(status.blockedOrUnscheduledFlights).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            flightNumber: fn,
            status: "unscheduled",
            reasonCode: expect.stringMatching(/NO_FEASIBLE_SLOT|EXCEEDS_SCHEDULING_HORIZON/),
          }),
        ]),
      );
    }
  });
});
