import { LineChart } from "echarts/charts";
import {
  GridComponent,
  LegendComponent,
  TooltipComponent,
} from "echarts/components";
import { init, use as registerEChartsComponents, type ECharts } from "echarts/core";
import { CanvasRenderer } from "echarts/renderers";

registerEChartsComponents([LineChart, GridComponent, LegendComponent, TooltipComponent, CanvasRenderer]);

export function createChart(element: HTMLElement): ECharts {
  return init(element, undefined, { renderer: "canvas" });
}
