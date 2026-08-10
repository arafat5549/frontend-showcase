/**
 * 原型用途：智慧城市数据大屏 —— ECharts 配置构建（演示数据）。
 * 色板设计意图（v2 降亮）：折线/柱状/环形图跟随 3D 场景的"深夜墨蓝"色系，
 * 主色 #2f9db8（暗青）替代原 #22d3ee，金 #cda24a 仅作第三产业点缀；
 * 坐标轴/分割线/文字全部压为灰蓝阶，保证可读但不再刺眼。
 */
import type { EChartsOption } from 'echarts'
import { gdpTrend, industryMix, districts } from '../data/mock'

const AXIS_DIM = '#7d93a6'
const SPLIT = 'rgba(90,140,170,.10)'
const LINE_CYAN = '#2f9db8'
const GOLD = '#cda24a'

/** GDP 趋势折线（全市，2019-2024） */
export function gdpTrendOption(): EChartsOption {
  return {
    backgroundColor: 'transparent',
    grid: { left: 46, right: 20, top: 30, bottom: 26 },
    tooltip: {
      trigger: 'axis',
      backgroundColor: 'rgba(8,16,28,.94)',
      borderColor: 'rgba(90,150,180,.35)',
      textStyle: { color: '#dcebf4', fontSize: 12 },
      valueFormatter: (v) => `${v} 亿元`,
    },
    xAxis: {
      type: 'category',
      data: gdpTrend.years,
      axisLine: { lineStyle: { color: 'rgba(110,160,190,.28)' } },
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
        lineStyle: { width: 3, color: LINE_CYAN, shadowColor: 'rgba(47,157,184,.45)', shadowBlur: 8 },
        itemStyle: { color: LINE_CYAN, borderColor: '#cfe4ee', borderWidth: 1 },
        areaStyle: {
          color: {
            type: 'linear', x: 0, y: 0, x2: 0, y2: 1,
            colorStops: [
              { offset: 0, color: 'rgba(40,130,160,.26)' },
              { offset: 1, color: 'rgba(40,130,160,0)' },
            ],
          },
        },
        label: { show: true, color: '#c2d9e4', fontSize: 10, formatter: (p) => `${p.value}` },
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
          { offset: 0, color: 'rgba(18,128,155,.22)' },
          { offset: 1, color: '#12809b' },
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
      backgroundColor: 'rgba(8,16,28,.94)',
      borderColor: 'rgba(90,150,180,.35)',
      textStyle: { color: '#dcebf4', fontSize: 12 },
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
        label: { show: true, position: 'right', color: '#8aa7b8', fontSize: 10 },
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
      backgroundColor: 'rgba(8,16,28,.94)',
      borderColor: 'rgba(90,150,180,.35)',
      textStyle: { color: '#dcebf4', fontSize: 12 },
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
        labelLine: { lineStyle: { color: 'rgba(110,160,190,.3)' } },
        data: industryMix.map((d) => ({
          name: d.name,
          value: d.value,
          itemStyle: { color: d.name === '第一产业' ? '#3d63b8' : d.name === '第二产业' ? '#12809b' : GOLD },
        })),
      },
    ],
  }
}
