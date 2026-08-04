# AI 开发指南

本文档面向**使用 AI 编程助手继续扩展本项目**的开发者。目标是：用清晰任务描述、正确边界和可粘贴提示词，让 AI 安全地新增板块、国策、事件与界面，而不是绕过模拟核心直接“加分”。

想先照做一遍再扩展：直接看 **[§11 端到端演示](#11-端到端演示从零添加一个可决策历史事件)**（教学示例「沿海轻工业出口试点」）。

更细的架构、存档迁移、校准顺序与故障排查见 [程序维护与扩展指南](./程序维护与扩展指南.md)。强制约束见 [AGENTS.md](./AGENTS.md)。玩法与已实现机制见 [README.md](./README.md)。经济变量与反馈回路见 [经济模拟算法设计.md](./经济模拟算法设计.md)。运行时状态、配置文件与 modifier 目标见 [模拟数据说明](./模拟数据说明.md)；**修改数据时须在同一次提交中同步更新该文档**。

---

## 1. 先建立正确心智模型

本项目是**确定性国家发展模拟器**，不是普通网页 CRUD。

```text
玩家决策 / 事件
  → 中间变量（资本、教育、贸易、财政、制度、关系……）
  → 月度结算管线逐步传导
  → GDP、人口、排名等结果指标
```

因此：

| 可以做 | 不可以做 |
| --- | --- |
| 改配置、接 Modifier、加库存流量模块 | 直接给 `economy.realGDP`、人口、排名或综合评分加固定值 |
| 先做无界面核心与测试，再接 UI | 在 React 组件里重算经济结果 |
| 用项目随机流（可序列化） | 使用 `Math.random()` / `Date.now()` |
| 收益带财政、能源、通胀、外交等代价 | 无代价、可无限叠加的最优国策 |
| 政策与事件有过渡期 / 滞后 | 当月瞬时跳到目标值 |

开发顺序始终是：

1. 无界面模拟核心（`src/simulation/`）
2. 配置（`src/data/config/`）
3. 单元测试与校准
4. Worker / Zustand / React（`src/worker/`、`src/ui/`、`app/`）
5. 文档（含 `模拟数据说明.md`）

---

## 2. 给 AI 布置任务前：你要回答的 8 个问题

把答案写进提示词，可显著降低返工：

1. **类型**：随机事件 / 固定日期历史事件 / 可决策历史事件 / 常驻国策 / 历史转折国策 / 外交行动 / 新模拟板块 / 新 UI 分区？
2. **因果链**：投入什么 → 改变哪些中间变量 → 最终影响什么？代价是什么？
3. **时间**：持续多少个月？有无延迟生效？是否可提前发动？
4. **库存还是流量**：例如资本存量 vs 当月投资；年率是否已换算成月率？
5. **结算时点**：应插在 `month-pipeline.ts` 的哪一步之前/之后？读取期初还是当月结果？
6. **玩家交互**：仅展示、发送命令，还是历史事件弹窗三选一？
7. **史实与反事实**：无界面 `historical` 路线默认走哪条？玩家可否阻止或改方案？
8. **验收**：至少要有哪些正向测试、代价测试、以及是否影响校准锚点？

若你答不清第 2、5、8 项，先让 AI **只做调研与设计方案**，不要直接改代码。

---

## 3. 功能类型速查：该改哪里

| 你想做的事 | 优先修改 | 参考实现 |
| --- | --- | --- |
| 常驻国策（可开关、渐进生效） | `national-policies.json` → `policy-engine.ts` → 测试 | `agriculture_priority` |
| 随机事件（每年概率触发） | `events.json` → `event-engine.ts` → 测试 | `natural_disaster` |
| 固定年月历史事件（史实路径） | `historical-events.json` → `historical-event-engine.ts` | `great_leap_forward_1958` |
| 历史事件多方案决策 | `historical-event-decisions.json`（史实方案由引擎自动插为首项） | `foreign_assets_reorganization` |
| 早期决策缩放后续事件 | `historical-event-dependencies.json` | 大跃进 → 三年困难 |
| 可提前发动的历史转折 | `historical-event-initiatives.json` + 门槛 | 义务教育法、证券交易所 |
| 外交行动（点数/冷却） | `diplomacy.json` → `diplomacy.ts` | 现有 `actions` |
| 阵营 / 学说 / 援外 | 对应 JSON + 既有命令，勿混成普通外交行动 | `diplomatic-strategies.json` 等 |
| 科技节点 | `technology-tree.json` | 现有节点字段齐全者 |
| 产业政策 | `industrial-policies.json` + 产业政策模块 | 扶持/中性/限制 |
| 新核心板块（交通、环境……） | 状态 + 配置 + 模块 + 管线 + 测试，最后才 UI | 维护指南 §9 |
| 新管理界面分区 | `SectionId` + `simulator-dashboard.tsx` + store 命令 | 国策/外交分区 |
| 校准锚点 | `calibration-targets.json` + 注册表 | 勿只放宽容差 |

**Modifier 铁律**：JSON 里写了 `target` 不会自动生效，必须在算法里存在 `applyModifiers` / `applyPolicyModifiers` 消费者。新增前先搜索：

```powershell
rg "你的.target.name" src
```

常用合法中间变量示例（完整列表以代码中的消费者为准）：

- 产出：`sector.primary.output` / `secondary` / `tertiary`
- 资源：`resources.foodSupply` / `resources.energySupply`
- 人口：`population.deathRate`
- 财政：`fiscal.revenue` / `fiscal.spending`
- 资本：`capital.privateInvestment` / `capital.investmentEfficiency`
- 教育科研：`education.efficiency` / `technology.researchOutput`
- 贸易：`trade.exportCompetitiveness` / `trade.foreignInvestment`
- 制度外交：`economy.institutionalEfficiencyTarget` / `diplomacy.reputationTarget`

**禁止**把 `economy.realGDP`、总人口、世界排名、综合评分当作国策/事件的直接奖励 target。

---

## 4. 标准工作流（让 AI 按阶段做）

### 阶段 A：调研（只读）

要求 AI：

- 阅读 `AGENTS.md`、本指南、`模拟数据说明.md`、`程序维护与扩展指南.md` 相关章节
- 检查 `git status`，不覆盖你的未提交改动
- 用搜索找到最相似的现有国策/事件/模块与测试
- 输出设计方案：因果链、文件清单、管线位置、迁移策略、测试计划

### 阶段 B：无界面核心

要求 AI：

- 改 `src/simulation/` 与 `src/data/config/`
- 需要时补 `ensureXxxState` 与存档路径
- 编写/更新单元测试
- 运行局部测试与 `npm run typecheck`

### 阶段 C：校准与审计（触及经济/事件/国策时）

```powershell
npm run typecheck
npm run lint
npm test
npm run data:audit
npm run calibrate
npm run audit
```

校准失败时：先查公式、单位、结算顺序和事件时点，**禁止**只放宽容差让测试变绿。

### 阶段 D：界面

- 命令：`commands.ts` → `engine.ts` → store action
- 页面：`simulator-dashboard.tsx` 增加分区或表单；组件只展示与发命令
- 构建：`npm run build` 与 `npm run test:ui`（或 `test:static`）

### 阶段 E：文档与提交

- 更新 README / 维护指南中与机制相关的说明（若行为对玩家可见）
- 仅在你明确要求时提交；提交说明用简体中文，写清原因与影响

---

## 5. 可粘贴提示词模板

下列模板可直接发给 AI。把「……」换成你的具体需求。开发环境使用 **PowerShell 7 + UTF-8**，包管理用 **npm**（本仓库不是 pnpm）。

### 5.1 通用前缀（建议每次附上）

```text
你正在维护「中国国家发展模拟器」仓库。请先阅读 AGENTS.md、AI开发指南.md 和 程序维护与扩展指南.md 相关章节。

硬性约束：
1. 模拟核心不得依赖 React/DOM/浏览器 API。
2. 禁止 Math.random / Date.now；随机必须用可序列化随机流。
3. 国策与事件不得直接修改 GDP、人口、排名或综合评分；必须经中间变量与 Modifier 传导。
4. 强收益必须有真实代价（财政、能源、通胀、民生、外交或机会成本）。
5. 先无界面核心与测试，最后再接 UI。
6. 保留我已有的未提交改动；不要提交 unless 我明确要求。
7. 注释、错误信息、界面文案、提交说明使用简体中文。

完成前说明：改了什么机制、因果链、测试结果、是否影响校准、未跑的检查。
```

### 5.2 新增常驻国策

```text
请新增一项常驻国策「……」。

设计要求：
- 写入 src/data/config/national-policies.json
- transitionMonths：……
- 与……互斥（如有）
- 收益中间变量：……
- 代价中间变量：……
- 不要直接改 GDP
- 若 target 尚无消费者，在对应模拟模块接入 applyPolicyModifiers
- 在 policy-engine.test.ts 增加：正向效果、代价、互斥（如有）测试
- 确认国策中心页面能展示；必要时补中文说明
- 用无界面 historical 或相关路线跑一段，说明是否形成单一最优解

先给出设计方案与将修改的文件列表，我确认后再改代码。
```

### 5.3 新增随机事件

```text
请新增随机事件「……」。

- 配置：src/data/config/events.json
- baseProbability 与 durationMonths：……
- modifiers 只作用于中间变量：……
- 遵守每年最大事件数；使用现有 eventRandom，禁止 Math.random
- 事件名需进入年度报告
- 补充 events 相关测试：同种子确定性；效果方向正确
- 不要让日志或 UI 预览额外消耗随机数

先调研现有 natural_disaster / epidemic 写法，再实现。
```

### 5.4 新增固定日期历史事件（可含玩家决策）

```text
请新增历史事件「……」，史实触发时间为 …… 年 …… 月。

史实路径：
- 写入 historical-events.json
- durationMonths、category、impact、中文 description/effects
- modifiers：……（含收益与代价）

玩家方案（若需要，至少两个备选，引擎会自动加入史实为首项）：
- 写入 historical-event-decisions.json
- 各方案 durationMonths 与传导不同
- 若可阻止：outcome 设为 prevented，且不施加史实负面修正

若与既有事件有因果：
- 在 historical-event-dependencies.json 说明缩放关系

测试至少覆盖：
- 正确年月只触发一次
- 交互模式会暂停月份
- 各方案中间状态不同
- 无界面 historical 默认走史实
- 存档写入历史时间线

先对照 korean_war_1950 或 foreign_assets_reorganization 的配置结构出方案，再实现。
```

### 5.5 新增可提前发动的历史转折国策

```text
请把「……」做成可提前发动的历史转折（historical-event-initiatives）。

要求：
- 明确最早年份、前置事件/等待月数、制度与能力门槛
- 外交类需点数/关系条件；战争灾害类不要做成无条件收益按钮
- 提前发动只移动影响期，史实年份不得重复结算
- 决策写入存档且不可撤销
- UI 国策中心显示缺失条件
- 正反向测试 + 旧存档迁移（如有新状态字段）

参考 compulsory_education_law / 证券交易所相关配置与测试。
```

### 5.6 新增模拟板块（例如交通、环境子账户）

```text
请设计并实现新模拟板块「……」。

必须先回答：
1. 库存与流量分别是什么，单位是什么
2. 插入 month-pipeline.ts 的具体位置及理由
3. 读取哪些上游模块、影响哪些下游模块
4. 参数放在哪个 config JSON
5. 旧存档 ensure 迁移方案

实现顺序：
状态类型 → initial-state → ensure 迁移（引擎构造 / IMPORT_GAME / deserialize）
→ 纯函数月度更新 → 接入管线 → 单元测试 → 审计/校准影响评估 → 最后 UI

禁止在模块级保存可变单例；禁止组件内计算该板块经济结果。
参考 程序维护与扩展指南.md §9 与相关扩展章节（§24–§32）。
```

### 5.7 新增 UI 管理分区

```text
请新增界面分区「……」。

- 在 simulation-store.ts 扩展 SectionId
- 在 simulator-dashboard.tsx 增加菜单与分区；遵循现有视觉与深色模式
- 只读 GameState / 引擎导出的只读计算结果
- 玩家操作必须走 SimulationCommand → Worker，不得直接改 game
- 显示成本、门槛、互斥或不可执行原因
- 兼顾桌面与窄屏
- 更新 tests/rendered-html.test.mjs（如有文案断言）
- 图表继续懒加载

假设无界面命令与状态已存在；若缺失，先补核心再做 UI。
```

### 5.8 只做设计评审（改动风险高时先用）

```text
不要改代码。请针对需求「……」给出扩展设计：

1. 功能应落入哪一类（国策/事件/模块/外交/UI）
2. 文件级修改清单
3. 因果链与 Modifier target（并确认消费者是否存在）
4. 月度管线插入点
5. 存档与迁移影响
6. 对 historical 校准可能的偏移
7. 最低测试集合与建议验证命令
8. 风险与不建议的做法

输出用简体中文，条目化。
```

---

## 6. 三类常见扩展的最小步骤清单

### 6.1 常驻国策（最短路径）

- [ ] `national-policies.json` 增加稳定 `id`、中文名、类别、说明
- [ ] `transitionMonths`、`conflictsWith`、可选 `requirements`
- [ ] modifiers：至少 1 个收益 + 1 个真实代价（除非机制上确为弱调节）
- [ ] 确认每个 target 有消费者；新 target 登记到 `模拟数据说明.md` §7.1
- [ ] `policy-engine.test.ts` 正向 / 代价 / 互斥
- [ ] 国策页面可展示
- [ ] 抽查是否形成无脑最优解

### 6.2 历史事件 + 决策

- [ ] `historical-events.json` 史实本体完整
- [ ] 需要时 `historical-event-decisions.json`（勿重复粘贴史实为首项）
- [ ] 需要时 dependencies / initiatives
- [ ] 交互暂停与 `RESOLVE_HISTORICAL_EVENT` 行为符合预期
- [ ] 批量/自动模式不阻塞（或 runner 能 dismiss）
- [ ] 时间线记录选择结果
- [ ] 历史事件测试覆盖触发、暂停、方案差异
- [ ] 若大幅改史实冲击，跑校准并解释偏移
- [ ] 同步更新 `模拟数据说明.md` §6.2、§7

### 6.3 新核心板块

- [ ] 类型 + 初值 + `ensureXxxState`（幂等）
- [ ] 三处迁移路径一致：引擎构造、`IMPORT_GAME`、反序列化
- [ ] 配置 JSON，无魔法数散落
- [ ] 管线位置正确，无同月循环依赖
- [ ] 守恒/边界测试（若分配全国总量，禁止再创造 GDP）
- [ ] 正向影响下游的审计或测试
- [ ] UI 与文档最后做
- [ ] 同步更新 `模拟数据说明.md` §4、§6、§9、§10

---

## 7. 验证命令怎么选

| 改动范围 | 至少运行 |
| --- | --- |
| 纯文档 | `git diff --check`，核链接 |
| 单模块/单测 | `npm run typecheck` + 相关 `npm test` |
| 国策、事件、财政、管线、状态 | 按 AGENTS.md 完整链：`typecheck` → `lint` → `test` → `data:audit` → `calibrate` → `audit` → `build` → `test:ui` |
| 仅静态部署相关 | 另加 `npm run build:static` 与 `npm run test:static` |

交付时让 AI **如实报告**通过数量、校准结果和未执行项；没有跑过的检查不得写成“全部通过”。

快速无界面抽查示例：

```powershell
npm run simulate -- historical 1949 1 1949 1960 json
```

---

## 8. 常见失败模式（出现时这样纠正 AI）

| 现象 | 可能原因 | 纠正方向 |
| --- | --- | --- |
| 国策/事件“没效果” | target 无消费者、拼写错、delay 未到期、政策 progress=0 | `rg` 查消费者；查 delay/remaining |
| 同种子结果变了 | 用了 `Math.random`、遍历顺序不稳、UI 多消耗随机 | 隔离随机流；稳定排序 |
| 存档后续跑不一致 | ensure 改了完整存档、漏序列化队列/随机状态 | 迁移幂等；三路径对齐 |
| 某年 GDP 断崖 | 临时倍率到期、把存量收益做成短期 multiply | 收益沉淀为资本/人才/制度库存 |
| 校准红了就放宽容差 | 单位、年月率、管线顺序错误 | 先修机制，最后才动参数 |
| 玩法单一最优 | 无代价或互斥不足 | 补代价、冷却、门槛、准备度折减 |
| AI 在组件里算 GDP | 违反核心隔离 | 删掉前端公式，改为展示 Worker 状态 |

更完整的排查树见维护指南 §19。

---

## 9. 与现有文档的分工

| 文档 | 用途 |
| --- | --- |
| **本指南** | 给人类与 AI 的任务模板、类型速查、阶段流程、验收清单；§11 为可决策历史事件端到端演示 |
| `AGENTS.md` | 强制规范与验证命令 |
| `程序维护与扩展指南.md` | 架构细节、管线顺序、迁移、外交/科技/财政扩展专章、完成定义 |
| `README.md` | 已实现玩法与数据口径说明 |
| `经济模拟算法设计.md` | 变量定义与反馈回路设计依据 |
| `模拟数据说明.md` | 运行时状态、配置文件、modifier 目标与数据维护登记 |
| `开发文档.md` | 早期产品需求与系统设计 |

当文档与**已通过测试的代码**冲突时，以代码为准，并在同一次修改中更新文档。

---

## 10. 推荐对话节奏

1. **一句话需求** → AI 用 §5.8 出设计  
2. **你确认因果与文件清单** → 进入无界面实现  
3. **看测试与校准** → 再允许接 UI  
4. **你明确说“提交”** → 再让 AI 按仓库规范写详细中文提交说明  

完整照做一遍可决策历史事件，见下方 **§11**。

不要在同一条消息里同时要求“大改经济核心 + 重做全部 UI + 部署上线”；拆成可验证的小阶段，AI 更不容易破坏确定性与存档连续性。

---

## 11. 端到端演示：从零添加一个可决策历史事件

以下用**教学示例**走完全流程。示例事件并非仓库现成功能，系数也未校准；真正合入主分支前，必须换成真实史实依据、核对 Modifier 消费者，并跑校准。

### 11.1 示例需求（一句话）

> 1965 年 3 月增加历史事件「沿海轻工业出口试点」：史实路径小幅提高出口竞争力与轻工业倾向，但增加财政与能源压力；玩家可选「扩大试点」或「拒绝试点」。

### 11.2 先填满 8 个问题

| # | 问题 | 本示例答案 |
| --- | --- | --- |
| 1 | 类型 | 固定日期历史事件 + 玩家决策（非随机、非常驻国策） |
| 2 | 因果链 | 财政/基建投入 → 出口竞争力、第二产业产出 → 间接影响贸易与 GDP；代价为支出与能源 |
| 3 | 时间 | 1965-03 触发；史实 36 个月；扩大 60 个月；拒绝记为 prevented |
| 4 | 库存/流量 | 只用既有中间变量倍率，不新增库存字段 |
| 5 | 结算时点 | 走现有 `checkHistoricalEvents`，无需改管线顺序 |
| 6 | 交互 | 交互模式弹窗三选一；自动模式走史实 |
| 7 | 史实/反事实 | `historical` 默认史实；扩大更强收益更高代价；拒绝无史实修正 |
| 8 | 验收 | 触发一次、暂停、三方案差异、年度报告含事件名、同种子确定 |

### 11.3 阶段 A：调研（只读）

给 AI：

```text
（附上 §5.1 通用前缀）

不要改代码。需求：1965年3月「沿海轻工业出口试点」可决策历史事件。
请对照 foreign_assets_reorganization / industry_wide_joint_ownership_1956：
1. 确认 trade.exportCompetitiveness、sector.secondary.output、fiscal.spending、resources.energyDemand 是否已有 applyModifiers 消费者
2. 列出将修改的 JSON/测试文件
3. 给出史实与两个备选方案的 modifiers 草案（禁止直接改 GDP）
4. 说明交互暂停与 automatic 默认行为
```

你应看到类似结论：

- 配置：`historical-events.json`、`historical-event-decisions.json`
- 引擎已有，一般**不必**改 `month-pipeline.ts`
- UI 历史事件弹窗是数据驱动，通常**不必**改 React（除非要特殊文案）
- 测试：`historical-events.test.ts`

用搜索自证消费者（示例）：

```powershell
rg "trade.exportCompetitiveness" src/simulation
rg "resources.energyDemand" src/simulation
```

若某个 target 无消费者：要么换已有 target，要么先在算法模块接入再写事件——**不要**只写 JSON。

### 11.4 阶段 B：写入史实事件本体

在 `src/data/config/historical-events.json` 追加（保持 JSON 数组合法逗号）：

```json
{
  "id": "coastal_light_industry_pilot_1965",
  "name": "沿海轻工业出口试点",
  "year": 1965,
  "month": 3,
  "category": "对外经济",
  "impact": "mixed",
  "description": "选择若干沿海城市试办轻工业出口导向生产与外贸衔接，以有限财政投入换取出口渠道与轻工组织经验；同时抬高能源与行政支出，并挤占部分内需投资带宽。",
  "effects": [
    "出口竞争力短期改善",
    "轻工业与出口组织能力提高",
    "财政支出与能源需求上升"
  ],
  "durationMonths": 36,
  "modifiers": [
    { "target": "trade.exportCompetitiveness", "operation": "multiply", "value": 1.03 },
    { "target": "sector.secondary.output", "operation": "multiply", "value": 1.01 },
    { "target": "fiscal.spending", "operation": "multiply", "value": 1.015 },
    { "target": "resources.energyDemand", "operation": "multiply", "value": 1.02 }
  ]
}
```

要点：

- `id` 稳定后不要随意改名（存档与测试会引用）
- `description` 宜超过约 30 字；`effects` 至少 2 条（现有目录测试会检查）
- 史实方案**只写在事件本体**，不要再抄进 decisions 里当第一项

### 11.5 阶段 B：写入玩家备选方案

在 `src/data/config/historical-event-decisions.json` 追加：

```json
{
  "eventId": "coastal_light_industry_pilot_1965",
  "choices": [
    {
      "id": "expand_pilot",
      "name": "扩大沿海出口试点",
      "description": "增加试点城市与外贸配套投入，出口与工业收益更高，但财政、能源压力更大，并进一步挤出民间投资。",
      "effects": [
        "出口竞争力明显提高",
        "工业产出额外上升",
        "财政与能源代价更大",
        "民间投资受到挤出"
      ],
      "durationMonths": 60,
      "modifiers": [
        { "target": "trade.exportCompetitiveness", "operation": "multiply", "value": 1.06 },
        { "target": "sector.secondary.output", "operation": "multiply", "value": 1.02 },
        { "target": "fiscal.spending", "operation": "multiply", "value": 1.03 },
        { "target": "resources.energyDemand", "operation": "multiply", "value": 1.04 },
        { "target": "capital.privateInvestment", "operation": "multiply", "value": 0.98 }
      ]
    },
    {
      "id": "reject_pilot",
      "name": "拒绝出口试点",
      "description": "不启动沿海轻工业出口试点，避免相应财政与能源负担，也放弃该渠道带来的出口学习。",
      "effects": [
        "不施加试点相关修正",
        "不增加试点财政与能源成本",
        "错过该阶段出口组织经验"
      ],
      "durationMonths": 12,
      "modifiers": [],
      "outcome": "prevented"
    }
  ]
}
```

引擎会自动生成首项 `historical_path`（遵循历史路径），再拼上以上两项，界面上共 **3** 个方案。

### 11.6 阶段 B：补测试（对照现有模式）

在 `src/simulation/events/historical-events.test.ts` 增加用例（模式对齐「公私合营」「交互暂停」测试）：

```ts
it("沿海轻工业出口试点在 1965-03 触发且只触发一次", () => {
  const state = createInitialGameState(1965, 1965);
  state.nation.date.month = 3;
  const first = checkHistoricalEvents(state.nation);
  const second = checkHistoricalEvents(state.nation);

  expect(first.map((event) => event.id)).toContain(
    "coastal_light_industry_pilot_1965",
  );
  expect(second).toEqual([]);
  expect(applyModifiers(state.nation, "trade.exportCompetitiveness", 100)).toBeCloseTo(
    103,
  );
  expect(applyModifiers(state.nation, "fiscal.spending", 100)).toBeCloseTo(101.5);
});

it("沿海轻工业出口试点交互暂停且三方案不同", () => {
  const engine = createSimulationEngine(
    createInitialGameState(1965, 1965, "interactive"),
  );
  // 推进到 1965-03：按项目日期推进习惯调整 months
  engine.dispatch({ type: "ADVANCE_MONTHS", months: 3 });
  expect(engine.getState().nation.pendingHistoricalEventId).toBe(
    "coastal_light_industry_pilot_1965",
  );

  const choices = getHistoricalEventChoices("coastal_light_industry_pilot_1965");
  expect(choices.map((choice) => choice.id)).toEqual([
    "historical_path",
    "expand_pilot",
    "reject_pilot",
  ]);

  engine.dispatch({
    type: "RESOLVE_HISTORICAL_EVENT",
    eventId: "coastal_light_industry_pilot_1965",
    choiceId: "expand_pilot",
  });
  expect(engine.getState().nation.pendingHistoricalEventId).toBeNull();
  expect(
    applyModifiers(
      engine.getState().nation,
      "trade.exportCompetitiveness",
      100,
    ),
  ).toBeCloseTo(106);
  expect(
    applyModifiers(engine.getState().nation, "capital.privateInvestment", 100),
  ).toBeCloseTo(98);
});

it("拒绝沿海出口试点不施加史实负面/正面修正", () => {
  const engine = createSimulationEngine(
    createInitialGameState(1965, 1965, "interactive"),
  );
  engine.dispatch({ type: "ADVANCE_MONTHS", months: 3 });
  engine.dispatch({
    type: "RESOLVE_HISTORICAL_EVENT",
    eventId: "coastal_light_industry_pilot_1965",
    choiceId: "reject_pilot",
  });
  const record = engine.getState().nation.history.historicalEvents[0];
  expect(record).toMatchObject({
    id: "coastal_light_industry_pilot_1965",
    choiceId: "reject_pilot",
    outcome: "prevented",
  });
  expect(
    applyModifiers(
      engine.getState().nation,
      "trade.exportCompetitiveness",
      100,
    ),
  ).toBe(100);
});
```

注意：`ADVANCE_MONTHS` 的起始月取决于 `createInitialGameState(1965, 1965)` 的初始日期（多为当年 1 月）。若测试日期对不上，先读初始日期再改 `months`，或直接构造 `date` 后调用 `checkHistoricalEvents`（见「只触发一次」那种写法）。

运行局部测试：

```powershell
npx vitest run src/simulation/events/historical-events.test.ts
npm run typecheck
```

### 11.7 阶段 C：无界面抽查与校准意识

```powershell
npm run simulate -- historical 1949 1 1949 1970 json
```

检查汇总或日志中是否出现事件名；对比修改前后 1965–1970 出口/财政是否偏移合理。

若事件强度较大，继续：

```powershell
npm test
npm run calibrate
```

**不要**为了过校准而把教学系数直接当终稿；真实事件应有史料数量级约束。

### 11.8 阶段 D：界面通常不用改

历史事件弹窗读取 `pendingHistoricalEventId` 与 `getHistoricalEventChoices`。只要配置完整：

- 交互模式会在 1965-03 **暂停月份**
- 三个方案名称与说明自动展示
- 选择后发 `RESOLVE_HISTORICAL_EVENT`

仅当需要特殊 UI（多轴决策、专属图表）时才改 `simulator-dashboard.tsx`。

可选：若希望「达标后可提前发动」，再增加 `historical-event-initiatives.json` 条目（参考 `early_land_reform`），并补门槛与「史实年不重复结算」测试——这是加分项，不是最小闭环必需。

### 11.9 阶段 E：文档与交付话术

机制对玩家可见时，在 `README.md` 历史事件段落补一句说明。交付给 AI 验收时要求它报告：

- 因果链（投入 → 中间变量 → 结果）
- 三方案差异是否可测
- 测试通过条数
- 是否跑过校准；若未跑，写明原因
- 有无新增状态字段（本示例应无）

### 11.10 一整段可粘贴实现提示词

确认设计后，可对 AI 说：

```text
（附上 §5.1 通用前缀）

按 AI开发指南.md §11 实现教学事件 coastal_light_industry_pilot_1965：
1. 写入 historical-events.json 与 historical-event-decisions.json（内容以 §11.4–11.5 为准，可微调文案）
2. 在 historical-events.test.ts 按 §11.6 补测试；先确认 createInitialGameState 的初始月再写 ADVANCE_MONTHS
3. 不要改 month-pipeline，除非你证明现有历史事件入口不够
4. 不要改 React，除非弹窗无法展示新事件
5. 禁止直接修改 GDP/人口/排名
6. 跑 vitest 该文件与 typecheck；用 simulate historical 抽查到 1970
7. 完成后用简体中文说明因果链、测试结果、校准是否执行

先展示将修改的文件列表，我回复「开始实现」后再改代码。
```

### 11.11 加分：同结构的随机事件最短路径

若只要「每年概率触发、无弹窗」，对照 `events.json` 的 `natural_disaster`：

1. 在 `events.json` 的 `events` 数组追加 `id` / `name` / `baseProbability` / `durationMonths` / `modifiers`
2. 确认 target 有消费者
3. 在 `events.test.ts` 增加：同种子一致；如有状态相关概率则测高低状态差异
4. **禁止** `Math.random`；勿在 UI 预览里额外掷骰

随机事件**不会**走历史事件暂停流程，也没有 `historical-event-decisions.json`。

### 11.12 本示例刻意不做的事

- 不新增 `GameState` 字段、不升存档版本  
- 不把试点做成无代价常驻国策  
- 不用 `override` 覆盖 GDP  
- 不在 React 里根据选项硬编码经济结果  
- 不把「拒绝」写成仍带史实负面/正面的空壳选择（拒绝应 `prevented` + 空 modifiers）  

做完 §11 一遍后，再套用 §5.2–§5.7 处理国策、新板块或外交会轻松很多：差异主要在配置文件与是否改管线，不在「绕过核心加分」。
