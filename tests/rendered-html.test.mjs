import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import test from "node:test";

async function render() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request("http://localhost/", { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

test("服务端输出模拟器入口和中文元数据", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
  const html = await response.text();
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>中国国家发展模拟器<\/title>/i);
  assert.match(html, /中国国家发展模拟器/);
  assert.match(html, /正在启动独立模拟核心/);
  assert.match(html, /\/og\.png/);
});

test("客户端构建包含自由调整的发展路线蓝图", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /快捷组合/);
  assert.match(source, /不锁定路线/);
  assert.match(source, /台湾、香港、新加坡、美国和日本/);
  assert.match(source, /采用推荐组合/);
  assert.match(source, /仍可逐项调整和跨路线混搭/);
});
