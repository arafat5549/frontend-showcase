/* 主菜单（复刻 TPMC UiRoot 风格）：标题 + 皮肤选择 + 3D 动画预览 */
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { SKIN_LIST, loadModel, type SkinId } from './player'

const ANIMS = [
  { id: 'idle', label: '站立', clip: 'idle' },
  { id: 'walk', label: '行走', clip: 'forward' },
  { id: 'run', label: '奔跑', clip: 'running_forward' },
  { id: 'jump', label: '跳跃', clip: 'jump' },
]

/** 皮肤 3D 预览：独立小场景 + 自动旋转 + 动画切换 */
function SkinPreview({ skinId, anim }: { skinId: SkinId; anim: string }) {
  const mountRef = useRef<HTMLDivElement>(null)
  const applyRef = useRef<((id: string) => void) | null>(null)
  const disposedRef = useRef(false)

  useEffect(() => {
    const mount = mountRef.current
    if (!mount) return
    const def = SKIN_LIST.find((s) => s.id === skinId) ?? SKIN_LIST[0]
    let raf = 0
    let group: THREE.Group | null = null
    let mixer: THREE.AnimationMixer | null = null
    let actions: Map<string, THREE.AnimationAction> | null = null
    let renderer: THREE.WebGLRenderer | null = null
    let rot = 0

    loadModel(def.url)
      .then((m) => {
        if (disposedRef.current) return
        group = m.group
        mixer = m.mixer
        actions = m.actions
        const scene = new THREE.Scene()
        scene.background = new THREE.Color(0x9ad0f5)
        const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 50)
        camera.position.set(1.1, 1.5, 3.1)
        renderer = new THREE.WebGLRenderer({ antialias: true })
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
        renderer.shadowMap.enabled = true
        mount.appendChild(renderer.domElement)
        const ground = new THREE.Mesh(
          new THREE.BoxGeometry(4.4, 0.12, 4.4),
          new THREE.MeshLambertMaterial({ color: 0x7cc44a }),
        )
        ground.position.y = -0.06
        ground.receiveShadow = true
        scene.add(ground)
        scene.add(new THREE.HemisphereLight(0xffffff, 0x88aa66, 0.9))
        const sun = new THREE.DirectionalLight(0xffffff, 1.4)
        sun.position.set(2.5, 4, 2.5)
        sun.castShadow = true
        sun.shadow.mapSize.set(512, 512)
        scene.add(sun)
        group.position.y = 0.01
        scene.add(group)

        applyRef.current = (id: string) => {
          if (!actions) return
          const clipName = ANIMS.find((a) => a.id === id)?.clip ?? 'idle'
          for (const a of actions.values()) {
            const target = a === actions!.get(clipName)
            a.setEffectiveWeight(target ? 1 : 0)
            if (target) {
              a.setLoop(THREE.LoopRepeat, 1)
              a.reset().play()
            }
          }
        }
        applyRef.current(anim)

        const last = performance.now()
        const loop = (now: number) => {
          const dt = Math.min((now - last) / 1000, 0.05)
          rot += dt * 0.45
          group!.rotation.y = Math.PI + rot
          mixer!.update(dt)
          renderer!.render(scene, camera)
          raf = requestAnimationFrame(loop)
        }
        raf = requestAnimationFrame(loop)
      })
      .catch((e) => console.warn('[menu] 皮肤预览加载失败', e))

    return () => {
      cancelAnimationFrame(raf)
      if (renderer && mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement)
    }
  }, [skinId])

  // 动画切换（复用已加载的 apply）
  useEffect(() => {
    applyRef.current?.(anim)
  }, [anim])

  useEffect(() => () => {
    disposedRef.current = true
  }, [])

  return <div className="skin-preview" ref={mountRef} />
}

export default function Menu({ onStart }: { onStart: (skin: SkinId) => void }) {
  const [skin, setSkin] = useState<SkinId>('steve')
  const [anim, setAnim] = useState('idle')

  return (
    <div className="menu">
      <div className="menu-title">
        <h1>方块世界</h1>
        <p>Minecraft 风格 3D 演示 · 复刻自 Third-Person-MC</p>
      </div>

      <div className="menu-body">
        {/* 皮肤预览（3D） */}
        <div className="menu-preview">
          <SkinPreview skinId={skin} anim={anim} />
          <div className="anim-btns">
            {ANIMS.map((a) => (
              <button key={a.id} className={anim === a.id ? 'active' : ''} onClick={() => setAnim(a.id)}>
                {a.label}
              </button>
            ))}
          </div>
        </div>

        {/* 皮肤选择 */}
        <div className="skin-cards">
          {SKIN_LIST.map((s) => (
            <button
              key={s.id}
              className={'skin-card' + (skin === s.id ? ' active' : '')}
              onClick={() => setSkin(s.id)}
            >
              <span className="skin-name">{s.name}</span>
              <span className="skin-desc">{s.id === 'steve' ? '经典角色' : s.id === 'alex' ? '细长手臂' : '经典皮肤'}</span>
            </button>
          ))}
        </div>
      </div>

      <button className="btn-start" onClick={() => onStart(skin)}>
        开始游戏 ▶
      </button>
      <p className="menu-foot">WASD 移动 · 空格跳跃 · Shift 奔跑 · 左键拖拽视角 · 左键点击挖掘 · 右键放置</p>
    </div>
  )
}
