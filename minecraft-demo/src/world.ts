/* 体素世界：场景 / 地形 / 光照 / 云 / 相机控制 */
import * as THREE from 'three'
import { OrbitControls } from 'three/addons/controls/OrbitControls.js'

export interface World {
  scene: THREE.Scene
  camera: THREE.PerspectiveCamera
  renderer: THREE.WebGLRenderer
  controls: OrbitControls
  clouds: THREE.Mesh[]
  ground: THREE.Mesh
}

export function createWorld(container: HTMLElement): World {
  const scene = new THREE.Scene()
  scene.background = new THREE.Color(0x87c8ee)
  scene.fog = new THREE.Fog(0x87c8ee, 55, 130)

  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 200)
  camera.position.set(11, 9, 13)

  const renderer = new THREE.WebGLRenderer({ antialias: true })
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2))
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  container.appendChild(renderer.domElement)

  // 光照
  const hemi = new THREE.HemisphereLight(0xbfe3ff, 0x6fae4f, 0.75)
  scene.add(hemi)
  const sun = new THREE.DirectionalLight(0xfff4d6, 1.6)
  sun.position.set(10, 16, 8)
  sun.castShadow = true
  sun.shadow.mapSize.set(1024, 1024)
  sun.shadow.camera.left = -14
  sun.shadow.camera.right = 14
  sun.shadow.camera.top = 14
  sun.shadow.camera.bottom = -14
  scene.add(sun)

  // 地形：草地块（顶绿 / 侧棕）
  const geo = new THREE.BoxGeometry(64, 1, 64)
  const mats = [
    new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), // +x 侧
    new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), // -x
    new THREE.MeshLambertMaterial({ color: 0x7cc44a }), // 顶
    new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), // 底
    new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), // +z 侧
    new THREE.MeshLambertMaterial({ color: 0x8a5a33 }), // -z
  ]
  const ground = new THREE.Mesh(geo, mats)
  ground.position.y = -0.5
  ground.receiveShadow = true
  scene.add(ground)

  // 远景：太阳 / 方块山 / 树（fog 自然淡出）
  generateScenery(scene)

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
  controls.maxDistance = 32
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

  return { scene, camera, renderer, controls, clouds, ground }
}

/* ── 程序化远景：太阳 / 方块山 / 树（Minecraft 方块感，fog 淡出） ── */
function generateScenery(scene: THREE.Scene) {
  // 太阳：远处发光方块
  const sun = new THREE.Mesh(
    new THREE.BoxGeometry(3.2, 3.2, 0.6),
    new THREE.MeshBasicMaterial({ color: 0xffe066 }),
  )
  sun.position.set(-34, 24, -58)
  sun.frustumCulled = false
  scene.add(sun)

  // 方块山：错落大块堆叠
  const mountainMats = [
    new THREE.MeshLambertMaterial({ color: 0x7c8f6e }), // 中
    new THREE.MeshLambertMaterial({ color: 0x64765a }), // 深
    new THREE.MeshLambertMaterial({ color: 0xe8e8dc }), // 雪顶
  ]
  const addMountain = (cx: number, cz: number, seed: number) => {
    const stack = [
      { s: [7, 2.6, 7], y: 1.3, m: seed % 2 },
      { s: [5.4, 2.2, 5.4], y: 3.6, m: seed % 2 },
      { s: [3.6, 2, 3.6], y: 5.5, m: (seed + 1) % 2 },
      { s: [2.4, 1.6, 2.4], y: 7.1, m: 0 },
      { s: [1.5, 0.9, 1.5], y: 8.3, m: 2 }, // 雪顶
    ]
    for (const s of stack) {
      const m = new THREE.Mesh(
        new THREE.BoxGeometry(s.s[0], s.s[1], s.s[2]),
        mountainMats[s.m],
      )
      m.position.set(cx + (seed % 3 - 1) * 1.2, s.y, cz + ((seed >> 1) % 3 - 1) * 1.1)
      scene.add(m)
    }
  }
  addMountain(-32, -34, 1)
  addMountain(30, -42, 4)
  addMountain(-38, 30, 2)
  addMountain(42, 26, 5)

  // 方块树：远处随机散布
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x6b4a2b })
  const leafMat = new THREE.MeshLambertMaterial({ color: 0x3e8e41 })
  const trees: [number, number][] = [
    [-18, -22], [-10, -28], [22, -18], [16, -26], [-24, 18], [-14, 24], [20, 22], [28, 16], [0, -34], [-6, 32],
  ]
  for (const [tx, tz] of trees) {
    const trunk = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.8, 0.5), trunkMat)
    trunk.position.set(tx, 0.9, tz)
    const leaf = new THREE.Mesh(new THREE.BoxGeometry(1.8, 1.8, 1.8), leafMat)
    leaf.position.set(tx, 2.7, tz)
    scene.add(trunk, leaf)
  }
}
