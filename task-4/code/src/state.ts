import { randomUUID } from "node:crypto";
import type { AirportConfig } from "./config.js";
import type {
  FlightRecord,
  OperationType,
  Priority,
  ScheduledAssignment,
  ScheduledGateInterval,
  ScheduledRunwayInterval,
  TimelineEntry,
} from "./domain.js";
import { buildSchedule } from "./scheduler.js";
import type { UnscheduledEntry } from "./scheduler.js";

export class AirportState {
  readonly cfg: AirportConfig;
  private flights = new Map<string, FlightRecord>();
  private submissionCounter = 0;
  private assignments = new Map<string, ScheduledAssignment>();
  private runwayTimeline: ScheduledRunwayInterval[][] = [];
  private gateTimeline: ScheduledGateInterval[][] = [];
  private lastUnscheduled = new Map<string, UnscheduledEntry>();
  private lastBuiltAt: string | null = null;
  private lastScheduleFingerprint: string | null = null;

  constructor(cfg: AirportConfig) {
    this.cfg = cfg;
    this.clearTimelines();
  }

  private invalidateSchedule(): void {
    this.assignments.clear();
    this.lastUnscheduled.clear();
    this.lastBuiltAt = null;
    this.lastScheduleFingerprint = null;
    this.clearTimelines();
  }

  private clearTimelines(): void {
    this.runwayTimeline = Array.from({ length: this.cfg.runwayCount }, () => []);
    this.gateTimeline = Array.from({ length: this.cfg.gateCount }, () => []);
  }

  submitFlight(input: {
    flightNumber: string;
    operationType: OperationType;
    priority: Priority;
    dependencies?: string[];
    minRunwayLengthM?: number;
  }): { flightId: string; flight: FlightRecord } {
    const deps = (input.dependencies ?? []).slice().sort();
    const knownIds = new Set(this.flights.keys());
    for (const d of deps) {
      if (!knownIds.has(d)) {
        throw new Error(`Unknown dependency flight id: ${d}`);
      }
    }

    const id = randomUUID();
    const flight: FlightRecord = {
      id,
      flightNumber: input.flightNumber,
      operationType: input.operationType,
      priority: input.priority,
      dependencies: deps,
      minRunwayLengthM: input.minRunwayLengthM ?? 0,
      submissionOrder: this.submissionCounter++,
      cancelled: false,
    };
    this.flights.set(id, flight);
    this.invalidateSchedule();
    return { flightId: id, flight };
  }

  cancelFlight(flightId: string): FlightRecord {
    const f = this.flights.get(flightId);
    if (!f) throw new Error(`Unknown flight id: ${flightId}`);
    if (f.cancelled) return f;
    const updated = { ...f, cancelled: true };
    this.flights.set(flightId, updated);
    this.invalidateSchedule();
    return updated;
  }

  resetOperations(): void {
    this.flights.clear();
    this.submissionCounter = 0;
    this.invalidateSchedule();
  }

  generateSchedule(): ReturnType<typeof buildSchedule> {
    const list = [...this.flights.values()];
    const built = buildSchedule(this.cfg, list);
    this.assignments = built.assignments;
    this.runwayTimeline = built.runwayTimeline;
    this.gateTimeline = built.gateTimeline;
    this.lastUnscheduled = built.unscheduled;
    this.lastBuiltAt = new Date().toISOString();
    this.lastScheduleFingerprint = stableFingerprint(list, this.cfg, built);
    return built;
  }

  getFlight(id: string): FlightRecord | undefined {
    return this.flights.get(id);
  }

  listFlights(): FlightRecord[] {
    return [...this.flights.values()].sort((a, b) => a.submissionOrder - b.submissionOrder);
  }

  getAssignments(): Map<string, ScheduledAssignment> {
    return this.assignments;
  }

  getLastBuiltAt(): string | null {
    return this.lastBuiltAt;
  }

  getScheduleStale(): boolean {
    return this.lastBuiltAt === null;
  }

  getLastUnscheduled(): Map<string, UnscheduledEntry> {
    return this.lastUnscheduled;
  }

  getRunwayTimeline(): ScheduledRunwayInterval[][] {
    return this.runwayTimeline;
  }

  getGateTimeline(): ScheduledGateInterval[][] {
    return this.gateTimeline;
  }

  scheduleCompletionMinute(): number | null {
    let max = 0;
    let any = false;
    for (const [fid, slot] of this.assignments) {
      const flight = this.flights.get(fid);
      if (!flight) continue;
      const end =
        flight.operationType === "arrival"
          ? slot.arrivalGateEnd!
          : slot.departureRunwayEnd!;
      max = Math.max(max, end);
      any = true;
    }
    return any ? max : null;
  }

  getDeterminismFingerprint(): string | null {
    return this.lastScheduleFingerprint;
  }

  buildTimeline(): TimelineEntry[] {
    const entries: TimelineEntry[] = [];
    const byId = new Map(this.flights);

    for (const [fid, slot] of this.assignments) {
      const f = byId.get(fid);
      if (!f) continue;

      if (f.operationType === "arrival") {
        entries.push({
          minute: slot.arrivalRunwayStart!,
          flightId: fid,
          flightNumber: f.flightNumber,
          operationType: f.operationType,
          resource: "runway",
          resourceIndex: slot.runwayIndex,
          phase: "landing_rollout",
          endMinute: slot.arrivalRunwayEnd!,
        });
        entries.push({
          minute: slot.arrivalGateStart!,
          flightId: fid,
          flightNumber: f.flightNumber,
          operationType: f.operationType,
          resource: "gate",
          resourceIndex: slot.gateIndex,
          phase: "gate_processing",
          endMinute: slot.arrivalGateEnd!,
        });
      } else {
        entries.push({
          minute: slot.departureGateStart!,
          flightId: fid,
          flightNumber: f.flightNumber,
          operationType: f.operationType,
          resource: "gate",
          resourceIndex: slot.gateIndex,
          phase: "gate_pushback_prep",
          endMinute: slot.departureGateEnd!,
        });
        entries.push({
          minute: slot.departureRunwayStart!,
          flightId: fid,
          flightNumber: f.flightNumber,
          operationType: f.operationType,
          resource: "runway",
          resourceIndex: slot.runwayIndex,
          phase: "takeoff_roll",
          endMinute: slot.departureRunwayEnd!,
        });
      }
    }

    entries.sort((a, b) => {
      const m = a.minute - b.minute;
      if (m !== 0) return m;
      const r = a.resource === b.resource ? 0 : a.resource === "gate" ? -1 : 1;
      if (r !== 0) return r;
      return a.flightId.localeCompare(b.flightId);
    });
    return entries;
  }
}

function stableFingerprint(
  flights: FlightRecord[],
  cfg: AirportConfig,
  built: ReturnType<typeof buildSchedule>,
): string {
  const normFlights = [...flights]
    .filter((f) => !f.cancelled)
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((f) => ({
      id: f.id,
      fn: f.flightNumber,
      op: f.operationType,
      pr: f.priority,
      ord: f.submissionOrder,
      deps: f.dependencies.join(","),
      rw: f.minRunwayLengthM,
    }));

  const assigns = [...built.assignments.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return JSON.stringify({ cfg, flights: normFlights, assigns });
}
