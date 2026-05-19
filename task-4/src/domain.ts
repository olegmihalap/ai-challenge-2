export type OperationType = "arrival" | "departure";
export type Priority = "high" | "medium" | "low";
export type RunwayOpKind = "takeoff" | "landing";

export type FlightRecord = {
  id: string;
  flightNumber: string;
  operationType: OperationType;
  priority: Priority;
  dependencies: string[];
  minRunwayLengthM: number;
  submissionOrder: number;
  cancelled: boolean;
};

export type ScheduledAssignment = {
  runwayIndex: number;
  gateIndex: number;
  /** Start of arrival runway segment or departure gate segment */
  opStartMinute: number;
  arrivalRunwayStart?: number;
  arrivalRunwayEnd?: number;
  arrivalGateStart?: number;
  arrivalGateEnd?: number;
  departureGateStart?: number;
  departureGateEnd?: number;
  departureRunwayStart?: number;
  departureRunwayEnd?: number;
};

export type ScheduledRunwayInterval = {
  flightId: string;
  runwayIndex: number;
  startMinute: number;
  endMinute: number;
  kind: RunwayOpKind;
};

export type ScheduledGateInterval = {
  flightId: string;
  gateIndex: number;
  startMinute: number;
  endMinute: number;
};

export type TimelineEntry = {
  minute: number;
  flightId: string;
  flightNumber: string;
  operationType: OperationType;
  resource: "runway" | "gate";
  resourceIndex: number;
  phase: string;
  endMinute: number;
};

export function priorityRank(p: Priority): number {
  switch (p) {
    case "high":
      return 0;
    case "medium":
      return 1;
    case "low":
      return 2;
    default: {
      const _exhaustive: never = p;
      return _exhaustive;
    }
  }
}
