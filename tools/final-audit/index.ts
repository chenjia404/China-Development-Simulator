import { mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { runFinalAudit } from "./audit";

async function main(): Promise<void> {
  const output = resolve(process.argv[2] ?? "outputs/final-audit.json");
  const report = await runFinalAudit();
  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, JSON.stringify(report, null, 2), "utf8");
  process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
  if (report.status !== "通过") process.exitCode = 1;
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
