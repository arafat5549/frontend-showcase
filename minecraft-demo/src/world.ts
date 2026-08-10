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
  scene.background = new THREE.Color(0x7ec8f0)
  scene.fog = new THREE.Fog(0x7ec8f0, 45, 90)

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
  const geo = new THREE.BoxGeometry(24, 1, 24)
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

  // 云：白方块
  const clouds: THREE.Mesh[] = []
  const cloudGeo = new THREE.BoxGeometry(3.4, 0.5, 1.8)
  const cloudMat = new THREE.MeshLambertMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 })
  for (let i = 0; i < 4; i++) {
    const c = new THREE.Mesh(cloudGeo, cloudMat)
    c.position.set(-16 + i * 11, 11.5 + (i % 2) * 1.2, -8 + (i * 5) % 12)
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
