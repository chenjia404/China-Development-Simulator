import type {
  SimulationCommand,
  SimulationResult,
  WorkerRequest,
  WorkerResponse,
} from "../simulation";

export class SimulationWorkerClient {
  private readonly worker: Worker;
  private readonly pending = new Map<
    string,
    { resolve: (result: SimulationResult) => void; reject: (error: Error) => void }
  >();

  constructor() {
    this.worker = new Worker(
      new URL("../worker/simulation.worker.ts", import.meta.url),
      { type: "module", name: "china-development-simulator" },
    );
    this.worker.addEventListener("message", (event: MessageEvent<WorkerResponse>) => {
      const response = event.data;
      const request = this.pending.get(response.requestId);
      if (!request) return;
      this.pending.delete(response.requestId);
      if (response.type === "ERROR") {
        request.reject(new Error(response.error.message));
      } else if (response.type === "RESULT") {
        request.resolve(response.result);
      }
    });
    this.worker.addEventListener("error", (event) => {
      const error = new Error(event.message || "模拟 Worker 运行失败");
      for (const request of this.pending.values()) request.reject(error);
      this.pending.clear();
    });
  }

  dispatch(command: SimulationCommand): Promise<SimulationResult> {
    const requestId = crypto.randomUUID();
    const message: WorkerRequest = { requestId, type: "SIMULATE", command };
    return new Promise((resolve, reject) => {
      this.pending.set(requestId, { resolve, reject });
      this.worker.postMessage(message);
    });
  }
}

let singleton: SimulationWorkerClient | undefined;

export function getSimulationClient(): SimulationWorkerClient {
  singleton ??= new SimulationWorkerClient();
  return singleton;
}
