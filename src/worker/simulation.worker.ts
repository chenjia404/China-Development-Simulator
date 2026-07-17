/// <reference lib="webworker" />

import type { WorkerRequest, WorkerResponse } from "../simulation";
import { createSimulationEngine, SIMULATION_VERSION } from "../simulation";

const scope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const engine = createSimulationEngine();

scope.addEventListener("message", (event: MessageEvent<WorkerRequest>) => {
  const request = event.data;

  if (request.type === "PING") {
    const response: WorkerResponse = {
      requestId: request.requestId,
      type: "READY",
      version: SIMULATION_VERSION,
    };
    scope.postMessage(response);
    return;
  }

  try {
    const response: WorkerResponse = {
      requestId: request.requestId,
      type: "RESULT",
      result: engine.dispatch(request.command),
    };
    scope.postMessage(response);
  } catch (error) {
    const response: WorkerResponse = {
      requestId: request.requestId,
      type: "ERROR",
      error: {
        code: "SIMULATION_ERROR",
        message: error instanceof Error ? error.message : "未知模拟错误",
      },
    };
    scope.postMessage(response);
  }
});

export {};
