/* 小房子体素蓝图：生成建造方块序列（含颜色与类别） */
import * as THREE from 'three'

export interface Block {
  x: number
  y: number
  z: number
  color: number
  kind: 'base' | 'wall' | 'door' | 'window' | 'roof'
}

const C = {
  base: 0x9c9c9c, // 灰石地基
  wall: 0xc98e4e, // 原木墙
  door: 0x8b5a2b, // 木门
  window: 0x8fd8ff, // 玻璃窗（半透明）
  roof: 0xb03a3a, // 红瓦顶
}

/** 房子占地 x∈[0,5] z∈[0,4]，门朝 -z（前墙 z=0） */
export function houseBlueprint(): Block[] {
  const blocks = new Map<string, Block>()
  const put = (x: number, y: number, z: number, kind: Block['kind']) => {
    const k = `${x},${y},${z}`
    if (!blocks.has(k)) blocks.set(k, { x, y, z, color: C[kind], kind })
  }

  // 地基 y=0
  for (let x = 0; x <= 5; x++) for (let z = 0; z <= 4; z++) put(x, 0, z, 'base')
  // 墙 y=1..3：后墙、侧墙、前墙（前墙留门洞 x=2,3 到 y=1）
  for (let y = 1; y <= 3; y++) {
    for (let x = 0; x <= 5; x++) {
      put(x, y, 4, 'wall') // 后墙
      if (y === 1 && (x === 2 || x === 3)) continue // 门洞
      if (y === 2 && (x === 1 || x === 4)) continue // 前墙窗洞
      put(x, y, 0, 'wall') // 前墙
    }
    for (let z = 1; z <= 3; z++) {
      put(0, y, z, 'wall')
      put(5, y, z, 'wall')
      if (y === 2 && (z === 1 || z === 3)) continue // 侧墙窗洞? 简化：不留侧窗
    }
  }
  // 门
  put(2, 0, 0, 'door')
  put(3, 0, 0, 'door')
  put(2, 1, 0, 'door')
  put(3, 1, 0, 'door')
  // 窗（前墙 y=2 x=1,4；后墙 y=2 x=1,4）
  put(1, 2, 0, 'window')
  put(4, 2, 0, 'window')
  put(1, 2, 4, 'window')
  put(4, 2, 4, 'window')
  // 屋顶：三层缩进
  for (let x = 0; x <= 5; x++) for (let z = 0; z <= 4; z++) put(x, 4, z, 'roof')
  for (let x = 1; x <= 4; x++) for (let z = 1; z <= 3; z++) put(x, 5, z, 'roof')
  for (let x = 2; x <= 3; x++) for (let z = 1; z <= 3; z++) put(x, 6, z, 'roof')
  for (let x = 2; x <= 3; x++) put(x, 7, 2, 'roof')

  // 建造顺序：地基 → 墙（逐层）→ 门/窗 → 屋顶（逐层）
  const order: Block['kind'][] = ['base', 'wall', 'door', 'window', 'roof']
  return Array.from(blocks.values()).sort((a, b) => {
    const ka = order.indexOf(a.kind)
    const kb = order.indexOf(b.kind)
    if (ka !== kb) return ka - kb
    if (a.kind === 'roof') return a.y - b.y || a.x - b.x
    if (a.kind === 'base') return a.z - b.z || a.x - b.x
    return a.y - b.y || a.z - b.z || a.x - b.x
  })
}

export function blockMesh(b: Block): THREE.Mesh {
  const geo = new THREE.BoxGeometry(1, 1, 1)
  const mat = new THREE.MeshLambertMaterial({
    color: b.color,
    transparent: b.kind === 'window',
    opacity: b.kind === 'window' ? 0.85 : 1,
  })
  const m = new THREE.Mesh(geo, mat)
  m.position.set(b.x + 0.5, b.y + 0.5, b.z + 0.5)
  m.castShadow = true
  m.receiveShadow = true
  return m
}
