/**
 * 原型用途：智慧城市数据大屏 —— 页面角落角标（原型 + 演示数据标注）。
 */
import type { VariantId } from './Switcher'

export function Badges({ variant }: { variant: VariantId }) {
  return (
    <>
      <div className="badge badge-prototype">
        <span className="badge-dot" />
        PROTOTYPE · 原型
        <b>Variant {variant}</b>
      </div>
      <div className="badge badge-demo">演示数据 · 非真实业务数据</div>
    </>
  )
}
