import { describe, expect, it } from "vitest";
import { DEFAULT_OPERATION_DURATIONS, loadAirportConfig } from "../config.js";
import type { AirportConfig } from "../config.js";

const officialTaskEnv = {
  RUNWAY_COUNT: "2",
  GATE_COUNT: "3",
  GROUND_CREW_COUNT: "4",
  RUNWAY_LENGTHS: "2800,3200",
  TAKEOFF_BUFFER_MINUTES: "2",
  LANDING_BUFFER_MINUTES: "2",
  MIXED_OPERATION_BUFFER_MINUTES: "3",
  GATE_TURNAROUND_MINUTES: "5",
  DEPENDENCY_BUFFER_MINUTES: "15",
  MAX_SCHEDULING_HORIZON_MINUTES: "800",
};

const blockDurationOverrides = {
  ARRIVAL_RUNWAY_BLOCK_MINUTES: "5",
  DEPARTURE_RUNWAY_BLOCK_MINUTES: "5",
  ARRIVAL_GATE_BLOCK_MINUTES: "20",
  DEPARTURE_GATE_BLOCK_MINUTES: "25",
};

function expectedFromSample(overrides: Partial<AirportConfig> = {}): AirportConfig {
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
    arrivalRunwayBlockMinutes: DEFAULT_OPERATION_DURATIONS.ARRIVAL_RUNWAY_BLOCK_MINUTES,
    departureRunwayBlockMinutes: DEFAULT_OPERATION_DURATIONS.DEPARTURE_RUNWAY_BLOCK_MINUTES,
    arrivalGateBlockMinutes: DEFAULT_OPERATION_DURATIONS.ARRIVAL_GATE_BLOCK_MINUTES,
    departureGateBlockMinutes: DEFAULT_OPERATION_DURATIONS.DEPARTURE_GATE_BLOCK_MINUTES,
    ...overrides,
  };
}

describe("loadAirportConfig env aliases", () => {
  it("loads successfully with only the official task env vars", () => {
    const cfg = loadAirportConfig({ ...officialTaskEnv });
    expect(cfg).toEqual(expectedFromSample());
  });

  it("applies default operation durations when overrides are omitted", () => {
    const cfg = loadAirportConfig({ ...officialTaskEnv });
    expect(cfg.arrivalRunwayBlockMinutes).toBe(10);
    expect(cfg.departureRunwayBlockMinutes).toBe(10);
    expect(cfg.arrivalGateBlockMinutes).toBe(20);
    expect(cfg.departureGateBlockMinutes).toBe(20);
  });

  it("loads successfully using only spec env var names with optional duration overrides", () => {
    const cfg = loadAirportConfig({
      ...officialTaskEnv,
      ...blockDurationOverrides,
    });
    expect(cfg).toEqual(
      expectedFromSample({
        arrivalRunwayBlockMinutes: 5,
        departureRunwayBlockMinutes: 5,
        arrivalGateBlockMinutes: 20,
        departureGateBlockMinutes: 25,
      }),
    );
  });

  it("loads successfully using ATC_* fallback names from the spec", () => {
    const cfg = loadAirportConfig({
      ATC_RUNWAY_COUNT: "2",
      ATC_GATE_COUNT: "3",
      ATC_GROUND_CREW_COUNT: "4",
      ATC_RUNWAY_LENGTHS: "2800,3200",
      ATC_TAKEOFF_BUFFER_MINUTES: "2",
      ATC_LANDING_BUFFER_MINUTES: "2",
      ATC_MIXED_OPERATION_BUFFER_MINUTES: "3",
      ATC_GATE_TURNAROUND_MINUTES: "5",
      ATC_DEPENDENCY_BUFFER_MINUTES: "15",
      ATC_MAX_SCHEDULE_HORIZON_MINUTES: "800",
      ...blockDurationOverrides,
    });
    expect(cfg).toEqual(
      expectedFromSample({
        arrivalRunwayBlockMinutes: 5,
        departureRunwayBlockMinutes: 5,
        arrivalGateBlockMinutes: 20,
        departureGateBlockMinutes: 25,
      }),
    );
  });

  it("still supports legacy ATC_BUFFER_* and ATC_RUNWAY_LENGTHS_METERS names", () => {
    const cfg = loadAirportConfig({
      ATC_RUNWAY_COUNT: "2",
      ATC_GATE_COUNT: "3",
      ATC_GROUND_CREW_COUNT: "4",
      ATC_RUNWAY_LENGTHS_METERS: "2800,3200",
      ATC_BUFFER_TAKEOFF_MINUTES: "2",
      ATC_BUFFER_LANDING_MINUTES: "2",
      ATC_BUFFER_MIXED_MINUTES: "3",
      ATC_GATE_TURNAROUND_MINUTES: "5",
      ATC_DEPENDENCY_BUFFER_MINUTES: "15",
      ATC_MAX_SCHEDULE_HORIZON_MINUTES: "800",
      ...blockDurationOverrides,
    });
    expect(cfg).toEqual(
      expectedFromSample({
        arrivalRunwayBlockMinutes: 5,
        departureRunwayBlockMinutes: 5,
        arrivalGateBlockMinutes: 20,
        departureGateBlockMinutes: 25,
      }),
    );
  });

  it("throws when a required env var is missing", () => {
    expect(() => loadAirportConfig({})).toThrow(/Invalid (airport )?configuration/i);
  });

  it("throws when a numeric env var is not an integer", () => {
    expect(() =>
      loadAirportConfig({
        RUNWAY_COUNT: "two",
        GATE_COUNT: "3",
        GROUND_CREW_COUNT: "4",
        RUNWAY_LENGTHS: "2800,3200,2800",
        TAKEOFF_BUFFER_MINUTES: "2",
        LANDING_BUFFER_MINUTES: "2",
        MIXED_OPERATION_BUFFER_MINUTES: "3",
        GATE_TURNAROUND_MINUTES: "5",
        DEPENDENCY_BUFFER_MINUTES: "15",
        MAX_SCHEDULING_HORIZON_MINUTES: "800",
        ...blockDurationOverrides,
      }),
    ).toThrow(/Invalid (airport )?configuration/i);
  });

  it("throws when an operation duration override is zero or negative", () => {
    expect(() =>
      loadAirportConfig({
        ...officialTaskEnv,
        ARRIVAL_RUNWAY_BLOCK_MINUTES: "0",
      }),
    ).toThrow(/Invalid (airport )?configuration/i);

    expect(() =>
      loadAirportConfig({
        ...officialTaskEnv,
        DEPARTURE_GATE_BLOCK_MINUTES: "-3",
      }),
    ).toThrow(/Invalid (airport )?configuration/i);
  });

  it("throws when an operation duration override is not a positive integer", () => {
    expect(() =>
      loadAirportConfig({
        ...officialTaskEnv,
        ARRIVAL_GATE_BLOCK_MINUTES: "abc",
      }),
    ).toThrow(/Invalid (airport )?configuration/i);
  });

  it("throws when counts are zero or negative", () => {
    expect(() =>
      loadAirportConfig({
        RUNWAY_COUNT: "0",
        GATE_COUNT: "3",
        GROUND_CREW_COUNT: "4",
        RUNWAY_LENGTHS: "2800",
        TAKEOFF_BUFFER_MINUTES: "2",
        LANDING_BUFFER_MINUTES: "2",
        MIXED_OPERATION_BUFFER_MINUTES: "3",
        GATE_TURNAROUND_MINUTES: "5",
        DEPENDENCY_BUFFER_MINUTES: "15",
        MAX_SCHEDULING_HORIZON_MINUTES: "800",
        ...blockDurationOverrides,
      }),
    ).toThrow(/Invalid (airport )?configuration/i);

    expect(() =>
      loadAirportConfig({
        RUNWAY_COUNT: "2",
        GATE_COUNT: "-1",
        GROUND_CREW_COUNT: "4",
        RUNWAY_LENGTHS: "2800,3200",
        TAKEOFF_BUFFER_MINUTES: "2",
        LANDING_BUFFER_MINUTES: "2",
        MIXED_OPERATION_BUFFER_MINUTES: "3",
        GATE_TURNAROUND_MINUTES: "5",
        DEPENDENCY_BUFFER_MINUTES: "15",
        MAX_SCHEDULING_HORIZON_MINUTES: "800",
        ...blockDurationOverrides,
      }),
    ).toThrow(/Invalid (airport )?configuration/i);
  });

  it("throws when buffer minutes are negative", () => {
    expect(() =>
      loadAirportConfig({
        RUNWAY_COUNT: "2",
        GATE_COUNT: "3",
        GROUND_CREW_COUNT: "4",
        RUNWAY_LENGTHS: "2800,3200",
        TAKEOFF_BUFFER_MINUTES: "-1",
        LANDING_BUFFER_MINUTES: "2",
        MIXED_OPERATION_BUFFER_MINUTES: "3",
        GATE_TURNAROUND_MINUTES: "5",
        DEPENDENCY_BUFFER_MINUTES: "15",
        MAX_SCHEDULING_HORIZON_MINUTES: "800",
        ...blockDurationOverrides,
      }),
    ).toThrow(/Invalid (airport )?configuration/i);
  });

  it("throws when RUNWAY_LENGTHS count does not match RUNWAY_COUNT", () => {
    expect(() =>
      loadAirportConfig({
        RUNWAY_COUNT: "2",
        GATE_COUNT: "3",
        GROUND_CREW_COUNT: "4",
        RUNWAY_LENGTHS: "2800",
        TAKEOFF_BUFFER_MINUTES: "2",
        LANDING_BUFFER_MINUTES: "2",
        MIXED_OPERATION_BUFFER_MINUTES: "3",
        GATE_TURNAROUND_MINUTES: "5",
        DEPENDENCY_BUFFER_MINUTES: "15",
        MAX_SCHEDULING_HORIZON_MINUTES: "800",
        ...blockDurationOverrides,
      }),
    ).toThrow(/RUNWAY_LENGTHS must contain exactly|Invalid (airport )?configuration/i);
  });

  it("loads operation block durations from ATC_* fallbacks only", () => {
    const cfg = loadAirportConfig({
      ...officialTaskEnv,
      ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES: "5",
      ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES: "5",
      ATC_ARRIVAL_GATE_BLOCK_MINUTES: "20",
      ATC_DEPARTURE_GATE_BLOCK_MINUTES: "25",
    });
    expect(cfg).toEqual(
      expectedFromSample({
        arrivalRunwayBlockMinutes: 5,
        departureRunwayBlockMinutes: 5,
        arrivalGateBlockMinutes: 20,
        departureGateBlockMinutes: 25,
      }),
    );
  });

  it("prefers spec operation block names over ATC_* when both are set", () => {
    const cfg = loadAirportConfig({
      ...officialTaskEnv,
      ARRIVAL_RUNWAY_BLOCK_MINUTES: "5",
      ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES: "99",
      DEPARTURE_RUNWAY_BLOCK_MINUTES: "5",
      ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES: "99",
      ARRIVAL_GATE_BLOCK_MINUTES: "20",
      ATC_ARRIVAL_GATE_BLOCK_MINUTES: "99",
      DEPARTURE_GATE_BLOCK_MINUTES: "25",
      ATC_DEPARTURE_GATE_BLOCK_MINUTES: "99",
    });
    expect(cfg).toEqual(
      expectedFromSample({
        arrivalRunwayBlockMinutes: 5,
        departureRunwayBlockMinutes: 5,
        arrivalGateBlockMinutes: 20,
        departureGateBlockMinutes: 25,
      }),
    );
  });

  it("prefers spec env names when both spec and ATC_* aliases are set", () => {
    const cfg = loadAirportConfig({
      RUNWAY_COUNT: "2",
      ATC_RUNWAY_COUNT: "9",
      GATE_COUNT: "3",
      ATC_GATE_COUNT: "9",
      GROUND_CREW_COUNT: "4",
      ATC_GROUND_CREW_COUNT: "9",
      RUNWAY_LENGTHS: "2800,3200",
      ATC_RUNWAY_LENGTHS: "1000,1000",
      TAKEOFF_BUFFER_MINUTES: "2",
      ATC_TAKEOFF_BUFFER_MINUTES: "99",
      LANDING_BUFFER_MINUTES: "2",
      ATC_LANDING_BUFFER_MINUTES: "99",
      MIXED_OPERATION_BUFFER_MINUTES: "3",
      ATC_MIXED_OPERATION_BUFFER_MINUTES: "99",
      GATE_TURNAROUND_MINUTES: "5",
      ATC_GATE_TURNAROUND_MINUTES: "99",
      DEPENDENCY_BUFFER_MINUTES: "15",
      ATC_DEPENDENCY_BUFFER_MINUTES: "99",
      MAX_SCHEDULING_HORIZON_MINUTES: "800",
      ATC_MAX_SCHEDULE_HORIZON_MINUTES: "99",
      ...blockDurationOverrides,
    });
    expect(cfg).toEqual(
      expectedFromSample({
        arrivalRunwayBlockMinutes: 5,
        departureRunwayBlockMinutes: 5,
        arrivalGateBlockMinutes: 20,
        departureGateBlockMinutes: 25,
      }),
    );
  });
});
