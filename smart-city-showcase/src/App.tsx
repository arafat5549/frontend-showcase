/**
 * 原型用途：智慧城市数据大屏 —— 单页路由（读 location.search 的 ?variant=）。
 * 默认 A；底部切换条仅开发环境显示；支持键盘 ← → 切换。
 */
import { useEffect, useState } from 'react'
import { VariantA } from './variants/VariantA'
import { VariantB } from './variants/VariantB'
import { VariantC } from './variants/VariantC'
import { Badges } from './components/Badges'
import { Switcher, VARIANT_ORDER, type VariantId } from './components/Switcher'

function parseVariant(): VariantId {
  const raw = new URLSearchParams(window.location.search).get('variant')?.toUpperCase()
  return (VARIANT_ORDER as readonly string[]).includes(raw ?? '') ? (raw as VariantId) : 'A'
}

export default function App() {
  const [variant, setVariant] = useState<VariantId>(parseVariant)

  const switchTo = (v: VariantId) => {
    window.history.replaceState(null, '', `?variant=${v}`)
    setVariant(v)
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement
      const tag = el ? el.tagName : ''
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (el as HTMLElement | null)?.isContentEditable) {
        return
      }
      const idx = VARIANT_ORDER.indexOf(variant)
      if (e.key === 'ArrowRight') switchTo(VARIANT_ORDER[(idx + 1) % VARIANT_ORDER.length])
      else if (e.key === 'ArrowLeft') switchTo(VARIANT_ORDER[(idx - 1 + VARIANT_ORDER.length) % VARIANT_ORDER.length])
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [variant])

  return (
    <>
      {variant === 'A' && <VariantA />}
      {variant === 'B' && <VariantB />}
      {variant === 'C' && <VariantC />}
      {import.meta.env.DEV && <Switcher current={variant} onSwitch={switchTo} />}
      <Badges variant={variant} />
    </>
  )
}
