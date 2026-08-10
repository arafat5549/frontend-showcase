/* 方块交互：放置（右键）/ 挖掘（左键）/ 砍树 / 破坏粒子 */
import * as THREE from 'three'
import type { World } from './world'

export interface BlockType {
  id: number
  name: string
  color: number
}

export const BLOCK_TYPES: BlockType[] = [
  { id: 1, name: '草块', color: 0x7cc44a },
  { id: 2, name: '泥土', color: 0x8a5a33 },
  { id: 3, name: '石头', color: 0x8f8f8f },
  { id: 4, name: '木板', color: 0xc98e4e },
  { id: 5, name: '玻璃', color: 0x9fd8ff },
]

const CAPACITY = 256
const PICK_DIST = 9

interface PlacedSet {
  mesh: THREE.InstancedMesh
  grids: Map<string, number> // "x,y,z" -> instance index
  free: number[]
  count: number
}

export interface Interact {
  selected: number // 当前选中方块类型 id
  raycast: () => { point: THREE.Vector3; normal: THREE.Vector3; kind: 'block' | 'tree'; target: unknown; dist: number } | null
  update: (dt: number) => void
  mine: () => void
  place: () => void
  dispose: () => void
  getBlockAt: (x: number, y: number, z: number) => number // 0=空
}

export function createInteract(world: World, scene: THREE.Scene, treeGroups: THREE.Group[]): Interact {
  const camera = world.camera
  const raycaster = new THREE.Raycaster()
  const rayOrigin = new THREE.Vector2(0, 0)
  const dummy = new THREE.Object3D()
  const m4 = new THREE.Matrix4()
  const nrm = new THREE.Vector3()
  const v1 = new THREE.Vector3()
  const v2 = new THREE.Vector3()

  // 每组方块类型一个 InstancedMesh（固定容量，空位复用）
  const sets = new Map<number, PlacedSet>()
  for (const t of BLOCK_TYPES) {
    const geo = new THREE.BoxGeometry(1, 1, 1)
    const mat = new THREE.MeshLambertMaterial({
      color: t.color,
      transparent: t.name === '玻璃',
      opacity: t.name === '玻璃' ? 0.8 : 1,
    })
    const mesh = new THREE.InstancedMesh(geo, mat, CAPACITY)
    mesh.count = 0
    mesh.castShadow = true
    mesh.receiveShadow = true
    scene.add(mesh)
    sets.set(t.id, { mesh, grids: new Map(), free: [], count: 0 })
  }

  // 粒子池
  const particles: { sprite: THREE.Sprite; vel: THREE.Vector3; life: number; max: number }[] = []
  const spawnParticles = (pos: THREE.Vector3, normal: THREE.Vector3, color: number, count = 6) => {
    for (let i = 0; i < count; i++) {
      const mat = new THREE.SpriteMaterial({
        color,
        transparent: true,
        depthWrite: false,
        opacity: 1,
      })
      const sprite = new THREE.Sprite(mat)
      sprite.scale.setScalar(0.22)
      sprite.position.copy(pos)
      scene.add(sprite)
      // 面内随机偏移 + 法线方向速度
      nrm.copy(normal)
      v1.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize()
      v2.copy(nrm).addScaledVector(v1, 0.7).normalize()
      const speed = 0.9 + Math.random() * 1.4
      particles.push({ sprite, vel: v2.multiplyScalar(speed), life: 0, max: 0.55 + Math.random() * 0.2 })
    }
  }

  const gridKey = (x: number, y: number, z: number) => `${x},${y},${z}`

  const setInstance = (set: PlacedSet, idx: number, x: number, y: number, z: number) => {
    dummy.position.set(x + 0.5, y + 0.5, z + 0.5)
    dummy.updateMatrix()
    set.mesh.setMatrixAt(idx, dummy.matrix)
    set.mesh.instanceMatrix.needsUpdate = true
  }

  const placeBlock = (t: number, x: number, y: number, z: number) => {
    const set = sets.get(t)
    if (!set) return
    const key = gridKey(x, y, z)
    if (set.grids.has(key)) return
    let idx: number
    if (set.free.length > 0) {
      idx = set.free.pop()!
    } else {
      if (set.count >= CAPACITY) return
      idx = set.count
      set.count += 1
    }
    setInstance(set, idx, x, y, z)
    set.grids.set(key, idx)
    set.mesh.count = set.count
  }

  const removeBlock = (t: number, x: number, y: number, z: number) => {
    const set = sets.get(t)
    if (!set) return
    const key = gridKey(x, y, z)
    const idx = set.grids.get(key)
    if (idx === undefined) return
    set.grids.delete(key)
    set.free.push(idx)
    // 标记空位：缩到 0
    dummy.position.set(x + 0.5, y + 0.5, z + 0.5)
    dummy.scale.setScalar(0)
    dummy.updateMatrix()
    set.mesh.setMatrixAt(idx, dummy.matrix)
    dummy.scale.setScalar(1)
    set.mesh.instanceMatrix.needsUpdate = true
  }

  const removeTree = (g: THREE.Group) => {
    scene.remove(g)
    const i = treeGroups.indexOf(g)
    if (i >= 0) treeGroups.splice(i, 1)
  }

  // 射线命中：placed 方块 + 树
  const raycast = () => {
    raycaster.setFromCamera(rayOrigin, camera)
    raycaster.far = PICK_DIST
    const meshes: THREE.Object3D[] = []
    for (const set of sets.values()) if (set.count > 0) meshes.push(set.mesh)
    for (const g of treeGroups) meshes.push(...g.children)
    if (meshes.length === 0) return null
    const hits = raycaster.intersectObjects(meshes, false)
    if (hits.length === 0) return null
    const hit = hits[0]
    const dist = hit.distance
    // 树？
    const tree = treeGroups.find((g) => g.children.includes(hit.object))
    if (tree) {
      return {
        point: hit.point.clone(),
        normal: (hit.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone(),
        kind: 'tree' as const,
        target: tree,
        dist,
      }
    }
    // placed 方块：找所属 set + 网格坐标
    for (const [tid, set] of sets) {
      if (hit.object === set.mesh && hit.instanceId !== undefined) {
        set.mesh.getMatrixAt(hit.instanceId, m4)
        m4.decompose(dummy.position, dummy.quaternion, dummy.scale)
        const gx = Math.floor(dummy.position.x)
        const gy = Math.floor(dummy.position.y)
        const gz = Math.floor(dummy.position.z)
        // 通过 grid 反查类型确认（scale=0 的空位不会命中，因为 count 不含它们）
        const key = gridKey(gx, gy, gz)
        if (!set.grids.has(key)) continue
        return {
          point: hit.point.clone(),
          normal: (hit.face?.normal ?? new THREE.Vector3(0, 1, 0)).clone(),
          kind: 'block' as const,
          target: { type: tid, x: gx, y: gy, z: gz },
          dist,
        }
      }
    }
    return null
  }

  const keyOfTarget = (hit: NonNullable<ReturnType<typeof raycast>>) => {
    if (hit.kind === 'tree') return 'tree'
    const t = hit.target as { x: number; y: number; z: number }
    return `${t.x},${t.y},${t.z}`
  }

  let hoverKey = ''
  let selected = 1

  const update = (dt: number) => {
    // 粒子推进
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i]
      p.life += dt
      p.vel.y -= 9.8 * dt
      p.sprite.position.addScaledVector(p.vel, dt)
      const t = 1 - p.life / p.max
      ;(p.sprite.material as THREE.SpriteMaterial).opacity = Math.max(0, t)
      if (p.life >= p.max) {
        scene.remove(p.sprite)
        p.sprite.material.dispose()
        particles.splice(i, 1)
      }
    }
    // 悬停高亮（简化：无）
    const hit = raycast()
    const k = hit ? keyOfTarget(hit) : ''
    void hoverKey
    hoverKey = k
  }

  /** 左键挖掘 / 右键放置，由 game 调用 */
  const mine = () => {
    const hit = raycast()
    if (!hit) return
    if (hit.kind === 'tree') {
      const t = hit.target as THREE.Group
      spawnParticles(hit.point, hit.normal, 0x3e8e41, 10)
      removeTree(t)
      return
    }
    const bt = hit.target as { type: number; x: number; y: number; z: number }
    const btDef = BLOCK_TYPES.find((b) => b.id === bt.type)
    spawnParticles(hit.point, hit.normal, btDef?.color ?? 0x888888, 8)
    removeBlock(bt.type, bt.x, bt.y, bt.z)
  }

  const place = () => {
    const hit = raycast()
    if (!hit) return
    const n = hit.normal
    const px = Math.round(hit.point.x + n.x * 0.55)
    const py = Math.round(hit.point.y + n.y * 0.55)
    const pz = Math.round(hit.point.z + n.z * 0.55)
    // 各类型格不可重复
    for (const set of sets.values()) {
      if (set.grids.has(gridKey(px, py, pz))) return
    }
    // 玩家出生区保护
    if (Math.abs(px - 3) < 2 && Math.abs(pz - 2) < 2 && py < 2) return
    placeBlock(selected, px, py, pz)
    spawnParticles(hit.point, n, BLOCK_TYPES.find((b) => b.id === selected)?.color ?? 0xffffff, 4)
  }

  const getBlockAt = (x: number, y: number, z: number): number => {
    for (const [tid, set] of sets) {
      if (set.grids.has(gridKey(Math.floor(x), Math.floor(y), Math.floor(z)))) return tid
    }
    return 0
  }

  return {
    selected,
    raycast,
    update,
    mine,
    place,
    dispose: () => {},
    getBlockAt,
  }
}
