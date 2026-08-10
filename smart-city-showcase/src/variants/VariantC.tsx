/**
 * 原型用途：智慧城市数据大屏 —— Variant C「简约商务」。
 * 结构：左 2/3 地图 + 右 1/3 干净数据面板（无过多装饰），深灰底色 + 蓝金点缀，适合"讲得懂"的演示。
 */
import { useMemo, useState } from 'react'
import { Scene } from '../components/Scene'
import { EChart } from '../components/EChart'
import { cityOverview, districts, fmt } from '../data/mock'
import { gdpTrendOption } from '../lib/chartOptions'

export function VariantC() {
  const [sel, setSel] = useState<string | null>(null)
  const trendOpt = useMemo(() => gdpTrendOption(), [])
  const top5 = [...districts].sort((a, b) => b.GDP - a.GDP).slice(0, 5)
  const maxGdp = Math.max(...districts.map((d) => d.GDP))

  return (
    <div className="vc-root">
      {/* 左 2/3：地图 */}
      <div className="vc-map">
        <Scene
          className="vc-scene"
          autoRotate={false}
          bloomStrength={0.25}
          showLabels
          showGrid
          showFlyLines={false}
          showParticles={false}
          cameraPosition={[0, 85, 155]}
          onSelect={setSel}
        />
      </div>

      {/* 右 1/3：数据面板 */}
      <aside className="vc-side">
        <div className="vc-brand">
          <div className="vc-title">数字福州 · 营商环境</div>
          <div className="vc-sub">SMART FUZHOU · BUSINESS ENVIRONMENT</div>
        </div>

        <div className="vc-kpis">
          <div className="vc-kpi">
            <div className="k-label">GDP 总量</div>
            <div className="k-value">{fmt(cityOverview.GDP, 0)}<span>亿元</span></div>
          </div>
          <div className="vc-kpi">
            <div className="k-label">GDP 增速</div>
            <div className="k-value">{cityOverview.增速}<span>%</span></div>
          </div>
          <div className="vc-kpi">
            <div className="k-label">常住人口</div>
            <div className="k-value">{fmt(cityOverview.常住人口)}<span>万人</span></div>
          </div>
        </div>

        <div className="vc-section-title">区县 GDP 排名（亿元）</div>
        <div className="vc-rank">
          {top5.map((d, i) => {
            const pct = (d.GDP / maxGdp) * 100
            return (
              <div key={d.区县} className={`vc-rank-item${sel === d.区县 ? ' sel' : ''}`}>
                <span className="rk-idx">{i + 1}</span>
                <span className="rk-name">{d.区县}</span>
                <span className="rk-bar">
                  <i style={{ width: `${pct}%` }} />
                </span>
                <span className="rk-val">{fmt(d.GDP, 0)}</span>
              </div>
            )
          })}
        </div>

        <div className="vc-section-title">GDP 趋势</div>
        <div className="vc-chart">
          <EChart option={trendOpt} className="echart-fill" />
        </div>

        <div className="vc-foot">数据为演示模拟，仅用于布局与视觉方向评估</div>
      </aside>
    </div>
  )
}
