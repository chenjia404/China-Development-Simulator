import { access, copyFile, cp, mkdir, rm, writeFile } from "node:fs/promises";
import { constants } from "node:fs";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

function runStaticExport(): Promise<number> {
  return new Promise((resolvePromise, reject) => {
    const child = spawn(
      process.execPath,
      [resolve("node_modules", "vinext", "dist", "cli.js"), "build"],
      {
        cwd: process.cwd(),
        env: { ...process.env, STATIC_EXPORT: "true" },
        stdio: "inherit",
        shell: false,
      },
    );
    child.once("error", reject);
    child.once("exit", (code) => {
      resolvePromise(code ?? -1);
    });
  });
}

async function main(): Promise<void> {
  const vinextClient = resolve("dist", "client");
  const output = resolve("dist-static");
  await rm(output, { recursive: true, force: true });
  const exitCode = await runStaticExport();
  const windowsPrerenderShutdownAssertion =
    process.platform === "win32" && exitCode === 3_221_226_505;
  if (exitCode !== 0 && !windowsPrerenderShutdownAssertion) {
    throw new Error(`静态构建失败，退出码 ${exitCode}`);
  }
  // vinext 在 Windows 关闭预渲染临时服务时可能产生上述特定断言；
  // 只有确认静态首页已经落盘后才接受该退出码。
  await access(resolve(vinextClient, "index.html"), constants.R_OK);
  await cp(vinextClient, output, { recursive: true });
  await copyFile(resolve(output, "index.html"), resolve(output, "404.html"));
  await mkdir(output, { recursive: true });
  await writeFile(resolve(output, ".nojekyll"), "", "utf8");
  process.stdout.write(`纯静态站点已生成：${output}\n`);
}

main().catch((error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
