/**
 * 原型用途：智慧城市数据大屏 —— Variant B「沉浸式」。
 * 结构：3D 场景全屏为主，右上角悬浮玻璃指标簇 + 左下角玻璃图表抽屉，信息层级更轻。
 */
import { useMemo, useState } from 'react'
import { Scene } from '../components/Scene'
import { EChart } from '../components/EChart'
import { cityOverview, fmt, statsByName } from '../data/mock'
import { gdpTrendOption } from '../lib/chartOptions'

export function VariantB() {
  const [sel, setSel] = useState<string | null>(null)
  const selected = sel ? statsByName[sel] : null
  const trendOpt = useMemo(() => gdpTrendOption(), [])

  return (
    <div className="vb-root">
      <Scene
        className="vb-scene"
        autoRotate
        bloomStrength={0.65}
        showLabels
        showFlyLines
        showParticles
        showGrid
        cameraPosition={[0, 70, 128]}
        onSelect={setSel}
      />

      <div className="vb-brand">福州市 · 智慧城市全景</div>

      {/* 右上角：悬浮玻璃指标簇 */}
      <div className="vb-glass vb-stats">
        <div className="vb-stats-grid">
          <div className="vb-tile">
            <div className="t-label">GDP 总量</div>
            <div className="t-value">{fmt(cityOverview.GDP, 0)}<i>亿</i></div>
          </div>
          <div className="vb-tile">
            <div className="t-label">GDP 增速</div>
            <div className="t-value">{cityOverview.增速}<i>%</i></div>
          </div>
          <div className="vb-tile">
            <div className="t-label">常住人口</div>
            <div className="t-value">{fmt(cityOverview.常住人口)}<i>万</i></div>
          </div>
          <div className="vb-tile">
            <div className="t-label">城镇化率</div>
            <div className="t-value">{cityOverview.城镇化率}<i>%</i></div>
          </div>
        </div>
      </div>

      {/* 左下角：图表抽屉 */}
      <div className="vb-glass vb-drawer">
        <div className="vb-drawer-head">
          <span>全市 GDP 趋势</span>
          <span>2019—2024 · 亿元</span>
        </div>
        <EChart option={trendOpt} className="echart-fill" />
        <div className="vb-drawer-foot">
          {selected ? (
            <span className="sel-chip">
              已选：{selected.区县} · GDP {fmt(selected.GDP, 0)} 亿（{selected.增速 > 0 ? '+' : ''}
              {selected.增速}%）
            </span>
          ) : (
            <span className="hint">点击地图区块查看区县详情</span>
          )}
        </div>
      </div>
    </div>
  )
}
