/**
 * 原型用途：智慧城市数据大屏 —— 带四角装饰的数据面板容器。
 */
import type { ReactNode } from 'react'

interface PanelProps {
  title?: string
  subtitle?: string
  className?: string
  children?: ReactNode
}

export function Panel({ title, subtitle, className, children }: PanelProps) {
  return (
    <div className={`panel ${className ?? ''}`}>
      <i className="corner tl" />
      <i className="corner tr" />
      <i className="corner bl" />
      <i className="corner br" />
      {(title || subtitle) && (
        <div className="panel-head">
          <span className="panel-title">{title}</span>
          {subtitle && <span className="panel-sub">{subtitle}</span>}
        </div>
      )}
      <div className="panel-body">{children}</div>
    </div>
  )
}
