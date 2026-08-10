import { useEffect, useRef, useState } from 'react'
import { createWorld } from './world'
import { Sim, type Phase } from './sim'
import './style.css'

export default function App() {
  const mountRef = useRef<HTMLDivElement>(null)
  const simRef = useRef<Sim | null>(null)
  const [subtitle, setSubtitle] = useState<string | null>(null)
  const [phase, setPhase] = useState<Phase>('build')
  const [playing, setPlaying] = useState(true)
  const [speed, setSpeedState] = useState(1)
  const [progress, setProgress] = useState(0)
  const [done, setDone] = useState(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const world = createWorld(mount)
    const sim = new Sim(world, {
      onSubtitle: setSubtitle,
      onPhase: (p) => {
        setPhase(p)
        if (p === 'done') setDone(true)
      },
      onProgress: (t) => setProgress(t),
      onDone: () => setDone(true),
    })
    simRef.current = sim

    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      sim.jumpTo('done')
    }

    let raf = 0
    let last = performance.now()
    const loop = (now: number) => {
      const dt = Math.min((now - last) / 1000, 0.05)
      last = now
      sim.update(dt * sim.speed)
      world.controls.update()
      world.renderer.render(world.scene, world.camera)
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => {
      cancelAnimationFrame(raf)
      world.renderer.dispose()
      mount.removeChild(world.renderer.domElement)
    }
  }, [])

  const toggle = () => {
    const sim = simRef.current
    if (!sim || done) return
    sim.playing = !sim.playing
    setPlaying(sim.playing)
  }
  const replay = () => {
    const sim = simRef.current
    if (!sim) return
    setDone(false)
    sim.reset()
    sim.playing = true
    setPlaying(true)
    setSpeedState(1)
    sim.speed = 1
  }
  const setSpeed = (v: number) => {
    const sim = simRef.current
    if (!sim) return
    sim.speed = v
    setSpeedState(v)
  }
  const jump = (p: Phase) => {
    const sim = simRef.current
    if (!sim) return
    setDone(false)
    sim.playing = true
    setPlaying(true)
    sim.jumpTo(p)
  }
  const skip = () => {
    const sim = simRef.current
    if (!sim) return
    setDone(false)
    sim.jumpTo('done')
    setPhase('done')
    setDone(true)
  }

  const pct = Math.min(100, Math.round((progress / 33.7) * 100))

  return (
    <div className="app">
      <div className="viewport" ref={mountRef} />

      {/* 顶部状态条 */}
      <div className="statusbar">
        <span className="sb-title">方块世界 · 建造与手表</span>
        <span className="sb-phase">
          {phase === 'build' ? '■ 建造中' : phase === 'watch' ? '◆ 玩手表' : '✔ 完成'}
        </span>
        <span className="sb-progress">{pct}%</span>
      </div>

      {/* 控制条 */}
      <div className="dock">
        <button className="primary" onClick={toggle} disabled={done}>
          {playing ? '⏸ 暂停' : '▶ 继续'}
        </button>
        <button onClick={replay} disabled={!done && progress === 0}>↺ 重播</button>
        <span className="group">
          速度
          {[1, 2, 4].map((s) => (
            <button key={s} className={speed === s ? 'active' : ''} onClick={() => setSpeed(s)}>
              {s}x
            </button>
          ))}
        </span>
        <span className="group">
          场景
          <button className={phase === 'build' && progress < 23.5 ? 'active' : ''} onClick={() => jump('build')}>建造</button>
          <button className={phase === 'watch' ? 'active' : ''} onClick={() => jump('watch')}>玩手表</button>
        </span>
        <button onClick={skip} disabled={done}>跳过 → 看结果</button>
      </div>

      {/* 底部字幕（Minecraft 聊天栏风格） */}
      <div className={'subtitle' + (subtitle ? ' show' : '')}>
        {subtitle ? (
          <>
            <span className="sub-name">工地播报</span> {subtitle}
          </>
        ) : (
          ' '
        )}
      </div>

      <div className="hint">拖拽旋转视角 · 滚轮缩放</div>
    </div>
  )
}
