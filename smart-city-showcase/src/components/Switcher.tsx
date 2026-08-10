/**
 * 原型用途：智慧城市数据大屏 —— 变体切换条（仅开发环境显示）。
 * 底部居中固定定位，高对比，明显独立于页面内容。
 */

export type VariantId = 'A' | 'B' | 'C'

export const VARIANT_LABELS: Record<VariantId, string> = {
  A: 'A — 经典环绕大屏',
  B: 'B — 沉浸式',
  C: 'C — 简约商务',
}

export const VARIANT_ORDER: VariantId[] = ['A', 'B', 'C']

interface SwitcherProps {
  current: VariantId
  onSwitch: (v: VariantId) => void
}

export function Switcher({ current, onSwitch }: SwitcherProps) {
  const idx = VARIANT_ORDER.indexOf(current)
  const prev = VARIANT_ORDER[(idx - 1 + VARIANT_ORDER.length) % VARIANT_ORDER.length]
  const next = VARIANT_ORDER[(idx + 1) % VARIANT_ORDER.length]

  return (
    <div className="variant-switcher">
      <button
        className="sw-btn"
        aria-label="上一个变体"
        onClick={() => onSwitch(prev)}
      >
        ←
      </button>
      <div className="sw-name">{VARIANT_LABELS[current]}</div>
      <button
        className="sw-btn"
        aria-label="下一个变体"
        onClick={() => onSwitch(next)}
      >
        →
      </button>
    </div>
  )
}
