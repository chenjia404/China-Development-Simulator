/// <reference lib="webworker" />

import type { WorkerRequest, WorkerResponse } from "../simulation";
import { SIMULATION_VERSION } from "../simulation";

const scope: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;

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

  const response: WorkerResponse = {
    requestId: request.requestId,
    type: "ERROR",
    error: {
      code: "ENGINE_NOT_READY",
      message: "模拟引擎将在后续任务中接入。",
    },
  };
  scope.postMessage(response);
});

export {};
