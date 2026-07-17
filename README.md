# 中国国家发展模拟器

一款从 1949 年开始、以月为最小推进单位的国家经营模拟游戏。项目优先建设完全独立于界面的确定性模拟核心，再通过 Web Worker 接入 React 管理界面。

## 开发命令

```powershell
npm run typecheck
npm test
npm run build
```

模拟逻辑位于 `src/simulation`，浏览器 Worker 位于 `src/worker`。所有数值参数集中放入 `src/data/config`，React 组件不得直接计算经济指标。

## 无界面批量模拟

```powershell
# 策略 种子 次数 开始年份 结束年份 格式 输出文件
npm run simulate -- historical 1949 5 1949 2026 json outputs/baseline.json
```

策略可选：`historical`、`industrial`、`livelihood`、`education_technology`、`debt`、`none`。格式可选 `json` 或 `csv`；省略输出文件时只在终端显示汇总。
