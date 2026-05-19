import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { afterEach, describe, expect, it } from "vitest";
import type { AirportConfig } from "../config.js";
import { createMcpServer, getMcpRegistrationManifest } from "../index.js";
import { AirportState } from "../tools/state.js";

const REQUIRED_TOOLS = [
  "submit_flight",
  "generate_schedule",
  "get_airport_status",
  "cancel_flight",
  "analyze_bottleneck",
] as const;

const REQUIRED_RESOURCE_URIS = [
  "airport://flight-queue",
  "airport://runways",
  "airport://timeline",
] as const;

function sampleCfg(): AirportConfig {
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
  };
}

describe("MCP registration smoke test", () => {
  let client: Client | undefined;
  let server: ReturnType<typeof createMcpServer> | undefined;

  afterEach(async () => {
    await client?.close();
    await server?.close();
    client = undefined;
    server = undefined;
  });

  it("exports manifest with required tool names and resource URIs", () => {
    const { toolNames, resourceUris } = getMcpRegistrationManifest();
    for (const name of REQUIRED_TOOLS) {
      expect(toolNames).toContain(name);
    }
    for (const uri of REQUIRED_RESOURCE_URIS) {
      expect(resourceUris).toContain(uri);
    }
    expect(toolNames).toContain("analyze_schedule_bottleneck");
  });

  it("registers required tools and resources on the MCP server", async () => {
    const state = new AirportState(sampleCfg());
    server = createMcpServer(state);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    client = new Client({ name: "mcp-smoke-test", version: "1.0.0" });
    await client.connect(clientTransport);

    const { tools } = await client.listTools();
    const registeredToolNames = tools.map((t) => t.name);
    for (const name of REQUIRED_TOOLS) {
      expect(registeredToolNames).toContain(name);
    }
    expect(registeredToolNames).toContain("analyze_schedule_bottleneck");

    const { resources } = await client.listResources();
    const registeredUris = resources.map((r) => r.uri);
    for (const uri of REQUIRED_RESOURCE_URIS) {
      expect(registeredUris).toContain(uri);
    }
  });
});
