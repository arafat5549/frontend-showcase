/* 方块小人（Steve 风）：头/身/臂/腿 BoxGeometry 拼装 + 行走/举手/跳跃动画 */
import * as THREE from 'three'

export interface Player {
  group: THREE.Group
  target: THREE.Vector3 // 移动目标（xz）
  holding: THREE.Group | null // 手持方块挂点（右手）
  watchMount: THREE.Group // 左手腕（手表挂点）
  walkPhase: number
  moving: boolean
  setShirt: (color: number) => void
}

const TAU = Math.PI * 2

export function createPlayer(opts: { shirt?: number; pants?: number; skin?: number } = {}): Player {
  const shirt = opts.shirt ?? 0x1e9e5f
  const pants = opts.pants ?? 0x3150b0
  const skin = opts.skin ?? 0xd8a06b

  const group = new THREE.Group()
  const mat = (c: number) => new THREE.MeshLambertMaterial({ color: c })

  // 头
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.62, 0.62), mat(skin))
  head.position.y = 1.72
  head.castShadow = true
  group.add(head)
  // 眼睛
  const eyeMat = new THREE.MeshLambertMaterial({ color: 0x2b2b33 })
  const eyeGeo = new THREE.BoxGeometry(0.07, 0.1, 0.03)
  for (const s of [-1, 1]) {
    const eye = new THREE.Mesh(eyeGeo, eyeMat)
    eye.position.set(s * 0.17, 1.76, 0.32)
    group.add(eye)
  }

  // 身体
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.72, 0.32), mat(shirt))
  body.position.y = 1.05
  body.castShadow = true
  group.add(body)

  // 腿（几何体重心下移 → 旋转轴在髋部，摆动不穿身体）
  const legGeo = new THREE.BoxGeometry(0.26, 0.6, 0.3)
  legGeo.translate(0, -0.3, 0)
  const legL = new THREE.Mesh(legGeo, mat(pants))
  legL.position.set(-0.15, 0.3, 0)
  const legR = new THREE.Mesh(legGeo, mat(pants))
  legR.position.set(0.15, 0.3, 0)
  group.add(legL, legR)

  // 手臂（几何体重心下移 → 旋转轴在肩部，抬臂不插身体）
  const armGeo = new THREE.BoxGeometry(0.2, 0.62, 0.25)
  armGeo.translate(0, -0.31, 0)
  const armL = new THREE.Mesh(armGeo, mat(shirt))
  armL.position.set(-0.41, 1.05, 0)
  const armR = new THREE.Mesh(armGeo, mat(shirt))
  armR.position.set(0.41, 1.05, 0)
  group.add(armL, armR)

  // 右手：方块挂点（持物）
  const holding = new THREE.Group()
  holding.position.set(0, -0.4, 0)
  armR.add(holding)
  // 左手腕：手表挂点
  const watchMount = new THREE.Group()
  watchMount.position.set(0, -0.34, 0)
  armL.add(watchMount)

  // 皮肤色手（裸手露出）
  const handMat = mat(skin)
  const handGeo = new THREE.BoxGeometry(0.2, 0.12, 0.25)
  const handL = new THREE.Mesh(handGeo, handMat)
  handL.position.copy(holding.position)
  armR.add(handL)
  const handR2 = new THREE.Mesh(handGeo, handMat)
  handR2.position.copy(watchMount.position)
  armL.add(handR2)

  return {
    group,
    target: new THREE.Vector3(0, 0, 0),
    holding,
    watchMount,
    walkPhase: 0,
    moving: false,
    setShirt: (c) => {
      ;(body.material as THREE.MeshLambertMaterial).color.setHex(c)
      ;(armL.material as THREE.MeshLambertMaterial).color.setHex(c)
      ;(armR.material as THREE.MeshLambertMaterial).color.setHex(c)
    },
  }
}

/** 步行动画：目标点到达后停止；返回是否仍在移动 */
export function walkTo(p: Player, x: number, z: number, dt: number, speed = 2.4): boolean {
  const dx = x - p.group.position.x
  const dz = z - p.group.position.z
  const dist = Math.hypot(dx, dz)
  if (dist < 0.02) {
    p.moving = false
    return false
  }
  p.moving = true
  const step = Math.min(dt * speed, dist)
  p.group.position.x += (dx / dist) * step
  p.group.position.z += (dz / dist) * step
  // 朝向移动方向
  p.group.rotation.y = Math.atan2(dx, dz)
  p.walkPhase += dt * speed * 2.4
  return true
}

/** 每帧动画：腿摆 / 手臂摆（走路）；手臂放置动画由外部控制 */
export function animatePlayer(p: Player, _dt: number, armLift = 0, watchLift = 0, jump = 0) {
  const s = Math.sin(p.walkPhase)
  const [legL, legR, armL, armR] = p.group.children.filter((c) => c.type === 'Mesh').slice(-4) as THREE.Mesh[]
  // 腿摆（走路时）
  const swing = p.moving ? s * 0.55 : 0
  legL.rotation.x = swing
  legR.rotation.x = -swing
  // 手臂：走路摆动 + 举方块/看手表
  armR.rotation.x = p.moving ? -s * 0.4 : -armLift * 1.5
  armL.rotation.x = p.moving ? s * 0.4 : -watchLift * 1.6
  // 跳跃（快乐）
  p.group.position.y = jump > 0 ? Math.abs(Math.sin(jump * TAU * 1.4)) * 0.35 * jump : 0
}
