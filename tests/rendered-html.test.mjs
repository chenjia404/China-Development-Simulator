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
  assert.match(source, /科技工业发展路线/);
  assert.match(source, /轻工业与大众消费/);
  assert.match(source, /电子信息与数字产业/);
  assert.match(source, /航空航天与先进制造/);
  assert.match(source, /48 个月内逐步完成转型/);
  assert.match(source, /当前研究进度损失 35%/);
  assert.match(source, /仍可手动选择单个科技节点/);
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
  assert.match(source, /路线传导/);
  assert.match(source, /当前.*路线会改变各类别的扩张权重/);
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
  assert.match(source, /提前承认私营经济法律地位/);
  assert.match(source, /提前实施分税制财政改革/);
  assert.match(source, /国内决策 · 无外交成本/);
  assert.match(source, /战争、灾害、危机和政治运动仍按事件处理/);
  assert.match(source, /普及九年义务教育/);
  assert.match(source, /启动门槛/);
  assert.match(source, /教育预算至少占财政预算/);
  assert.match(source, /minimumEducationBudgetShare:.12/);
  assert.match(source, /受教育群体成年后才会逐步转化为人力资本/);
  assert.match(source, /财政承诺仍保留/);
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

test("客户端提供可组合的外交取向与多条外交学说", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /外交学说/);
  assert.match(source, /外交学说与阵营取向相互独立/);
  assert.match(source, /放弃对外革命、和平共处/);
  assert.match(source, /对外革命援助/);
  assert.match(source, /非结盟与战略自主/);
  assert.match(source, /发展优先的经贸外交/);
  assert.match(source, /多边制度合作/);
  assert.match(source, /周边睦邻与地区合作/);
  assert.match(source, /苏联、朝鲜、越南等苏系国家/);
  assert.match(source, /对外援助方案/);
  assert.match(source, /暂停政府对外援助/);
  assert.match(source, /史实综合援外规模/);
  assert.match(source, /经贸与技术合作援助/);
  assert.match(source, /1949—1980累计/);
  assert.match(source, /约365亿元人民币/);
  assert.match(source, /当年官方汇率约170亿美元/);
  assert.match(source, /重点受援国/);
  assert.match(source, /国内投资/);
  assert.match(source, /援外用汇/);
  assert.match(source, /中美建交进程/);
  assert.match(source, /一次性外交国策/);
  assert.match(source, /1979年1月/);
  assert.match(source, /相对史实延迟/);
  assert.match(source, /教育交流/);
  assert.match(source, /技术扩散/);
  assert.match(source, /双边贸易由1978年的约11亿美元增至1979年的23亿美元/);
  assert.match(source, /无法事后一次补回的存量差距/);
});

test("客户端展示出口、内需和社会保障的经济传导指标", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /内需规模/);
  assert.match(source, /居民消费/);
  assert.match(source, /消费倾向/);
  assert.match(source, /社保转移收入/);
  assert.match(source, /受内外需求对产能利用的滞后影响/);
  assert.match(source, /降低预防性储蓄，但不直接计入 GDP/);
});

test("客户端展示三种GDP口径和投入产出瓶颈", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /国民经济账户/);
  assert.match(source, /生产法 GDP/);
  assert.match(source, /收入法 GDP/);
  assert.match(source, /支出法 GDP/);
  assert.match(source, /当前投入瓶颈/);
});

test("客户端展示部门价格、实际工资和库存周期", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /部门市场动态/);
  assert.match(source, /居民消费价格 CPI/);
  assert.match(source, /工业生产者价格 PPI/);
  assert.match(source, /实际工资指数/);
  assert.match(source, /综合库存/);
  assert.match(source, /过量实物库存滞后抑制生产/);
});

test("客户端展示年龄性别队列、家庭户、抚养比和城乡迁移", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /人口队列账户/);
  assert.match(source, /家庭户数/);
  assert.match(source, /少儿抚养比/);
  assert.match(source, /老年抚养比/);
  assert.match(source, /本月农村转城市/);
  assert.match(source, /年龄×性别/);
});

test("客户端展示五类所有制企业的生产、就业、投资、出口与融资", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find(
    (file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"),
  );
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /企业部门账户/);
  assert.match(source, /国有企业/);
  assert.match(source, /集体企业/);
  assert.match(source, /民营企业/);
  assert.match(source, /外商投资企业/);
  assert.match(source, /混合所有制企业/);
  assert.match(source, /融资可得/);
});

test("客户端展示中央地方财政、转移支付与五项社会保障", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /中央财政/);
  assert.match(source, /地方财政/);
  assert.match(source, /中央对地方转移支付/);
  assert.match(source, /社会保障储备/);
  assert.match(source, /最低生活保障/);
  assert.match(source, /合并财政内部流量/);
});

test("客户端展示货币银行、汇率与国际收支账户", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /货币银行与国际收支/);
  assert.match(source, /广义货币 M2/);
  assert.match(source, /银行贷款/);
  assert.match(source, /不良贷款/);
  assert.match(source, /经常账户/);
  assert.match(source, /官方汇率/);
});

test("客户端展示农业农村、粮食库存与营养安全", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /农业农村与粮食安全/);
  assert.match(source, /战略粮食储备/);
  assert.match(source, /粮食单产/);
  assert.match(source, /综合粮食保障/);
  assert.match(source, /人均营养供给/);
});

test("客户端展示能源结构、运输网络和环境压力", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /能源运输与资源环境/);
  assert.match(source, /能源进口依赖/);
  assert.match(source, /货运负荷/);
  assert.match(source, /空气污染/);
  assert.match(source, /资源耗竭压力/);
});

test("客户端展示学段、技能就业与疾病负担", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /人力发展账户/);
  assert.match(source, /职业教育/);
  assert.match(source, /高级技能/);
  assert.match(source, /基层医疗覆盖/);
  assert.match(source, /健康预期寿命/);
});

test("客户端展示住房存量、土地转用与城市承载", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /住房土地与城市化/);
  assert.match(source, /城镇住房存量/);
  assert.match(source, /住房短缺/);
  assert.match(source, /建设用地转用/);
  assert.match(source, /城市服务承载/);
});

test("客户端展示六大区域经济与跨区流动", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /六大区域经济/);
  assert.match(source, /东北/);
  assert.match(source, /东部沿海/);
  assert.match(source, /西部发展指数/);
  assert.match(source, /财政净转移/);
});

test("客户端展示世界贸易伙伴与国际金融网络", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /世界贸易与金融网络/);
  assert.match(source, /出口集中度 HHI/);
  assert.match(source, /平均航运风险/);
  assert.match(source, /人民币结算/);
  assert.match(source, /制裁暴露/);
});

test("客户端展示国防预算、战争成本与国家安全", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /国防战争与国家安全/);
  assert.match(source, /国防资本存量/);
  assert.match(source, /军品进口保障/);
  assert.match(source, /累计战争成本/);
  assert.match(source, /民用投资机会成本/);
});

test("客户端展示制度执行能力与内生风险因果图", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /制度执行与内生风险图/);
  assert.match(source, /法治可预期性/);
  assert.match(source, /统计数据质量/);
  assert.match(source, /金融危机/);
  assert.match(source, /外部孤立/);
});

test("设置页展示模型完整性、不确定性与自动校准说明", async () => {
  const assetsDirectory = new URL("../dist/client/assets/", import.meta.url);
  const files = await readdir(assetsDirectory);
  const dashboardFile = files.find((file) => file.startsWith("simulator-dashboard-") && file.endsWith(".js"));
  assert.ok(dashboardFile, "应生成模拟器客户端代码块");
  const source = await readFile(new URL(dashboardFile, assetsDirectory), "utf8");
  assert.match(source, /模型完整性与审计/);
  assert.match(source, /账户守恒检查/);
  assert.match(source, /可重复性与风险/);
  assert.match(source, /多种子不确定性区间/);
  assert.match(source, /自动校准只给出候选/);
});
