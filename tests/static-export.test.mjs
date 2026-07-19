import assert from "node:assert/strict";
import { access, readFile, readdir } from "node:fs/promises";
import test from "node:test";

const outputDirectory = new URL("../dist-static/", import.meta.url);

test("静态部署产物包含可直接访问的首页与回退页", async () => {
  const html = await readFile(new URL("index.html", outputDirectory), "utf8");
  const fallback = await readFile(new URL("404.html", outputDirectory), "utf8");
  assert.match(html, /<html lang="zh-CN">/i);
  assert.match(html, /<title>中国国家发展模拟器<\/title>/i);
  assert.match(html, /正在启动独立模拟核心/);
  assert.equal(fallback, html);
  await access(new URL(".nojekyll", outputDirectory));
});

test("静态部署产物包含浏览器模拟 Worker 和全部首页资源", async () => {
  const html = await readFile(new URL("index.html", outputDirectory), "utf8");
  const assetDirectory = new URL("assets/", outputDirectory);
  const assets = await readdir(assetDirectory);
  assert.ok(
    assets.some((file) => file.startsWith("simulation.worker-") && file.endsWith(".js")),
    "应包含浏览器模拟 Worker",
  );
  const references = [...html.matchAll(/(?:src|href)="(\/assets\/[^"?#]+)[^\"]*"/g)]
    .map((match) => match[1].slice("/assets/".length));
  assert.ok(references.length > 0, "首页应引用构建后的静态资源");
  for (const reference of references) {
    assert.ok(assets.includes(reference), `首页引用的资源不存在：${reference}`);
  }
});

test("静态部署目录不包含服务端运行入口", async () => {
  const entries = await readdir(outputDirectory);
  assert.ok(!entries.includes("server"));
  assert.ok(!entries.includes("index.js"));
});
