import { useEffect, useState } from 'react'
import { useReplay, type Evt, type Item } from './useReplay'
import wallpaper from './assets/wallpaper.jpg'

/* ══════════════ 图标（内联 SVG，Win11 Fluent 简化版） ══════════════ */

function Icon({ name, size = 16 }: { name: string; size?: number }) {
  const common = { width: size, height: size, viewBox: '0 0 16 16', fill: 'currentColor' } as const
  switch (name) {
    case 'powershell': // 终端窗口图标
      return (
        <svg {...common}>
          <rect x="1" y="1.5" width="14" height="13" rx="2" fill="none" stroke="currentColor" />
          <path d="M3.5 5.5 6 8 3.5 10.5" stroke="currentColor" fill="none" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M7.5 10.5h5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
        </svg>
      )
    case 'excel':
      return (
        <svg {...common}>
          <rect x="1" y="1.5" width="14" height="13" rx="2" fill="#107C41" />
          <path d="M8.2 4 6.6 8l1.6 4" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinecap="round" />
          <path d="M4.4 6.2l2.2 1.8-2.2 1.8M9.6 6.2 7.4 8l2.2 1.8" stroke="#fff" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      )
    case 'min':
      return <svg {...common}><rect x="2.5" y="7.4" width="11" height="1.2" rx="0.6" /></svg>
    case 'max':
      return <svg {...common}><rect x="3" y="3.5" width="10" height="9" rx="1.5" fill="none" stroke="currentColor" strokeWidth="1.1" /></svg>
    case 'close':
      return <svg {...common}><path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" /></svg>
    case 'start': // Windows 四格窗
      return (
        <svg {...common} fill="currentColor">
          <path d="M7 1H2v5h5V1zM14 1H9v5h5V1zM7 8H2v5h5V8zM14 8H9v5h5V8z" />
        </svg>
      )
    case 'search':
      return <svg {...common}><circle cx="7" cy="7" r="4.2" fill="none" stroke="currentColor" strokeWidth="1.4" /><path d="M10.2 10.2 13.5 13.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" /></svg>
    case 'folder':
      return (
        <svg {...common}>
          <path d="M2 4.5h3.6l1.4 1.5H14v7.5a1 1 0 0 1-1 1H3a1 1 0 0 1-1-1V4.5z" fill="currentColor" />
        </svg>
      )
    case 'edge':
      return (
        <svg {...common}>
          <circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" strokeWidth="1.4" />
          <path d="M8 4.5a3.5 3.5 0 1 1-3.4 4.6" stroke="currentColor" strokeWidth="1.4" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'trash':
      return (
        <svg {...common}>
          <path d="M4 5.5 4.7 13a1 1 0 0 0 1 .9h4.6a1 1 0 0 0 1-.9L12 5.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          <path d="M2.5 4.5h11M6.5 4.5V3.2a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1v1.3" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
        </svg>
      )
    case 'wifi':
      return (
        <svg {...common} fill="none" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round">
          <path d="M2.5 6.5a9 9 0 0 1 11 0M4.5 9a5.5 5.5 0 0 1 7 0M6.5 11.5a2.2 2.2 0 0 1 3 0" />
          <circle cx="8" cy="13.4" r="0.9" fill="currentColor" stroke="none" />
        </svg>
      )
    case 'volume':
      return (
        <svg {...common}>
          <path d="M3 6.2h2.4L8.5 3.8v8.4L5.4 9.8H3V6.2z" fill="currentColor" />
          <path d="M10.4 6a3 3 0 0 1 0 4M11.8 4.6a5 5 0 0 1 0 6.8" stroke="currentColor" strokeWidth="1.1" fill="none" strokeLinecap="round" />
        </svg>
      )
    default:
      return null
  }
}

/* ══════════════ Win11 窗口（标题栏 + 内容） ══════════════ */

interface WinWinProps {
  icon: string
  title: string
  className: string
  children: React.ReactNode
}

function WinWindow({ icon, title, className, children }: WinWinProps) {
  return (
    <section className={'win-window ' + className}>
      <header className="win-titlebar">
        <span className="win-icon">
          <Icon name={icon} size={14} />
        </span>
        <span className="win-title">{title}</span>
        <span className="win-btns">
          <button aria-label="最小化"><Icon name="min" size={10} /></button>
          <button aria-label="最大化"><Icon name="max" size={10} /></button>
          <button aria-label="关闭" className="win-close"><Icon name="close" size={10} /></button>
        </span>
      </header>
      {children}
    </section>
  )
}

/* ══════════════ PowerShell 终端窗口 ══════════════ */

const TYPE_CLS: Record<string, string> = {
  公开招标: 't-type',
  竞争性磋商: 't-type',
  询价: 't-type',
  中标公告: 'ok',
  成交公告: 'ok',
  终止公告: 'warn',
  废标: 'warn',
}

function PsLine({ e }: { e: Evt }) {
  const it = e.data?.item
  switch (e.type) {
    case 'request':
      return <div className="ps-line dim2">➜ {e.msg}</div>
    case 'request_failed':
      return <div className="ps-line err-line">➜ {e.msg}</div>
    case 'parse':
      return <div className="ps-line dim2">&nbsp;&nbsp;{e.msg}</div>
    case 'item': {
      const cls = it ? TYPE_CLS[it.type] : ''
      return (
        <div className="ps-line flash">
          &nbsp;&nbsp;{it?.type ? <span className={cls}>[{it.type}]</span> : null} {it?.title ?? ''}
        </div>
      )
    }
    case 'dedupe':
      return <div className="ps-line warn-line">⇄ {e.msg}</div>
    case 'export':
      return <div className="ps-line warn-line">◆ {e.msg}</div>
    case 'done':
      return <div className="ps-line done-line">✔ {e.msg}</div>
    default:
      return <div className="ps-line">{e.msg || e.type}</div>
  }
}

function TerminalWin({ log, err }: { log: Evt[]; err: string }) {
  return (
    <WinWindow icon="powershell" title="Windows PowerShell" className="term-win">
      <div className="ps-content" aria-live="polite">
        <div className="ps-line">
          <span className="ps-prompt">PS C:\crawler-showcase&gt;</span>
          <span className="ps-cmd"> python crawler.py --export-events events.json</span>
        </div>
        <div className="ps-line dim2"># 根据真实案例改编：某建材店老板每天手动翻招标网站找商机，漏看即错过投标窗口</div>
        <div className="ps-line dim2"># 改为爬虫自动采集后，每天打开 Excel 报表即可筛选当天项目（数据实时采集自公开渠道）</div>
        {log.map((e, i) => (
          <PsLine key={i} e={e} />
        ))}
        {err && (
          <div className="ps-line err-line">
            无法加载 events.json（{err}）——请确认已运行 npm run dev
          </div>
        )}
        <div className="ps-line">
          <span className="ps-prompt">PS C:\crawler-showcase&gt;</span>
          <span className="ps-cursor" />
        </div>
      </div>
    </WinWindow>
  )
}

function fmt(n?: number) {
  return n ? n.toLocaleString('zh-CN') : '-'
}

/* ══════════════ Excel 报表窗口 ══════════════ */

function ExcelWin({ rows, meta, finished }: { rows: Item[]; meta: { total_count?: number; run_time: string } | null; finished: boolean }) {
  return (
    <WinWindow icon="excel" title="政采公告_中央.xlsx - Excel" className="excel-win">
      <div className="xls-namebar">
        <span className="xls-file">政采公告_中央.xlsx</span>
        <span className="xls-autosave">已自动保存</span>
      </div>
      <div className="xls-wrap">
        <table className="xls">
          <thead>
            <tr>
              <th className="xls-rowhead"></th>
              <th>标题</th>
              <th>类型</th>
              <th>发布时间</th>
              <th>地域</th>
              <th>采购人</th>
              <th>链接</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((it, i) => (
              <tr key={it.url + i} className="xls-flash">
                <td className="xls-rowhead">{i + 1}</td>
                <td className="t-title">
                  <span className="title-text" title={it.title}>{it.title}</span>
                </td>
                <td><span className="type-badge">{it.type || '-'}</span></td>
                <td>{it.pub_time || '-'}</td>
                <td>{it.region || '-'}</td>
                <td>{it.buyer || '-'}</td>
                <td className="t-link">
                  <a href={it.url} target="_blank" rel="noopener" title={it.url}>{shortUrl(it.url)}</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="xls-statusbar">
        <span className="xls-ready">{finished ? '完成' : '采集中…'}</span>
        <span className="xls-count">
          显示前 {rows.length} 条 · 全量 {fmt(meta?.total_count)} 条{meta ? ` · ${meta.run_time}` : ''}
        </span>
      </div>
      <div className="xls-sheetbar">
        <span className="xls-sheet active">政采公告</span>
        <span className="xls-sheet">采集摘要</span>
        <span className="xls-sheet-add">＋</span>
      </div>
    </WinWindow>
  )
}

function shortUrl(u: string) {
  if (!u) return '-'
  try {
    const seg = new URL(u).pathname.split('/')
    return seg[seg.length - 1].slice(0, 22) || u
  } catch {
    return u.slice(0, 26)
  }
}

/* ══════════════ 控制面板（Win11 浮动样式） ══════════════ */

interface ControlsProps {
  playing: boolean
  finished: boolean
  speed: number
  limit: string
  total: number
  cur: number
  onToggle: () => void
  onReplay: () => void
  onSkip: () => void
  onSpeed: (v: number) => void
  onLimit: (v: string) => void
}

function ControlDock(p: ControlsProps) {
  return (
    <div className="dock">
      <button className="dock-primary" onClick={p.onToggle} disabled={p.finished}>
        {p.playing ? '⏸ 暂停' : p.cur > 0 && !p.finished ? '▶ 继续' : '▶ 播放'}
      </button>
      <button onClick={p.onReplay} disabled={!p.finished && p.cur === 0}>↺ 重播</button>
      <span className="dock-group">
        速度
        {[1, 2, 4].map((s) => (
          <button key={s} className={p.speed === s ? 'active' : ''} onClick={() => p.onSpeed(s)}>{s}x</button>
        ))}
      </span>
      <span className="dock-group">
        条数
        {['all', '10', '5'].map((n) => (
          <button key={n} className={p.limit === n ? 'active' : ''} onClick={() => p.onLimit(n)}>
            {n === 'all' ? '全部' : n}
          </button>
        ))}
      </span>
      <button onClick={p.onSkip} disabled={p.finished}>跳过动画</button>
      <span className="dock-progress">{p.cur} / {p.total}</span>
    </div>
  )
}

/* ══════════════ Win11 任务栏 ══════════════ */

function Taskbar() {
  const [now, setNow] = useState(new Date())
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000)
    return () => clearInterval(t)
  }, [])
  const hh = String(now.getHours()).padStart(2, '0')
  const mm = String(now.getMinutes()).padStart(2, '0')
  return (
    <footer className="taskbar">
      <div className="tb-left">
        <button className="tb-btn" aria-label="开始"><Icon name="start" size={18} /></button>
        <button className="tb-btn" aria-label="搜索"><Icon name="search" size={17} /></button>
        <button className="tb-btn" aria-label="文件夹"><Icon name="folder" size={17} /></button>
        <button className="tb-btn" aria-label="Edge"><Icon name="edge" size={17} /></button>
        <button className="tb-btn tb-active" aria-label="Windows PowerShell"><Icon name="powershell" size={16} /></button>
        <button className="tb-btn" aria-label="Excel"><Icon name="excel" size={16} /></button>
      </div>
      <div className="tb-right">
        <Icon name="wifi" size={14} />
        <Icon name="volume" size={14} />
        <span className="tb-clock">
          {hh}:{mm}
          <br />
          {now.getFullYear()}/{now.getMonth() + 1}/{now.getDate()}
        </span>
        <button className="tb-btn" aria-label="显示桌面"><Icon name="trash" size={15} /></button>
      </div>
    </footer>
  )
}

/* ══════════════ 桌面 ══════════════ */

export default function App() {
  const r = useReplay()
  return (
    <div className="desktop" style={{ backgroundImage: `url(${wallpaper})` }}>
      <ControlDock
        playing={r.playing}
        finished={r.finished}
        speed={r.speed}
        limit={r.limit}
        total={r.total}
        cur={r.cur}
        onToggle={r.toggle}
        onReplay={r.replay}
        onSkip={r.skip}
        onSpeed={r.setSpeed}
        onLimit={r.setLimit}
      />
      <TerminalWin log={r.log} err={r.err} />
      <ExcelWin rows={r.rows} meta={r.meta} finished={r.finished} />
      <p className="compliance">根据真实案例改编 · 仅采集公开信息 · 不涉个人信息 · 数据仅供演示</p>
      <Taskbar />
    </div>
  )
}
