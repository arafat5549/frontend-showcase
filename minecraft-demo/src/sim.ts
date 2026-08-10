/* 演示编排器：全局时间线 + 建造/手表两场景状态机 */
import * as THREE from 'three'
import { houseBlueprint, blockMesh, type Block } from './blueprint'
import { createPlayer, walkTo, animatePlayer, type Player } from './player'
import type { World } from './world'

export type Phase = 'build' | 'watch' | 'done'

export interface SimEvents {
  onSubtitle: (s: string | null) => void
  onPhase: (p: Phase) => void
  onProgress: (t: number, total: number) => void
  onDone: () => void
}

const BUILD_END = 23.5
const WATCH_END = 33.7
const TOTAL = WATCH_END

interface Sub {
  at: number
  text: string
  dur: number
}
const SUBS: Sub[] = [
  { at: 0.3, text: '新工地开工！给客户盖一栋小房子', dur: 2.4 },
  { at: 1.2, text: '打地基……', dur: 4.5 },
  { at: 6.0, text: '砌墙……', dur: 6.0 },
  { at: 12.5, text: '装上门窗！', dur: 1.6 },
  { at: 14.0, text: '盖屋顶……', dur: 7.5 },
  { at: 22.2, text: '完工！', dur: 1.6 },
  { at: 23.5, text: '建造完成！休息一下——看看手表', dur: 3.0 },
  { at: 26.5, text: '碰一碰，加好友！', dur: 2.6 },
  { at: 29.2, text: '新朋友 +1 ✦', dur: 2.2 },
  { at: 31.5, text: '今天也是元气满满的一天！', dur: 2.2 },
]

const STEP_MS: Record<Block['kind'], number> = {
  base: 0.13,
  wall: 0.14,
  door: 0.16,
  window: 0.16,
  roof: 0.15,
}

const easeOutBack = (t: number) => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

export class Sim {
  t = 0
  speed = 1
  playing = true
  phase: Phase = 'build'

  private world: World
  private ev: SimEvents
  private blocks: Block[]
  private meshes = new Map<Block, THREE.Mesh>()
  private playerA: Player
  private playerB: Player | null = null
  private watch: THREE.Group | null = null
  private watchFace: THREE.Mesh | null = null

  // 建造状态机
  private bIdx = 0
  private bState: 'walk' | 'lift' | 'drop' = 'walk'
  private bTimer = 0
  private curMesh: THREE.Mesh | null = null
  private armLift = 0
  private watchLift = 0
  private jump = 0

  // 手表场景状态机
  private wState: 'idle' | 'look' | 'approach' | 'bump' | 'joy' | 'end' = 'idle'
  private wTimer = 0
  private bumped = false
  private endLerp = 0

  private subIdx = 0
  private curSub: Sub | null = null
  private doneFired = false

  constructor(world: World, events: SimEvents) {
    this.world = world
    this.ev = events
    this.blocks = houseBlueprint()
    // 预建全部方块（隐藏），保证跳转/跳过时瞬间可现形
    for (const b of this.blocks) {
      const m = blockMesh(b)
      m.visible = false
      world.scene.add(m)
      this.meshes.set(b, m)
    }
    this.playerA = createPlayer()
    this.playerA.group.position.set(3.5, 0, 7.2)
    this.playerA.group.rotation.y = Math.PI
    world.scene.add(this.playerA.group)
  }

  /* ── 字幕 ── */
  private runSubs() {
    while (this.subIdx < SUBS.length && SUBS[this.subIdx].at <= this.t) {
      this.curSub = SUBS[this.subIdx]
      this.subIdx += 1
      this.ev.onSubtitle(this.curSub.text)
    }
    if (this.curSub && this.t > this.curSub.at + this.curSub.dur) {
      this.curSub = null
      this.ev.onSubtitle(null)
    }
  }

  /* ── 建造目标点：块外侧（房子外圈方向）；内部块（如屋顶）沿射线外推出禁区 ── */
  private standPoint(b: Block): [number, number] {
    const cx = b.x + 0.5
    const cz = b.z + 0.5
    let dx = cx - 3
    let dz = cz - 2
    const len = Math.hypot(dx, dz) || 1
    dx /= len
    dz /= len
    let sx = cx + dx * 1.45
    let sz = cz + dz * 1.45
    if (Sim.pointInRect(sx, sz)) {
      // 射线出矩形参数：沿 d 方向先穿出的边界
      const r = Sim.RECT
      let tx = Infinity
      let tz = Infinity
      if (dx > 1e-6) tx = (r.x1 - cx) / dx
      else if (dx < -1e-6) tx = (r.x0 - cx) / dx
      if (dz > 1e-6) tz = (r.z1 - cz) / dz
      else if (dz < -1e-6) tz = (r.z0 - cz) / dz
      const texit = Math.min(tx, tz)
      sx = cx + dx * (texit + 0.7)
      sz = cz + dz * (texit + 0.7)
    }
    return [sx, sz]
  }

  /* ── 行走路径绕行：直线穿过房子（禁区矩形）时走角点 ── */
  private static RECT = { x0: -1.1, x1: 6.6, z0: -1.1, z1: 5.6 } // 房子占地 + 小人缓冲
  private path: [number, number][] = []
  private pathB: [number, number][] = []

  private static pointInRect(x: number, z: number): boolean {
    const r = Sim.RECT
    return x >= r.x0 && x <= r.x1 && z >= r.z0 && z <= r.z1
  }

  private static segHitsRect(ax: number, az: number, bx: number, bz: number): boolean {
    const r = Sim.RECT
    if (Sim.pointInRect(ax, az) || Sim.pointInRect(bx, bz)) return true
    // 线段与矩形 4 边相交
    const edges: [number, number, number, number][] = [
      [r.x0, r.z0, r.x1, r.z0],
      [r.x1, r.z0, r.x1, r.z1],
      [r.x1, r.z1, r.x0, r.z1],
      [r.x0, r.z1, r.x0, r.z0],
    ]
    for (const [cx, cz, dx, dz] of edges) {
      const s1x = bx - ax
      const s1z = bz - az
      const s2x = dx - cx
      const s2z = dz - cz
      const denom = s1x * s2z - s1z * s2x
      if (Math.abs(denom) < 1e-9) continue
      const t = ((cx - ax) * s2z - (cz - az) * s2x) / denom
      const u = ((cx - ax) * s1z - (cz - az) * s1x) / denom
      if (t >= 0 && t <= 1 && u >= 0 && u <= 1) return true
    }
    return false
  }

  private computePath(tx: number, tz: number, p: Player = this.playerA) {
    const ax = p.group.position.x
    const az = p.group.position.z
    this.pathB = []
    const path: [number, number][] = [[tx, tz]]
    if (Sim.segHitsRect(ax, az, tx, tz)) {
      const r = Sim.RECT
      const corners: [number, number][] = [
        [r.x0, r.z0],
        [r.x1, r.z0],
        [r.x1, r.z1],
        [r.x0, r.z1],
      ]
      let best: [number, number] | null = null
      let bestLen = Infinity
      for (const [cx, cz] of corners) {
        if (Sim.segHitsRect(ax, az, cx, cz)) continue
        if (Sim.segHitsRect(cx, cz, tx, tz)) continue
        const len = Math.hypot(cx - ax, cz - az) + Math.hypot(tx - cx, tz - cz)
        if (len < bestLen) {
          bestLen = len
          best = [cx, cz]
        }
      }
      if (best) {
        path.length = 0
        path.push(best, [tx, tz])
      }
    }
    if (p === this.playerA) this.path = path
    else this.pathB = path
  }

  /* ── 建造更新 ── */
  private updateBuild(dt: number) {
    if (this.bIdx >= this.blocks.length) {
      this.finishBuild()
      return
    }
    const b = this.blocks[this.bIdx]
    if (this.instant) {
      // 快速模式：块直接就位
      this.meshes.get(b)!.visible = true
      this.bIdx += 1
      return
    }
    const [sx, sz] = this.standPoint(b)
    switch (this.bState) {
      case 'walk': {
        if (!this.path.length) this.computePath(sx, sz)
        const [tx, tz] = this.path[0]
        const moving = walkTo(this.playerA, tx, tz, dt, 4.2)
        if (!moving) {
          this.path.shift()
          if (!this.path.length) {
            this.bState = 'lift'
            this.bTimer = 0
          }
        }
        break
      }
      case 'lift': {
        this.bTimer += dt
        this.armLift = Math.min(1, this.bTimer / 0.24)
        if (this.bTimer >= 0.24) {
          this.curMesh = this.meshes.get(b)!
          this.curMesh.visible = true
          this.curMesh.position.y = b.y + 3.4
          this.bState = 'drop'
          this.bTimer = 0
        }
        break
      }
      case 'drop': {
        this.bTimer += dt
        const dur = STEP_MS[b.kind]
        const t = Math.min(1, this.bTimer / dur)
        const m = this.curMesh!
        const s = easeOutBack(t)
        m.position.y = b.y + 0.5 + (1 - t) * 3.2
        m.scale.set(s, s, s)
        if (t >= 1) {
          m.position.y = b.y + 0.5
          m.scale.set(1, 1, 1)
          this.bIdx += 1
          this.bState = 'walk'
          this.armLift = 0
        }
        break
      }
    }
    animatePlayer(this.playerA, dt, this.armLift, this.watchLift)
  }

  private finishBuild() {
    if (this.phase === 'build') {
      this.phase = 'watch'
      this.ev.onPhase('watch')
      this.wState = 'idle'
      // A 走到门前空地，面向房子（+z）
      this.playerA.group.position.set(3.0, 0, -1.6)
      this.playerA.group.rotation.y = 0
      // 创建手表
      this.spawnWatch()
      // B 小人从远处登场
      const b = createPlayer({ shirt: 0xe07b39, pants: 0x5a3a8a })
      b.group.position.set(11, 0, 9)
      this.world.scene.add(b.group)
      this.playerB = b
    }
  }

  private spawnWatch() {
    const g = new THREE.Group()
    const body = new THREE.Mesh(
      new THREE.BoxGeometry(0.15, 0.11, 0.07),
      new THREE.MeshLambertMaterial({ color: 0x1a1a24 }),
    )
    const face = new THREE.Mesh(
      new THREE.BoxGeometry(0.11, 0.07, 0.02),
      new THREE.MeshLambertMaterial({ color: 0x0a0a12, emissive: 0x0a0a12 }),
    )
    face.position.z = 0.05
    g.add(body, face)
    this.watch = g
    this.watchFace = face
    this.playerA.watchMount.add(g)
  }

  /* ── 手表场景更新 ── */
  private updateWatch(dt: number) {
    const A = this.playerA
    const B = this.playerB
    this.wTimer += dt
    switch (this.wState) {
      case 'idle':
        if (this.t >= 24.3) {
          this.wState = 'look'
          this.ev.onSubtitle('嗯？有小天才手表消息……')
        }
        break
      case 'look':
        this.watchLift = Math.min(1, this.watchLift + dt * 2.2)
        if (this.watchFace) {
          ;(this.watchFace.material as THREE.MeshLambertMaterial).emissive.setHex(0x4fc3ff)
          this.watchFace.scale.setScalar(1 + Math.sin(this.t * 6) * 0.06)
        }
        if (this.t >= 26.4) {
          this.wState = 'approach'
          this.ev.onSubtitle('诶，他也戴小天才！碰一碰……')
        }
        break
      case 'approach': {
        // B 绕行走来，与 A 并排（A 在 (3, -1.6)），避免面对面伸手插进身体
        if (!this.pathB.length) this.computePath(4.4, -1.6, B!)
        const [tx, tz] = this.pathB[0]
        const moving = walkTo(B!, tx, tz, dt, 2.6)
        if (!moving) {
          this.pathB.shift()
          if (!this.pathB.length) {
            B!.group.rotation.y = 0 // 与 A 同向面向房子
            this.wState = 'bump'
            this.wTimer = 0
            this.bumped = false
          }
        }
        break
      }
      case 'bump': {
        if (!this.bumped) {
          this.bumped = true
          this.ev.onSubtitle('叮！碰一碰，加好友！')
        }
        const p = Math.min(1, this.wTimer / 0.9)
        this.watchLift = 1 // 两人并排，各自抬起左手腕
        if (this.watchFace) {
          const mat = this.watchFace.material as THREE.MeshLambertMaterial
          mat.emissive.setHex(p > 0.55 ? 0x6dff7a : 0x4fc3ff)
          this.watchFace.scale.setScalar(1 + Math.sin(this.t * 10) * (p > 0.55 ? 0.1 : 0.05))
        }
        if (this.wTimer >= 1.3) {
          this.wState = 'joy'
          this.ev.onSubtitle('新朋友 +1 ✦')
        }
        break
      }
      case 'joy':
        this.jump += dt * 1.4 // 跳跃相位持续累积
        if (this.t >= 30.8) {
          this.wState = 'end'
          this.ev.onSubtitle('今天也是元气满满的一天！')
        }
        break
      case 'end':
        this.jump = 0
        this.endLerp = Math.min(1, this.endLerp + dt * 0.5)
        // 镜头拉远：相机目标平移到房子全景
        this.world.controls.target.lerp(
          new THREE.Vector3(3, 2.6, 0),
          dt * 0.8,
        )
        if (this.t >= WATCH_END && !this.doneFired) {
          this.doneFired = true
          this.phase = 'done'
          this.ev.onPhase('done')
          this.ev.onSubtitle(null)
          this.ev.onDone()
        }
        break
    }
    animatePlayer(A, dt, 0, this.watchLift, this.jump)
    if (B) animatePlayer(B, dt, 0, this.wState === 'bump' ? 1 : 0, this.jump)
  }

  /* ── 主循环（App 每帧调用，dt 为已按 speed 缩放的实际增量） ── */
  update(dt: number) {
    if (!this.playing) return
    this.t += dt
    this.runSubs()
    if (this.phase === 'build') this.updateBuild(dt)
    else if (this.phase === 'watch') this.updateWatch(dt)
    // 云飘动
    for (const c of this.world.clouds) {
      c.position.x += dt * 0.22
      if (c.position.x > 16) c.position.x = -16
    }
    this.ev.onProgress(this.t, TOTAL)
  }

  /* ── 控制 ── */
  /** 快进模式：跳转/跳过时方块瞬时就位 */
  instant = false

  reset() {
    this.t = 0
    this.phase = 'build'
    this.bIdx = 0
    this.bState = 'walk'
    this.bTimer = 0
    this.armLift = 0
    this.watchLift = 0
    this.jump = 0
    this.wState = 'idle'
    this.wTimer = 0
    this.bumped = false
    this.endLerp = 0
    this.subIdx = 0
    this.curSub = null
    this.doneFired = false
    for (const m of this.meshes.values()) {
      m.visible = false
      m.scale.set(1, 1, 1)
    }
    if (this.playerB) {
      this.world.scene.remove(this.playerB.group)
      this.playerB = null
    }
    if (this.watch) {
      this.playerA.watchMount.remove(this.watch)
      this.watch = null
      this.watchFace = null
    }
    this.playerA.group.position.set(3.5, 0, 7.2)
    this.playerA.group.rotation.y = Math.PI
    this.path = []
    this.pathB = []
    this.world.controls.target.set(0, 2.2, 0)
    this.instant = false
    this.ev.onSubtitle(null)
    this.ev.onPhase('build')
  }

  /** 跳到指定场景（快进渲染，随后正常播放） */
  jumpTo(phase: Phase) {
    this.reset()
    this.instant = true
    if (phase === 'watch') {
      this.t = BUILD_END - 0.05
      while (this.bIdx < this.blocks.length) this.updateBuild(0.016)
      this.instant = false
      this.t = BUILD_END
      // 进入手表场景
      this.finishBuild()
      // 字幕指针快进到手表段
      while (this.subIdx < SUBS.length && SUBS[this.subIdx].at < 23.5) this.subIdx += 1
      this.runSubs()
      this.ev.onProgress(this.t, TOTAL)
    } else if (phase === 'done') {
      this.t = BUILD_END - 0.05
      while (this.bIdx < this.blocks.length) this.updateBuild(0.016)
      this.instant = false
      this.t = BUILD_END
      this.finishBuild()
      this.wState = 'end'
      this.endLerp = 1
      this.playerB!.group.position.set(4.4, 0, -1.6)
      this.playerB!.group.rotation.y = 0
      this.ev.onSubtitle(null)
      this.ev.onPhase('done')
      this.ev.onDone()
    }
  }
}
