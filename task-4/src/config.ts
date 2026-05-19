import * as z from "zod";

const positiveInt = z.coerce.number().int().positive();

/** First defined non-empty env value wins (spec names before fallbacks). */
function pickEnv(env: NodeJS.ProcessEnv, keys: readonly string[]): string | undefined {
  for (const key of keys) {
    const value = env[key];
    if (value !== undefined && value !== "") return value;
  }
  return undefined;
}

function requireEnv(env: NodeJS.ProcessEnv, keys: readonly string[], label: string): string {
  const value = pickEnv(env, keys);
  if (value === undefined) {
    throw new Error(`Invalid airport configuration: missing required ${label} (set one of: ${keys.join(", ")})`);
  }
  return value;
}

/** Defaults when operation-duration env vars are omitted (modeling assumptions, not in task.md). */
export const DEFAULT_OPERATION_DURATIONS = {
  ARRIVAL_RUNWAY_BLOCK_MINUTES: 10,
  DEPARTURE_RUNWAY_BLOCK_MINUTES: 10,
  ARRIVAL_GATE_BLOCK_MINUTES: 20,
  DEPARTURE_GATE_BLOCK_MINUTES: 20,
} as const;

function optionalEnv(env: NodeJS.ProcessEnv, keys: readonly string[], defaultValue: string): string {
  return pickEnv(env, keys) ?? defaultValue;
}

/**
 * Resolve spec and legacy env var names into canonical keys for validation.
 * Spec names take precedence when multiple aliases are set.
 */
export function normalizeAirportEnv(env: NodeJS.ProcessEnv): Record<string, string> {
  return {
    RUNWAY_COUNT: requireEnv(env, ["RUNWAY_COUNT", "ATC_RUNWAY_COUNT"], "runway count"),
    GATE_COUNT: requireEnv(env, ["GATE_COUNT", "ATC_GATE_COUNT"], "gate count"),
    GROUND_CREW_COUNT: requireEnv(env, ["GROUND_CREW_COUNT", "ATC_GROUND_CREW_COUNT"], "ground crew count"),
    RUNWAY_LENGTHS: requireEnv(
      env,
      ["RUNWAY_LENGTHS", "ATC_RUNWAY_LENGTHS", "ATC_RUNWAY_LENGTHS_METERS"],
      "runway lengths",
    ),
    TAKEOFF_BUFFER_MINUTES: requireEnv(
      env,
      ["TAKEOFF_BUFFER_MINUTES", "ATC_TAKEOFF_BUFFER_MINUTES", "ATC_BUFFER_TAKEOFF_MINUTES"],
      "takeoff buffer minutes",
    ),
    LANDING_BUFFER_MINUTES: requireEnv(
      env,
      ["LANDING_BUFFER_MINUTES", "ATC_LANDING_BUFFER_MINUTES", "ATC_BUFFER_LANDING_MINUTES"],
      "landing buffer minutes",
    ),
    MIXED_OPERATION_BUFFER_MINUTES: requireEnv(
      env,
      [
        "MIXED_OPERATION_BUFFER_MINUTES",
        "ATC_MIXED_OPERATION_BUFFER_MINUTES",
        "ATC_BUFFER_MIXED_MINUTES",
      ],
      "mixed operation buffer minutes",
    ),
    GATE_TURNAROUND_MINUTES: requireEnv(
      env,
      ["GATE_TURNAROUND_MINUTES", "ATC_GATE_TURNAROUND_MINUTES"],
      "gate turnaround minutes",
    ),
    DEPENDENCY_BUFFER_MINUTES: requireEnv(
      env,
      ["DEPENDENCY_BUFFER_MINUTES", "ATC_DEPENDENCY_BUFFER_MINUTES"],
      "dependency buffer minutes",
    ),
    MAX_SCHEDULING_HORIZON_MINUTES: requireEnv(
      env,
      [
        "MAX_SCHEDULING_HORIZON_MINUTES",
        "ATC_MAX_SCHEDULE_HORIZON_MINUTES",
        "ATC_MAX_SCHEDULING_HORIZON_MINUTES",
      ],
      "max scheduling horizon minutes",
    ),
    ARRIVAL_RUNWAY_BLOCK_MINUTES: optionalEnv(
      env,
      ["ARRIVAL_RUNWAY_BLOCK_MINUTES", "ATC_ARRIVAL_RUNWAY_BLOCK_MINUTES"],
      String(DEFAULT_OPERATION_DURATIONS.ARRIVAL_RUNWAY_BLOCK_MINUTES),
    ),
    DEPARTURE_RUNWAY_BLOCK_MINUTES: optionalEnv(
      env,
      ["DEPARTURE_RUNWAY_BLOCK_MINUTES", "ATC_DEPARTURE_RUNWAY_BLOCK_MINUTES"],
      String(DEFAULT_OPERATION_DURATIONS.DEPARTURE_RUNWAY_BLOCK_MINUTES),
    ),
    ARRIVAL_GATE_BLOCK_MINUTES: optionalEnv(
      env,
      ["ARRIVAL_GATE_BLOCK_MINUTES", "ATC_ARRIVAL_GATE_BLOCK_MINUTES"],
      String(DEFAULT_OPERATION_DURATIONS.ARRIVAL_GATE_BLOCK_MINUTES),
    ),
    DEPARTURE_GATE_BLOCK_MINUTES: optionalEnv(
      env,
      ["DEPARTURE_GATE_BLOCK_MINUTES", "ATC_DEPARTURE_GATE_BLOCK_MINUTES"],
      String(DEFAULT_OPERATION_DURATIONS.DEPARTURE_GATE_BLOCK_MINUTES),
    ),
  };
}

const NormalizedEnvSchema = z.object({
  RUNWAY_COUNT: positiveInt,
  GATE_COUNT: positiveInt,
  GROUND_CREW_COUNT: positiveInt,
  RUNWAY_LENGTHS: z.string().min(1),
  TAKEOFF_BUFFER_MINUTES: z.coerce.number().int().nonnegative(),
  LANDING_BUFFER_MINUTES: z.coerce.number().int().nonnegative(),
  MIXED_OPERATION_BUFFER_MINUTES: z.coerce.number().int().nonnegative(),
  GATE_TURNAROUND_MINUTES: z.coerce.number().int().nonnegative(),
  DEPENDENCY_BUFFER_MINUTES: z.coerce.number().int().nonnegative(),
  MAX_SCHEDULING_HORIZON_MINUTES: positiveInt,
  ARRIVAL_RUNWAY_BLOCK_MINUTES: positiveInt,
  DEPARTURE_RUNWAY_BLOCK_MINUTES: positiveInt,
  ARRIVAL_GATE_BLOCK_MINUTES: positiveInt,
  DEPARTURE_GATE_BLOCK_MINUTES: positiveInt,
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
  let normalized: Record<string, string>;
  try {
    normalized = normalizeAirportEnv(env);
  } catch (e) {
    throw e instanceof Error ? e : new Error(String(e));
  }

  const parsed = NormalizedEnvSchema.safeParse(normalized);
  if (!parsed.success) {
    const msg = parsed.error.issues
      .map((i) => `${i.path.join(".")}: ${i.message}`)
      .join("; ");
    throw new Error(`Invalid airport configuration: ${msg}`);
  }
  const e = parsed.data;
  const rawLengths = e.RUNWAY_LENGTHS.split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  if (rawLengths.length !== e.RUNWAY_COUNT) {
    throw new Error(
      `RUNWAY_LENGTHS must contain exactly RUNWAY_COUNT (${e.RUNWAY_COUNT}) comma-separated values; got ${rawLengths.length}`,
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
    runwayCount: e.RUNWAY_COUNT,
    gateCount: e.GATE_COUNT,
    groundCrewCount: e.GROUND_CREW_COUNT,
    runwayLengthsM,
    bufferTakeoffMinutes: e.TAKEOFF_BUFFER_MINUTES,
    bufferLandingMinutes: e.LANDING_BUFFER_MINUTES,
    bufferMixedMinutes: e.MIXED_OPERATION_BUFFER_MINUTES,
    gateTurnaroundMinutes: e.GATE_TURNAROUND_MINUTES,
    dependencyBufferMinutes: e.DEPENDENCY_BUFFER_MINUTES,
    maxScheduleHorizonMinutes: e.MAX_SCHEDULING_HORIZON_MINUTES,
    arrivalRunwayBlockMinutes: e.ARRIVAL_RUNWAY_BLOCK_MINUTES,
    departureRunwayBlockMinutes: e.DEPARTURE_RUNWAY_BLOCK_MINUTES,
    arrivalGateBlockMinutes: e.ARRIVAL_GATE_BLOCK_MINUTES,
    departureGateBlockMinutes: e.DEPARTURE_GATE_BLOCK_MINUTES,
  };
}
