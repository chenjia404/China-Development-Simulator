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
  assert.match(source, /韩国、台湾、香港、新加坡、美国和日本/);
  assert.match(source, /采用推荐组合/);
  assert.match(source, /仍可逐项调整和跨路线混搭/);
});

test("客户端样式为说明文字保留可读字号", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const stylesheet = files.find(
    (file) => file.startsWith("index-") && file.endsWith(".css"),
  );
  assert.ok(stylesheet, "应生成模拟器客户端样式");
  const source = await readFile(new URL(stylesheet, assetsDirectory), "utf8");
  assert.match(source, /body\{[^}]*font:14px\/1\.5/);
  assert.match(source, /\.metric-detail,[^{}]*\{font-size:12px/);
  assert.match(source, /\.brand small,[^{}]*\{font-size:11px/);
  assert.match(source, /\.route-blueprint-card button,[^{}]*\{font-size:12px/);
});

test("客户端展示外债偿付与资本品用汇约束", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /外债余额/);
  assert.match(source, /年度外债偿付/);
  assert.match(source, /资本品外汇满足率/);
  assert.match(source, /外储 \/ 外债/);
});

test("客户端展示可操作科技树和产业升级门槛", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /国家科技树/);
  assert.match(source, /工业影响/);
  assert.match(source, /智能制造/);
  assert.match(source, /科研人才代际缺口/);
  assert.match(source, /科研人才永久损失/);
  assert.match(source, /产业升级准备度/);
  assert.match(source, /设为研究目标/);
  assert.match(source, /科技指数高但产业节点落后/);
});

test("客户端展示十一类工业结构、技术准备度和类别出口", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /工业细分结构/);
  assert.match(source, /工业复杂度/);
  assert.match(source, /高技术工业/);
  assert.match(source, /电子、通信与计算设备/);
  assert.match(source, /精密仪器与医疗设备/);
  assert.match(source, /航空航天与高端装备/);
  assert.match(source, /技术准备/);
});

test("客户端展示可提前发动的治理、工业化与改革国策", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /提前统一国家财政经济/);
  assert.match(source, /提前启动第一个五年计划/);
  assert.match(source, /提前启动三线建设/);
  assert.match(source, /提前推进城市经济体制改革/);
  assert.match(source, /提前实施分税制财政改革/);
  assert.match(source, /国内决策 · 无外交成本/);
  assert.match(source, /战争、灾害、危机和政治运动仍按事件处理/);
});

test("客户端可选择历史、韩国、日本和台湾进行发展对比", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /首页发展对比/);
  assert.match(source, /最新可比数据/);
  assert.match(source, /查看完整年度对比/);
  assert.match(source, /国家发展对比/);
  assert.match(source, /选择经济对比目标/);
  assert.match(source, /韩国/);
  assert.match(source, /日本/);
  assert.match(source, /台湾/);
  assert.match(source, /实际 GDP/);
  assert.match(source, /GDP（现价美元）/);
  assert.match(source, /人均 GDP/);
  assert.match(source, /总人口/);
  assert.match(source, /世界经济排名/);
  assert.match(source, /对比只用于展示，不会改变模拟结果/);
});
