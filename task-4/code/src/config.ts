import * as z from "zod";

const positiveInt = z.coerce.number().int().positive();

const EnvSchema = z.object({
  ATC_RUNWAY_COUNT: positiveInt,
  ATC_GATE_COUNT: positiveInt,
  ATC_GROUND_CREW_COUNT: positiveInt,
  ATC_RUNWAY_LENGTHS_METERS: z
    .string()
    .min(1)
    .describe("Comma-separated runway lengths in meters, one per runway (ascending ids R0,R1,...)"),
  ATC_BUFFER_TAKEOFF_MINUTES: z.coerce.number().int().nonnegative(),
  ATC_BUFFER_LANDING_MINUTES: z.coerce.number().int().nonnegative(),
  ATC_BUFFER_MIXED_MINUTES: z.coerce.number().int().nonnegative(),
  ATC_GATE_TURNAROUND_MINUTES: z.coerce.number().int().nonnegative(),
  ATC_DEPENDENCY_BUFFER_MINUTES: z.coerce.number().int().nonnegative(),
  ATC_MAX_SCHEDULE_HORIZON_MINUTES: positiveInt,
  ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES: positiveInt,
  ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES: positiveInt,
  ATC_ARRIVAL_GATE_BLOCK_MINUTES: positiveInt,
  ATC_DEPARTURE_GATE_BLOCK_MINUTES: positiveInt,
});

export type AirportConfig = {
  runwayCount: number;
  gateCount: number;
  groundCrewCount: number;
  runwayLengthsM: number[];
  bufferTakeoffMinutes: number;
  bufferLandingMinutes: number;
  bufferMixedMinutes: number;
  gateTurnaroundMinutes: number;
  dependencyBufferMinutes: number;
  maxScheduleHorizonMinutes: number;
  arrivalRunwayBlockMinutes: number;
  departureRunwayBlockMinutes: number;
  arrivalGateBlockMinutes: number;
  departureGateBlockMinutes: number;
};

export function loadAirportConfig(env: NodeJS.ProcessEnv = process.env): AirportConfig {
  const parsed = EnvSchema.safeParse(env);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid airport configuration: ${msg}`);
  }
  const e = parsed.data;
  const rawLengths = e.ATC_RUNWAY_LENGTHS_METERS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawLengths.length !== e.ATC_RUNWAY_COUNT) {
    throw new Error(
      `ATC_RUNWAY_LENGTHS_METERS must contain exactly ATC_RUNWAY_COUNT (${e.ATC_RUNWAY_COUNT}) comma-separated values; got ${rawLengths.length}`,
    );
  }
  const runwayLengthsM: number[] = [];
  for (let i = 0; i < rawLengths.length; i++) {
    const n = Number(rawLengths[i]);
    if (!Number.isFinite(n) || n <= 0) {
      throw new Error(`Invalid runway length at index ${i}: "${rawLengths[i]}"`);
    }
    runwayLengthsM.push(n);
  }

  return {
    runwayCount: e.ATC_RUNWAY_COUNT,
    gateCount: e.ATC_GATE_COUNT,
    groundCrewCount: e.ATC_GROUND_CREW_COUNT,
    runwayLengthsM,
    bufferTakeoffMinutes: e.ATC_BUFFER_TAKEOFF_MINUTES,
    bufferLandingMinutes: e.ATC_BUFFER_LANDING_MINUTES,
    bufferMixedMinutes: e.ATC_BUFFER_MIXED_MINUTES,
    gateTurnaroundMinutes: e.ATC_GATE_TURNAROUND_MINUTES,
    dependencyBufferMinutes: e.ATC_DEPENDENCY_BUFFER_MINUTES,
    maxScheduleHorizonMinutes: e.ATC_MAX_SCHEDULE_HORIZON_MINUTES,
    arrivalRunwayBlockMinutes: e.ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES,
    departureRunwayBlockMinutes: e.ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES,
    arrivalGateBlockMinutes: e.ATC_ARRIVAL_GATE_BLOCK_MINUTES,
    departureGateBlockMinutes: e.ATC_DEPARTURE_GATE_BLOCK_MINUTES,
  };
}
