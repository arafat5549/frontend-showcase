/**
 * 原型用途：智慧城市数据大屏 —— ECharts 配置构建（演示数据）。
 */
import type { EChartsOption } from 'echarts'
import { gdpTrend, industryMix, districts } from '../data/mock'

const AXIS_DIM = '#8fb8d9'
const SPLIT = 'rgba(56,189,248,.12)'
const LINE_CYAN = '#22d3ee'
const GOLD = '#e8b54d'

/** GDP 趋势折线（全市，2019-2024） */
export function gdpTrendOption(): EChartsOption {
  return {
    backgroundColor: 'transparent',
    grid: { left: 46, right: 20, top: 30, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(8,20,40,.92)',
      borderColor: 'rgba(56,189,248,.4)',
      textStyle: { color: '#e6f7ff', fontSize: 12 },
      valueFormatter: (v) => `${v} 亿元`,
    },
    xAxis: {
      type: 'category',
      data: gdpTrend.years,
      axisLine: { lineStyle: { color: 'rgba(125,211,252,.35)' } },
      axisTick: { show: false },
      axisLabel: { color: AXIS_DIM, fontSize: 11 },
    },
    yAxis: {
      type: 'value',
      name: '亿元',
      nameTextStyle: { color: AXIS_DIM, fontSize: 11 },
      axisLabel: { color: AXIS_DIM, fontSize: 11 },
      splitLine: { lineStyle: { color: SPLIT } },
    },
    series: [
      {
        name: 'GDP',
        type: 'line',
        data: gdpTrend.values,
        smooth: true,
        symbol: 'circle',
        symbolSize: 7,
        lineStyle: { width: 3, color: LINE_CYAN, shadowColor: 'rgba(34,211,238,.6)', shadowBlur: 12 },
        itemStyle: { color: LINE_CYAN, borderColor: '#d9f6ff', borderWidth: 1 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(34,211,238,.38)' },
              { offset: 1, color: 'rgba(34,211,238,0)' },
            ],
          },
        },
        label: { show: true, color: '#d9f6ff', fontSize: 10, formatter: (p) => `${p.value}` },
      },
    ],
  }
}

/** 区县 GDP 柱状（按 GDP 降序） */
export function districtBarOption(): EChartsOption {
  const sorted = [...districts].sort((a, b) => b.GDP - a.GDP)
  const data = sorted.map((d) => ({
    value: d.GDP,
    itemStyle: {
      color: {
        type: 'linear' as const, x: 0, y: 0, x2: 1, y2: 0,
        colorStops: [
          { offset: 0, color: 'rgba(23,195,224,.25)' },
          { offset: 1, color: '#17c3e0' },
        ],
      },
      borderRadius: [0, 3, 3, 0],
    },
  }))
  return {
    backgroundColor: 'transparent',
    grid: { left: 58, right: 44, top: 8, bottom: 8 },
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      backgroundColor: 'rgba(8,20,40,.92)',
      borderColor: 'rgba(56,189,248,.4)',
      textStyle: { color: '#e6f7ff', fontSize: 12 },
      valueFormatter: (v) => `${v} 亿元`,
    },
    xAxis: {
      type: 'value',
      axisLabel: { color: AXIS_DIM, fontSize: 10 },
      splitLine: { lineStyle: { color: SPLIT } },
    },
    yAxis: {
      type: 'category',
      data: sorted.map((d) => d.区县),
      inverse: true,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: AXIS_DIM, fontSize: 11 },
    },
    series: [
      {
        name: 'GDP',
        type: 'bar',
        data,
        barWidth: '58%',
        label: { show: true, position: 'right', color: '#9fd8ef', fontSize: 10 },
      },
    ],
  }
}

/** 三次产业结构环形图 */
export function industryDonutOption(): EChartsOption {
  return {
    backgroundColor: 'transparent',
    tooltip: {
      trigger: 'item',
      backgroundColor: 'rgba(8,20,40,.92)',
      borderColor: 'rgba(56,189,248,.4)',
      textStyle: { color: '#e6f7ff', fontSize: 12 },
      formatter: '{b}: {c}%',
    },
    legend: {
      bottom: 0,
      itemWidth: 10,
      itemHeight: 10,
      textStyle: { color: AXIS_DIM, fontSize: 11 },
    },
    series: [
      {
        type: 'pie',
        radius: ['52%', '74%'],
        center: ['50%', '44%'],
        avoidLabelOverlap: true,
        itemStyle: { borderColor: 'rgba(6,16,32,.9)', borderWidth: 2 },
        label: { color: AXIS_DIM, fontSize: 11, formatter: '{b} {c}%' },
        labelLine: { lineStyle: { color: 'rgba(125,211,252,.4)' } },
        data: industryMix.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.name === '第一产业' ? '#4c7dff' : d.name === '第二产业' ? '#17c3e0' : GOLD },
        })),
      },
    ],
  }
}
