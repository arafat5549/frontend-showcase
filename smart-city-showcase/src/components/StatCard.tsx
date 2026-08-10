/**
 * 原型用途：智慧城市数据大屏 —— 指标卡。
 */
interface StatCardProps {
  label: string
  value: string
  unit?: string
  delta?: string
  deltaUp?: boolean
  note?: string
  accent?: 'cyan' | 'gold' | 'blue' | 'green'
  className?: string
}

export function StatCard({ label, value, unit, delta, deltaUp = true, note, accent = 'cyan', className }: StatCardProps) {
  return (
    <div className={`stat-card accent-${accent} ${className ?? ''}`}>
      <div className="stat-label">{label}</div>
      <div className="stat-value">
        {value}
        {unit && <span className="stat-unit">{unit}</span>}
      </div>
      {(delta || note) && (
        <div className="stat-foot">
          {delta && <span className={`stat-delta ${deltaUp ? 'up' : 'down'}`}>{deltaUp ? '▲' : '▼'} {delta}</span>}
          {note && <span className="stat-note">{note}</span>}
        </div>
      )}
    </div>
  )
}
