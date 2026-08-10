import { useEffect, useRef, useState } from 'react'
import { createGame, type HudState } from './game'
import { BLOCK_TYPES } from './interact'
import Menu from './Menu'
import type { SkinId } from './player'
import './style.css'

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const gameRef = useRef<Awaited<ReturnType<typeof createGame>> | null>(null)
  const [phase, setPhase] = useState<'menu' | 'game'>('menu')
  const [skin, setSkin] = useState<SkinId>('steve')
  const [hud, setHud] = useState<HudState | null>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    if (phase !== 'game') return
    const mount = mountRef.current
    if (!mount) return
    let disposed = false
    createGame(mount, setHud, skin).then((game) => {
      if (disposed) {
        game.dispose()
        return
      }
      gameRef.current = game
      setReady(true)
    })
    return () => {
      disposed = true
      gameRef.current?.dispose()
    }
  }, [phase, skin])

  if (phase === 'menu') {
    return (
      <Menu
        onStart={(s) => {
          setSkin(s)
          setPhase('game')
        }}
      />
    )
  }

  return (
    <div className="app">
      <div className="viewport" ref={mountRef} />

      {/* 准星 */}
      <div className="crosshair">
        <span className="ch-h" />
        <span className="ch-v" />
      </div>

      {/* 左上：群系 / 时段 */}
      <div className="hud-top-left">
        {hud ? (
          <>
            <div className="hud-line">
              群系：<b>{hud.biome}</b>
            </div>
            <div className="hud-line">
              时段：<b>{hud.timeLabel}</b>
              {!hud.grounded && <span className="hud-air"> 空中</span>}
            </div>
          </>
        ) : (
          <div className="hud-line">加载世界中…</div>
        )}
      </div>

      {/* 右上：坐标 */}
      <div className="hud-top-right">
        {hud && (
          <div className="hud-line mono">
            XYZ {hud.pos.x} / {hud.pos.y} / {hud.pos.z}
          </div>
        )}
      </div>

      {/* 左下：操作提示 */}
      <div className="hud-controls">
        <div><b>WASD</b> 移动</div>
        <div><b>空格</b> 跳跃 · <b>Shift</b> 奔跑</div>
        <div><b>按住左键</b> 拖拽视角 · <b>滚轮</b> 缩放</div>
        <div><b>左键点击</b> 挖掘 · <b>右键</b> 放置</div>
        <div><b>1-5</b> 切换方块</div>
      </div>

      {/* 底部：方块选择栏 */}
      <div className="hotbar">
        {BLOCK_TYPES.map((b) => (
          <div key={b.id} className={'slot' + (hud?.selectedId === b.id ? ' active' : '')}>
            <i className="slot-color" style={{ background: '#' + b.color.toString(16).padStart(6, '0') }} />
            <span>{b.id}</span>
            <em>{b.name}</em>
          </div>
        ))}
      </div>

      {!ready && <div className="loading">加载世界中…</div>}
    </div>
  )
}
