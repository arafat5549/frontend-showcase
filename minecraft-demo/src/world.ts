/* 体素世界 v3：中心体素柱地形（群系着色/水/沙滩，复刻 TPMC 地图构成）+ 外圈高度图远景 + 昼夜 */
import * as THREE from 'three'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'

export interface World {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  clouds: THREE.Mesh[]
  terrain: THREE.Mesh
  sun: THREE.DirectionalLight
  hemi: THREE.HemisphereLight
  fog: THREE.FogExp2
  skyUniforms: Record<string, { value: THREE.Color | number }>
  sunDisc: THREE.Mesh
  moonDisc: THREE.Mesh
  treeGroups: THREE.Group[]
  /** 地形高度（体素柱/高度图），世界坐标 → 高度 */
  getTerrainHeight: (x: number, z: number) => number
  /** 群系名查询 */
  getBiomeName: (x: number, z: number) => string
  /** 出生点 */
  spawn: THREE.Vector3
}

/* ══════════ 群系（复刻 TPMC 气候表，简化为 4 类） ══════════ */
const BIOMES = [
  { name: '平原', temp: 0.45, hum: 0.4, hMag: 4, surface: 0x7cc44a, subsurface: 0x8a5a33 },
  { name: '森林', temp: 0.45, hum: 0.78, hMag: 5.5, surface: 0x4e8a3a, subsurface: 0x6b4a2b },
  { name: '沙漠', temp: 0.78, hum: 0.25, hMag: 3, surface: 0xd9c08a, subsurface: 0xc2a86a },
  { name: '雪山', temp: 0.2, hum: 0.5, hMag: 8, surface: 0xf2f2ea, subsurface: 0x8a8a80 },
]

const perlin = new ImprovedNoise()

/** 群系权重（温度/湿度双噪声） */
function biomeAt(x: number, z: number): { w: number[]; wSum: number; best: number } {
  const temp = perlin.noise(x / 180, z / 180, 0.5) * 0.5 + 0.5
  const hum = perlin.noise(x / 180 + 100, z / 180 + 100, 0.5) * 0.5 + 0.5
  const w = BIOMES.map((b) => 1 / (Math.hypot(temp - b.temp, hum - b.hum) + 0.06))
  const wSum = w.reduce((a, b) => a + b, 0)
  let best = 0
  for (let i = 1; i < w.length; i++) if (w[i] > w[best]) best = i
  return { w, wSum, best }
}

export function getBiomeNameAt(x: number, z: number): string {
  return BIOMES[biomeAt(x, z).best].name
}

const fbm = (x: number, z: number) => {
  let amp = 1
  let freq = 0.02
  let sum = 0
  let norm = 0
  for (let o = 0; o < 4; o++) {
    sum += Math.abs(perlin.noise(x * freq, z * freq, 0.5)) * amp
    norm += amp
    amp *= 0.55
    freq *= 2.1
  }
  return sum / norm
}

/* ══════════ 渐变天空（官方 manual background.html shader 方案） ══════════ */
function createSky(scene: THREE.Scene): Record<string, { value: THREE.Color | number }> {
  const uniforms = {
    topColor: { value: new THREE.Color(0x3f7fd0) },
    bottomColor: { value: new THREE.Color(0xcfe8f5) },
    offset: { value: 40 },
    exponent: { value: 0.55 },
  }
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vWorldPosition = wp.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float offset;
      uniform float exponent;
      varying vec3 vWorldPosition;
      void main() {
        float h = normalize(vWorldPosition + offset).y;
        gl_FragColor = vec4(mix(bottomColor, topColor, max(pow(max(h, 0.0), exponent), 0.0)), 1.0);
      }`,
  })
  scene.add(new THREE.Mesh(new THREE.SphereGeometry(500, 32, 15), skyMat))
  return uniforms
}

/* ══════════ 中心体素柱地形（96×96）：群系表面着色 + 水 + 沙滩 + 出生平台 ══════════ */
const TILE = 96 // 柱地形边长（格）
const TH = 48 // 半边长
const WATER_LEVEL = 0.3

interface VoxelTerrain {
  mesh: THREE.Mesh
  getHeight: (x: number, z: number) => number
}

function createVoxelTerrain(scene: THREE.Scene): VoxelTerrain {
  const count = TILE * TILE
  const heights = new Float32Array(count)
  const isWater = new Uint8Array(count)
  const surfColor = new Float32Array(count * 3)

  const cSide = new THREE.Color()
  const cTop = new THREE.Color()

  for (let gz = 0; gz < TILE; gz++) {
    for (let gx = 0; gx < TILE; gx++) {
      const wx = gx - TH + 0.5
      const wz = gz - TH + 0.5
      const i = gz * TILE + gx
      // 出生平台：|wx|<=12 && |wz|<=12 → 平地草地
      let h: number
      if (Math.abs(wx) <= 12 && Math.abs(wz) <= 12) {
        h = 0
      } else {
        const { w, wSum, best } = biomeAt(wx, wz)
        let hMag = 0
        for (let b = 0; b < BIOMES.length; b++) hMag += (w[b] / wSum) * BIOMES[b].hMag
        h = 0.4 + fbm(wx, wz) * 3.6 + hMag * 0.55
        if (h > 8) h = 8
        // 水面：低洼淹水
        if (h < WATER_LEVEL) {
          isWater[i] = 1
          h = WATER_LEVEL
        }
        // 表面色：沙滩优先（水边 + 低地），否则群系表面
        if (h < 0.8) {
          const bi = BIOMES[best]
          if (isWater[i] || bi.name === '沙漠') cTop.setHex(0xd9c08a)
          else cTop.setHex(0xd9c08a) // 低洼湿地 → 沙色
        } else if (h > 7 && w[3] / wSum > 0.5) {
          cTop.setHex(BIOMES[3].surface)
        } else {
          cTop.setHex(BIOMES[best].surface)
        }
      }
      if (!isWater[i]) {
        // 非水格重新着色（平台/一般格）
        if (Math.abs(wx) <= 12 && Math.abs(wz) <= 12) {
          cTop.setHex(0x7cc44a)
        } else if (h >= 0.8) {
          const { w, wSum, best } = biomeAt(wx, wz)
          if (h > 7 && w[3] / wSum > 0.5) cTop.setHex(BIOMES[3].surface)
          else cTop.setHex(BIOMES[best].surface)
        }
      }
      heights[i] = h
      surfColor[i * 3] = cTop.r
      surfColor[i * 3 + 1] = cTop.g
      surfColor[i * 3 + 2] = cTop.b
    }
  }

  // 渲染：侧柱 + 顶片 + 水面（三个 InstancedMesh）
  const sideGeo = new THREE.BoxGeometry(1, 1, 1)
  const topGeo = new THREE.BoxGeometry(1, 0.14, 1)
  const waterGeo = new THREE.BoxGeometry(1, 0.08, 1)
  const sideMat = new THREE.MeshLambertMaterial()
  const topMat = new THREE.MeshLambertMaterial({ vertexColors: false })
  const waterMat = new THREE.MeshLambertMaterial({
    color: 0x4aa8e8,
    transparent: true,
    opacity: 0.72,
  })
  const sides = new THREE.InstancedMesh(sideGeo, sideMat, count)
  const tops = new THREE.InstancedMesh(topGeo, topMat, count)
  const waters = new THREE.InstancedMesh(waterGeo, waterMat, count)
  const m = new THREE.Matrix4()
  let waterN = 0

  for (let gz = 0; gz < TILE; gz++) {
    for (let gx = 0; gx < TILE; gx++) {
      const i = gz * TILE + gx
      const wx = gx - TH + 0.5
      const wz = gz - TH + 0.5
      const h = heights[i]
      // 侧柱
      m.makeScale(1, Math.max(h, 0.06), 1)
      m.setPosition(wx, h / 2, wz)
      sides.setMatrixAt(i, m)
      const sd = 0.94 + ((gx * 7 + gz * 13) % 11) * 0.012
      const { best } = biomeAt(wx, wz)
      let sub = BIOMES[best].subsurface
      if (h < 0.8) sub = 0xc2a86a // 沙滩底
      if (isWater[i]) sub = 0x8a7a5a // 水下泥土
      cSide.setHex(sub).multiplyScalar(sd)
      sides.setColorAt(i, cSide)
      // 顶片
      m.makeScale(1.02, 1, 1.02)
      m.setPosition(wx, h, wz)
      tops.setMatrixAt(i, m)
      cTop.setRGB(surfColor[i * 3], surfColor[i * 3 + 1], surfColor[i * 3 + 2])
      const td = 0.93 + ((gx * 11 + gz * 5) % 9) * 0.015
      cTop.multiplyScalar(td)
      tops.setColorAt(i, cTop)
      // 水面
      if (isWater[i]) {
        m.makeScale(1.02, 1, 1.02)
        m.setPosition(wx, WATER_LEVEL + 0.02, wz)
        waters.setMatrixAt(waterN, m)
        waterN++
      }
    }
  }
  sides.instanceMatrix.needsUpdate = true
  tops.instanceMatrix.needsUpdate = true
  waters.count = waterN
  waters.instanceMatrix.needsUpdate = true
  if (sides.instanceColor) sides.instanceColor.needsUpdate = true
  if (tops.instanceColor) tops.instanceColor.needsUpdate = true
  sides.receiveShadow = true
  tops.receiveShadow = true

  const holder = new THREE.Group()
  holder.add(sides, tops, waters)
  scene.add(holder)

  // 高度查询：最近格
  const getHeight = (x: number, z: number): number => {
    const gx = Math.floor(x + TH)
    const gz = Math.floor(z + TH)
    if (gx < 0 || gx >= TILE || gz < 0 || gz >= TILE) return -100
    return heights[gz * TILE + gx]
  }

  return { mesh: holder as unknown as THREE.Mesh, getHeight }
}

/* ══════════ 外圈高度图远景（平滑远山） ══════════ */
function createFarTerrain(scene: THREE.Scene): (x: number, z: number) => number {
  const SIZE = 320
  const SEG = 128
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const heights = new Float32Array(pos.count)
  const colors: number[] = []
  const colG = new THREE.Color(0x79b84e)
  const colS = new THREE.Color(0x8a8a80)
  const colW = new THREE.Color(0xf2f2ea)
  const c = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    let h = 0
    if (r > 24) {
      const t = Math.min(1, (r - 24) / 42)
      const f = t * t * (3 - 2 * t)
      h = f * (6 + fbm(x, z) * 26)
    }
    heights[i] = h
    pos.setY(i, h)
    if (h < 2) c.copy(colG)
    else if (h < 8) c.copy(colS)
    else c.copy(colW)
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  const terrain = new THREE.Mesh(geo, new THREE.MeshLambertMaterial({ vertexColors: true }))
  terrain.receiveShadow = true
  scene.add(terrain)

  const step = SIZE / SEG
  return (x, z) => {
    const gx = (x + SIZE / 2) / step
    const gz = (z + SIZE / 2) / step
    const x0 = Math.floor(gx)
    const z0 = Math.floor(gz)
    const x1 = Math.min(x0 + 1, SEG)
    const z1 = Math.min(z0 + 1, SEG)
    const fx = gx - x0
    const fz = gz - z0
    const at = (ix: number, iz: number) => {
      const j = iz * (SEG + 1) + ix
      return j >= 0 && j < heights.length ? heights[j] : 0
    }
    const h00 = at(x0, z0)
    const h10 = at(x1, z0)
    const h01 = at(x0, z1)
    const h11 = at(x1, z1)
    return (h00 * (1 - fx) + h10 * fx) * (1 - fz) + (h01 * (1 - fx) + h11 * fx) * fz
  }
}

/* ══════════ 群系植被：树（森林密/平原疏）+ 仙人掌（沙漠） ══════════ */
function createVegetation(scene: THREE.Scene, heightFn: (x: number, z: number) => number): THREE.Group[] {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b })
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3e8e41 })
  const leafMat2 = new THREE.MeshLambertMaterial({ color: 0x2f7a35 })
  const cactusMat = new THREE.MeshLambertMaterial({ color: 0x3e8e41 })
  const treeGroups: THREE.Group[] = []

  const seeded = (i: number) => {
    let x = Math.sin(i * 127.1) * 43758.5453
    return x - Math.floor(x)
  }

  let n = 0
  for (let gx = -28; gx <= 28; gx++) {
    for (let gz = -28; gz <= 28; gz++) {
      const wx = gx * 6
      const wz = gz * 6
      const r = Math.hypot(wx, wz)
      if (r < 20) continue // 出生平台附近不种
      const rnd = seeded(n++)
      const bio = getBiomeNameAt(wx, wz)
      const prob = bio === '森林' ? 0.85 : bio === '平原' ? 0.3 : bio === '雪山' ? 0.12 : 0
      if (rnd > prob) continue
      const h = 1.6 + seeded(n++) * 1.2
      const g = new THREE.Group()
      const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.5, h, 0.5), trunkMat)
      trunk.position.y = h / 2
      const crown = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), seeded(n) > 0.5 ? leafMat : leafMat2)
      crown.position.y = h + 0.9
      g.add(trunk, crown)
      g.position.set(wx, heightFn(wx, wz), wz)
      scene.add(g)
      treeGroups.push(g)
    }
  }
  let m = 0
  for (let gx = -28; gx <= 28; gx++) {
    for (let gz = -28; gz <= 28; gz++) {
      const wx = gx * 6
      const wz = gz * 6
      const r = Math.hypot(wx, wz)
      if (r < 20) continue
      if (getBiomeNameAt(wx, wz) !== '沙漠') continue
      if (seeded(m++) > 0.25) continue
      const g = new THREE.Group()
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.8 + seeded(m++) * 1.2, 0.6), cactusMat)
      body.position.y = 1
      g.add(body)
      g.position.set(wx, heightFn(wx, wz), wz)
      scene.add(g)
      treeGroups.push(g)
    }
  }
  return treeGroups
}

/* ══════════ 主世界创建 ══════════ */
export function createWorld(container: HTMLElement): World {
  const scene = new THREE.Scene()
  scene.background = null

  const camera = new THREE.PerspectiveCamera(65, 1, 0.1, 1200)
  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6fae4f, 0.8)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.6)
  sun.position.set(30, 50, 20)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -20
  sun.shadow.camera.right = 20
  sun.shadow.camera.top = 20
  sun.shadow.camera.bottom = -20
  sun.target.position.set(0, 0, 0)
  scene.add(sun)
  scene.add(sun.target)

  // 天空 + 雾
  const skyUniforms = createSky(scene)
  const fog = new THREE.FogExp2(0xcfe8f5, 0.0016)
  scene.fog = fog

  // 地形：中心体素柱 + 外圈高度图远景
  const voxel = createVoxelTerrain(scene)
  const farHeight = createFarTerrain(scene)
  const getTerrainHeight = (x: number, z: number): number => {
    const vh = voxel.getHeight(x, z)
    return vh > -100 ? vh : farHeight(x, z)
  }

  // 植被
  const treeGroups = createVegetation(scene, getTerrainHeight)

  // 太阳/月亮方块
  const sunDisc = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 3.2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false }),
  )
  sunDisc.frustumCulled = false
  const moonDisc = new THREE.Mesh(
    new THREE.BoxGeometry(2.6, 2.6, 0.5),
    new THREE.MeshBasicMaterial({ color: 0xd8e4f0, fog: false }),
  )
  moonDisc.frustumCulled = false
  scene.add(sunDisc, moonDisc)

  // 云
  const clouds: THREE.Mesh[] = []
  const cloudGeo = new THREE.BoxGeometry(3.4, 0.5, 1.8)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(cloudGeo, cloudMat)
    c.position.set(-20 + i * 12, 11.5 + (i % 2) * 1.2, -10 + (i * 5) % 14)
    scene.add(c)
    clouds.push(c)
  }

  const resize = () => {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  resize()
  window.addEventListener('resize', resize)

  return {
    scene,
    camera,
    renderer,
    clouds,
    terrain: voxel.mesh,
    sun,
    hemi,
    fog,
    skyUniforms,
    sunDisc,
    moonDisc,
    treeGroups,
    getTerrainHeight,
    getBiomeName: getBiomeNameAt,
    spawn: new THREE.Vector3(3, 0.1, 2),
  }
}
