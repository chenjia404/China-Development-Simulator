import type { SimulationCommand } from "./commands";
import type { SimulationResult } from "./engine";

export type WorkerRequest =
  | { requestId: string; type: "PING" }
  | { requestId: string; type: "SIMULATE"; command: SimulationCommand };

export type WorkerResponse =
  | { requestId: string; type: "READY"; version: string }
  | { requestId: string; type: "RESULT"; result: SimulationResult }
  | {
      requestId: string;
      type: "ERROR";
      error: { code: string; message: string };
    };
