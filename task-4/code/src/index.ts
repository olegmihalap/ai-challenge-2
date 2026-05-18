import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import * as z from "zod";
import { loadAirportConfig } from "./config.js";
import { loadDotenvFiles } from "./loadEnv.js";
import { analyzeBottleneckChain } from "./bottleneck.js";
import { buildAirportStatus } from "./status.js";
import { AirportState } from "./state.js";

function jsonResource(uri: string, text: string) {
  return {
    contents: [
      {
        uri,
        mimeType: "application/json",
        text,
      },
    ],
  };
}

function toolJson(data: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(data, null, 2) }],
  };
}

function toolError(message: string) {
  return {
    isError: true as const,
    content: [{ type: "text" as const, text: message }],
  };
}

export function createMcpServer(state: AirportState): McpServer {
  const server = new McpServer(
    {
      name: "airport-atc-mcp",
      version: "1.0.0",
    },
    {
      instructions:
        "Airport ATC coordination MCP: submit flights, call generate_schedule to rebuild the plan, read resources for queue/runways/timeline, use analyze_schedule_bottleneck after scheduling.",
    },
  );

  server.registerTool(
    "submit_flight",
    {
      description:
        "Submit a new arrival or departure with priority, optional dependency flight IDs (must already exist), and optional minimum runway length in meters.",
      inputSchema: {
        flightNumber: z.string().min(1),
        operationType: z.enum(["arrival", "departure"]),
        priority: z.enum(["high", "medium", "low"]),
        dependencies: z.array(z.string().uuid()).optional(),
        minRunwayLengthM: z.number().nonnegative().optional(),
      },
    },
    async (args) => {
      try {
        const res = state.submitFlight({
          flightNumber: args.flightNumber,
          operationType: args.operationType,
          priority: args.priority,
          dependencies: args.dependencies,
          minRunwayLengthM: args.minRunwayLengthM,
        });
        return toolJson({
          flightId: res.flightId,
          flight: res.flight,
          note: "Schedule invalidated — call generate_schedule to compute a new plan.",
        });
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "generate_schedule",
    {
      description:
        "Replace the current operational schedule with a fresh deterministic solution for all non-cancelled flights using airport configuration (runways, gates, buffers, crew cap).",
    },
    async () => {
      const built = state.generateSchedule();
      return toolJson({
        scheduledFlightIds: [...built.assignments.keys()],
        unscheduled: Object.fromEntries(built.unscheduled),
        completionMinute: state.scheduleCompletionMinute(),
        determinismFingerprint: state.getDeterminismFingerprint(),
      });
    },
  );

  server.registerTool(
    "get_airport_status",
    {
      description:
        "Structured operational snapshot: flight counts, runway/gate usage estimates, constraint configuration, blocked or waiting flights, completion time.",
    },
    async () => {
      const stale = state.getScheduleStale();
      const payload = buildAirportStatus(
        state.cfg,
        state.listFlights(),
        state.getAssignments(),
        state.getLastBuiltAt(),
        stale,
        state.getLastUnscheduled(),
        state.getRunwayTimeline(),
        state.getGateTimeline(),
      );
      return toolJson(payload);
    },
  );

  server.registerTool(
    "cancel_flight",
    {
      description:
        "Mark a flight cancelled and invalidate the current schedule so dependents are re-evaluated on the next generate_schedule.",
      inputSchema: {
        flightId: z.string().uuid(),
      },
    },
    async ({ flightId }) => {
      try {
        const f = state.cancelFlight(flightId);
        return toolJson({
          cancelledFlightId: flightId,
          flight: f,
          note: "Schedule cleared — call generate_schedule to refresh dependent flights.",
        });
      } catch (e) {
        return toolError(e instanceof Error ? e.message : String(e));
      }
    },
  );

  server.registerTool(
    "analyze_schedule_bottleneck",
    {
      description:
        "Find the longest scheduled dependency chain by wall-clock span on the current generated schedule.",
    },
    async () => {
      if (state.getScheduleStale()) {
        return toolError("No generated schedule — call generate_schedule first.");
      }
      const result = analyzeBottleneckChain(state.listFlights(), state.getAssignments());
      return toolJson(result);
    },
  );

  server.registerResource(
    "flight_queue",
    "airport://flight-queue",
    {
      description: "All flights including cancelled and reasons when last schedule was generated.",
      mimeType: "application/json",
    },
    async () => {
      const flights = state.listFlights();
      const assigns = state.getAssignments();
      const unsched = state.getLastUnscheduled();
      const stale = state.getScheduleStale();
      const enriched = flights.map((f) => {
        let schedulingStatus: string;
        if (f.cancelled) schedulingStatus = "cancelled";
        else if (stale) schedulingStatus = "awaiting_schedule_regeneration";
        else if (assigns.has(f.id)) schedulingStatus = "scheduled";
        else schedulingStatus = "unscheduled";

        const u = unsched.get(f.id);
        return {
          ...f,
          schedulingStatus,
          unscheduleReason: u?.reason,
          unscheduleDetail: u?.detail,
          assignment: assigns.get(f.id) ?? null,
        };
      });
      return jsonResource("airport://flight-queue", JSON.stringify({ flights: enriched }, null, 2));
    },
  );

  server.registerResource(
    "runway_usage",
    "airport://runways",
    {
      description: "Per-runway length and booked runway intervals from the last generated schedule.",
      mimeType: "application/json",
    },
    async () => {
      const cfg = state.cfg;
      const runwayTimeline = state.getRunwayTimeline();
      const payload = {
        runways: cfg.runwayLengthsM.map((lengthMeters, index) => ({
          runwayIndex: index,
          lengthMeters,
          bookedIntervals: runwayTimeline[index] ?? [],
        })),
      };
      return jsonResource("airport://runways", JSON.stringify(payload, null, 2));
    },
  );

  server.registerResource(
    "operations_timeline",
    "airport://timeline",
    {
      description:
        "Chronological gate/runway segments including dependency references for each flight.",
      mimeType: "application/json",
    },
    async () => {
      const timeline = state.buildTimeline().map((e) => {
        const f = state.getFlight(e.flightId);
        return {
          ...e,
          dependsOnFlightIds: f?.dependencies ?? [],
        };
      });
      return jsonResource("airport://timeline", JSON.stringify({ timeline }, null, 2));
    },
  );

  return server;
}

async function main(): Promise<void> {
  loadDotenvFiles();
  let cfg;
  try {
    cfg = loadAirportConfig();
  } catch (e) {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const state = new AirportState(cfg);
  const mcp = createMcpServer(state);
  const transport = new StdioServerTransport();
  await mcp.connect(transport);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
