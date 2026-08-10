/* 体素世界：场景 / 高度图地形 / 渐变天空 / 光照 / 云 / 相机控制 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'
import { ImprovedNoise } from 'three/addons/math/ImprovedNoise.js'

export interface World {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  clouds: THREE.Mesh[]
  terrain: THREE.Mesh
}

/* ── 渐变天空（官方 manual background.html shader 方案） ── */
function createSky(scene: THREE.Scene) {
  const skyGeo = new THREE.SphereGeometry(500, 32, 15)
  const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: {
      topColor: { value: new THREE.Color(0x3f7fd0) },
      bottomColor: { value: new THREE.Color(0xcfe8f5) },
      offset: { value: 40 },
      exponent: { value: 0.55 },
    },
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
  const sky = new THREE.Mesh(skyGeo, skyMat)
  scene.add(sky)
  return 0xcfe8f5 // 天空底部色（供 fog 同色，地平线无缝）
}

/* ── 高度图地形：中心平地 → 丘陵 → 远山（fbm 噪声 + 距离衰减 + 分带着色） ── */
function createTerrain(scene: THREE.Scene): THREE.Mesh {
  const SIZE = 320
  const SEG = 128
  const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG)
  geo.rotateX(-Math.PI / 2)
  const pos = geo.attributes.position as THREE.BufferAttribute
  const perlin = new ImprovedNoise()

  const colSand = new THREE.Color(0xd9c08a)
  const colGrass = new THREE.Color(0x79b84e)
  const colStone = new THREE.Color(0x8a8a80)
  const colSnow = new THREE.Color(0xf2f2ea)
  const colors: number[] = []

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z)
    let h: number
    if (r < 22) {
      h = -0.5 // 中心下挖：方块地皮（顶面 y=0）嵌进坑里，避免共面 z-fighting
    } else if (r < 26) {
      h = -0.5 + ((r - 22) / 4) * 0.5 // 过渡坡
    } else {
      const t = Math.min(1, (r - 26) / 42)
      const f = t * t * (3 - 2 * t) // smoothstep
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
      h = f * (6 + (sum / norm) * 28) // 远山 6~34
    }
    pos.setY(i, h)
    const c = h < 1 ? colSand : h < 3 ? colGrass : h < 8 ? colStone : colSnow
    colors.push(c.r, c.g, c.b)
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()

  const terrain = new THREE.Mesh(
    geo,
    new THREE.MeshLambertMaterial({ vertexColors: true }),
  )
  terrain.receiveShadow = true
  scene.add(terrain)
  return terrain
}

/* ── 近景方块地皮：房子周围 24×24 柱式草地（Minecraft 质感） ── */
function createVoxelGround(scene: THREE.Scene) {
  const N = 24
  const OX = -9 // x 从 -9..14（房子 x 0.5..5.5 在内）
  const OZ = -10 // z 从 -10..13
  const count = N * N
  const sideGeo = new THREE.BoxGeometry(1, 0.5, 1)
  const topGeo = new THREE.BoxGeometry(1, 0.14, 1)
  // 注意：不能用 vertexColors:true（会吞掉 instanceColor 导致黑色）；默认白色材质 × instanceColor
  const sideMat = new THREE.MeshLambertMaterial()
  const topMat = new THREE.MeshLambertMaterial()
  const sides = new THREE.InstancedMesh(sideGeo, sideMat, count)
  const tops = new THREE.InstancedMesh(topGeo, topMat, count)
  const cSide = new THREE.Color()
  const cTop = new THREE.Color()
  const m = new THREE.Matrix4()
  let k = 0
  for (let j = 0; j < N; j++) {
    for (let i = 0; i < N; i++) {
      const bx = OX + i
      const bz = OZ + j
      m.makeTranslation(bx, -0.25, bz)
      sides.setMatrixAt(k, m)
      // 侧面色抖动
      const sd = 0.92 + ((i * 7 + j * 13) % 11) * 0.015
      cSide.setRGB(0.54 * sd, 0.35 * sd, 0.2 * sd)
      sides.setColorAt(k, cSide)
      m.makeTranslation(bx, 0, bz)
      tops.setMatrixAt(k, m)
      const td = 0.92 + ((i * 11 + j * 5) % 9) * 0.018
      cTop.setRGB(0.486 * td, 0.769 * td, 0.29 * td)
      tops.setColorAt(k, cTop)
      k++
    }
  }
  sides.instanceMatrix.needsUpdate = true
  tops.instanceMatrix.needsUpdate = true
  if (sides.instanceColor) sides.instanceColor.needsUpdate = true
  if (tops.instanceColor) tops.instanceColor.needsUpdate = true
  sides.receiveShadow = true
  tops.receiveShadow = true
  scene.add(sides, tops)
}

/* ── 方块树 ── */
function createTrees(scene: THREE.Scene) {
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b })
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3e8e41 })
  const trees: [number, number][] = [
    [-12, -14], [-6, -18], [14, -12], [10, -18], [-16, 10], [-9, 15], [13, 13], [18, 8],
  ]
  for (const [tx, tz] of trees) {
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), trunkMat)
    trunk.position.set(tx, 0.9, tz)
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), leafMat)
    leaf.position.set(tx, 2.7, tz)
    trunk.castShadow = true
    scene.add(trunk, leaf)
  }
}

export function createWorld(container: HTMLElement): World {
  const scene = new THREE.Scene()
  scene.background = null // 天空球作背景

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1200)
  camera.position.set(11, 9, 13)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  // 光照
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6fae4f, 0.8)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.7)
  sun.position.set(10, 16, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -14
  sun.shadow.camera.right = 14
  sun.shadow.camera.top = 14
  sun.shadow.camera.bottom = -14
  scene.add(sun)

  // 渐变天空 + 指数雾（同色 → 地平线无缝）
  const fogColor = createSky(scene)
  scene.fog = new THREE.FogExp2(fogColor, 0.0016)

  // 地形与装饰
  const terrain = createTerrain(scene)
  createVoxelGround(scene)
  createTrees(scene)

  // 方块太阳（不受雾影响，位置对齐方向光）
  const sunDisc = new THREE.Mesh(
    new THREE.BoxGeometry(3.4, 3.4, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffe066, fog: false }),
  )
  sunDisc.position.set(30, 46, 24)
  sunDisc.frustumCulled = false
  scene.add(sunDisc)

  // 云：白方块
  const clouds: THREE.Mesh[] = []
  const cloudGeo = new THREE.BoxGeometry(3.4, 0.5, 1.8)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  for (let i = 0; i < 5; i++) {
    const c = new THREE.Mesh(cloudGeo, cloudMat)
    c.position.set(-20 + i * 12, 11.5 + (i % 2) * 1.2, -10 + (i * 5) % 14)
    c.castShadow = false
    scene.add(c)
    clouds.push(c)
  }

  // 相机控制：慢速自动环绕，用户交互后停止自动旋转
  const controls = new OrbitControls(camera, renderer.domElement)
  controls.target.set(0, 2.2, 0)
  controls.enableDamping = true
  controls.dampingFactor = 0.08
  controls.autoRotate = true
  controls.autoRotateSpeed = 0.8
  controls.maxPolarAngle = Math.PI / 2.05
  controls.minDistance = 4
  controls.maxDistance = 60
  controls.addEventListener('start', () => {
    controls.autoRotate = false
  })

  const resize = () => {
    const w = container.clientWidth || 1
    const h = container.clientHeight || 1
    camera.aspect = w / h
    camera.updateProjectionMatrix()
    renderer.setSize(w, h)
  }
  resize()
  window.addEventListener('resize', resize)

  return { scene, camera, renderer, controls, clouds, terrain }
}
