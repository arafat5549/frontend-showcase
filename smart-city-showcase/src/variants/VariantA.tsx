/**
 * 原型用途：智慧城市数据大屏 —— Variant A「经典环绕大屏」。
 * 结构：中央 3D 地图 + 四周数据面板（顶部标题栏 / 左右指标卡列 / 底部图表区），深色科技蓝。
 */
import { useEffect, useMemo, useState } from 'react'
import { Scene } from '../components/Scene'
import { Panel } from '../components/Panel'
import { StatCard } from '../components/StatCard'
import { EChart } from '../components/EChart'
import { cityOverview, districts, fmt } from '../data/mock'
import { districtBarOption, gdpTrendOption, industryDonutOption } from '../lib/chartOptions'

export function VariantA() {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const trendOpt = useMemo(() => gdpTrendOption(), [])
  const donutOpt = useMemo(() => industryDonutOption(), [])
  const barOpt = useMemo(() => districtBarOption(), [])

  const schools = districts.reduce((s, d) => s + d.学校数, 0)
  const hospitals = districts.reduce((s, d) => s + d.医院数, 0)

  return (
    <div className="va-root">
      <Scene
        className="va-scene"
        autoRotate
        bloomStrength={0.5}
        showLabels
        showFlyLines
        showParticles
        showGrid
        cameraPosition={[0, 95, 150]}
      />

      {/* 顶部标题栏 */}
      <header className="va-header">
        <div className="va-title">福州市智慧城市数据驾驶舱</div>
        <div className="va-subtitle">SMART CITY · 数字福州 —— 营商环境与城市治理主题演示</div>
        <div className="va-clock">
          <div className="va-time">{now.toLocaleTimeString('zh-CN', { hour12: false })}</div>
          <div className="va-date">
            {now.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', weekday: 'long' })}
          </div>
        </div>
      </header>

      {/* 左侧指标列 */}
      <aside className="va-col va-left">
        <StatCard label="全市 GDP 总量" value={fmt(cityOverview.GDP, 0)} unit="亿元" delta={`${cityOverview.增速}%`} note="同比" accent="cyan" />
        <StatCard label="常住人口" value={fmt(cityOverview.常住人口)} unit="万人" delta="0.8%" note="同比" accent="blue" />
        <StatCard label="城镇化率" value={fmt(cityOverview.城镇化率)} unit="%" delta="0.4%" note="较上年" accent="green" />
        <StatCard label="市场主体" value={fmt(cityOverview.市场主体)} unit="万家" delta="9.2%" note="同比" accent="gold" />
      </aside>

      {/* 右侧指标列 */}
      <aside className="va-col va-right">
        <StatCard label="人均 GDP" value={fmt(cityOverview.人均GDP)} unit="万元" delta="5.3%" note="同比" accent="gold" />
        <StatCard label="政务服务网办率" value={fmt(cityOverview.网办率)} unit="%" delta="1.2%" note="较上年" accent="cyan" />
        <StatCard label="教育机构" value={fmt(schools, 0)} unit="所" note="全市合计" accent="blue" />
        <StatCard label="医疗机构" value={fmt(hospitals, 0)} unit="家" note="全市合计" accent="green" />
      </aside>

      {/* 底部图表区 */}
      <div className="va-bottom">
        <Panel title="全市 GDP 趋势" subtitle="2019—2024（亿元）">
          <EChart option={trendOpt} className="echart-fill" />
        </Panel>
        <Panel title="三次产业结构" subtitle="演示数据">
          <EChart option={donutOpt} className="echart-fill" />
        </Panel>
        <Panel title="区县 GDP 对比" subtitle="按 2024 年 GDP 降序（亿元）">
          <EChart option={barOpt} className="echart-fill" />
        </Panel>
      </div>
    </div>
  )
}
