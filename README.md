# 中国国家发展模拟器

一款从 1949 年开始、以月为最小推进单位的国家经营模拟游戏。项目优先建设完全独立于界面的确定性模拟核心，再通过 Web Worker 接入 React 管理界面。

## 开发命令

```powershell
npm run typecheck
npm test
npm run calibrate -- outputs/calibration-errors.csv
npm run audit -- outputs/final-audit.json
npm run build
```

模拟逻辑位于 `src/simulation`，浏览器 Worker 位于 `src/worker`。所有数值参数集中放入 `src/data/config`，React 组件不得直接计算经济指标。

管理界面包含数据驱动的国策中心与外交事务模块。国策具有并行数量限制、互斥关系和渐进生效期；外交系统包含外交点数、双边关系、贸易协定、战略伙伴、制裁以及联合国、世界贸易组织等多边机制。外交关系会影响出口市场准入和外资信心，国防投入则通过安全指数与外交资源发挥作用。

## 无界面批量模拟

```powershell
# 策略 种子 次数 开始年份 结束年份 格式 输出文件
npm run simulate -- historical 1949 5 1949 2026 json outputs/baseline.json
```

策略可选：`historical`、`industrial`、`livelihood`、`education_technology`、`debt`、`none`。格式可选 `json` 或 `csv`；省略输出文件时只在终端显示汇总。

模拟使用彼此独立、可序列化的人口/世界随机流与事件随机流。相同存档、策略和种子会得到相同年度序列；状态相关随机事件统一通过 Modifier 系统生效并记录到年度报告。

最终验收结果见[最终审计报告](./最终审计报告.md)。
