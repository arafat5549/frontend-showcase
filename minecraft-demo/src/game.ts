/* 游戏主控制器：输入 → 第三人称移动/碰撞 → 相机 → 交互 → 昼夜 */
import * as THREE from 'three'
import { createWorld } from './world'
import { createPlayer } from './player'
import { createInput } from './input'
import { createCameraRig } from './camera-rig'
import { createDayCycle } from './daycycle'
import { createInteract, BLOCK_TYPES } from './interact'

export interface HudState {
  biome: string
  timeLabel: string
  pos: { x: number; y: number; z: number }
  selectedName: string
  selectedId: number
  day: number
  grounded: boolean
}

export async function createGame(container: HTMLElement, onHud: (h: HudState) => void, skin: 'steve' | 'alex' | 'player' = 'steve') {
  const world = createWorld(container)
  // 皮肤模型（菜单选择）异步加载，失败回退方块小人
  const player = await createPlayer(world.scene, skin)
  player.group.position.copy(world.spawn)

  const input = createInput(container)
  const rig = createCameraRig(world.camera)
  const day = createDayCycle({
    fog: world.fog,
    sun: world.sun,
    hemi: world.hemi,
    skyUniforms: world.skyUniforms,
    sunDisc: world.sunDisc,
    moonDisc: world.moonDisc,
  })
  const interact = createInteract(world, world.scene, world.treeGroups)

  // 玩家运动状态
  const vel = new THREE.Vector3()
  let facing = Math.PI // 面向 -z
  let targetFacing = facing
  let mouseYOff = 0
  let zoom = 1
  let grounded = false
  let hudT = 0

  const WALK = 3.4
  const RUN = 5.6
  const GRAVITY = -9.81
  const JUMP_FORCE = 5.2

  // 脚底碰撞：地形 + 出生平台（方块地皮）+ 已放置方块
  const PLATFORM = { x0: -9.5, x1: 14.5, z0: -10.5, z1: 13.5 } // 24×24 方块地皮范围
  const standHeight = (x: number, z: number): number => {
    let h = world.getTerrainHeight(x, z)
    // 出生平台顶面 y=0（高度图中心挖坑 -0.5，需以地皮为准）
    if (x >= PLATFORM.x0 && x <= PLATFORM.x1 && z >= PLATFORM.z0 && z <= PLATFORM.z1) {
      h = Math.max(h, 0)
    }
    // 已放置方块：脚底 0.5×0.5 范围覆盖格
    const footprint = 0.28
    for (const bx of [Math.floor(x - footprint), Math.floor(x + footprint)]) {
      for (const bz of [Math.floor(z - footprint), Math.floor(z + footprint)]) {
        for (let by = Math.floor(h) + 1; by <= Math.floor(h) + 3; by++) {
          if (interact.getBlockAt(bx, by, bz) !== 0) h = Math.max(h, by + 1)
        }
      }
    }
    return h
  }

  // 水平碰撞：目标脚底与方块格重叠则拒绝
  const blocked = (x: number, z: number, footY: number): boolean => {
    const f = 0.28
    for (const bx of [Math.floor(x - f), Math.floor(x + f)]) {
      for (const bz of [Math.floor(z - f), Math.floor(z + f)]) {
        for (let by = Math.floor(footY); by < Math.floor(footY) + 1.9; by++) {
          if (interact.getBlockAt(bx, by, bz) !== 0) return true
        }
      }
    }
    return false
  }

  let last = performance.now()
  let raf = 0

  let playerMoving = false
  let playerRunning = false

  const loop = (now: number) => {
    const dt = Math.min((now - last) / 1000, 0.05)
    last = now
    input.update()
    const s = input.state

    // ── 转向（鼠标拖拽）──
    targetFacing -= s.dx * 0.004
    facing += (targetFacing - facing) * 0.12
    mouseYOff = THREE.MathUtils.clamp(mouseYOff + s.dy * 0.012, -3.5, 5)
    if (s.scroll !== 0) zoom = THREE.MathUtils.clamp(zoom - s.scroll * 0.15, 0.7, 2.2)

    // ── 移动（相对朝向）──
    const sin = Math.sin(facing)
    const cos = Math.cos(facing)
    const fwd = (s.forward ? 1 : 0) - (s.backward ? 0.72 : 0)
    const strafe = (s.right ? 1 : 0) - (s.left ? 1 : 0)
    const speed = s.run ? RUN : WALK
    playerRunning = s.run
    let mx = 0
    let mz = 0
    if (fwd !== 0) {
      mx += sin * fwd
      mz += cos * fwd
    }
    if (strafe !== 0) {
      mx += cos * strafe * 0.82
      mz += -sin * strafe * 0.82
    }
    const mLen = Math.hypot(mx, mz)
    if (mLen > 0.001) {
      const tx = player.group.position.x + (mx / mLen) * speed * dt
      const tz = player.group.position.z + (mz / mLen) * speed * dt
      const footY = player.group.position.y
      // 水平碰撞（分别 x/z 尝试）
      if (!blocked(tx, player.group.position.z, footY)) player.group.position.x = tx
      if (!blocked(player.group.position.x, tz, footY)) player.group.position.z = tz
      player.group.rotation.y = facing + Math.PI // 模型面向移动方向（模型正面 +z，rotation.y 翻转）
      playerMoving = true
    } else {
      playerMoving = false
    }

    // ── 重力与跳跃 ──
    const groundY = standHeight(player.group.position.x, player.group.position.z)
    if (s.jump && grounded) {
      vel.y = JUMP_FORCE
      grounded = false
    }
    if (!grounded) {
      vel.y += GRAVITY * dt
      player.group.position.y += vel.y * dt
      if (player.group.position.y <= groundY + 0.05) {
        player.group.position.y = groundY
        vel.y = 0
        grounded = true
      }
    } else {
      player.group.position.y = groundY
      vel.y = -1.2
    }

    // ── 交互 ──
    if (s.leftClick) interact.mine()
    if (s.rightClick) interact.place()
    if (s.pick !== null) interact.selected = s.pick
    interact.update(dt)

    // ── 昼夜 / 云 ──
    day.update(dt)
    for (const c of world.clouds) {
      c.position.x += dt * 0.22
      if (c.position.x > 16) c.position.x = -16
    }

    // ── 相机 ──
    rig.update(dt, player.group.position, facing, mouseYOff, zoom)

    // ── 玩家动画（皮肤模型权重混合 / fallback 方块小人） ──
    player.update(dt, { moving: playerMoving, running: playerRunning, grounded })

    // ── HUD（节流 ~4Hz）──
    hudT += dt
    if (hudT > 0.25) {
      hudT = 0
      const b = BLOCK_TYPES.find((x) => x.id === interact.selected)
      onHud({
        biome: world.getBiomeName(player.group.position.x, player.group.position.z),
        timeLabel: day.state.label,
        pos: {
          x: Math.round(player.group.position.x * 10) / 10,
          y: Math.round(player.group.position.y * 10) / 10,
          z: Math.round(player.group.position.z * 10) / 10,
        },
        selectedName: b?.name ?? '',
        selectedId: interact.selected,
        day: day.state.timeOfDay,
        grounded,
      })
    }

    world.renderer.render(world.scene, world.camera)
    raf = requestAnimationFrame(loop)
  }
  raf = requestAnimationFrame(loop)

  return {
    world,
    dispose() {
      cancelAnimationFrame(raf)
      input.dispose()
      world.renderer.dispose()
      container.removeChild(world.renderer.domElement)
    },
  }
}
