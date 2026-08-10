/* 人物建模复刻：TPMC（Third-Person-MC）steve.glb 皮肤模型
 * - AnimationMixer 权重混合：idle / forward(行走) / running_forward(奔跑) / jump
 * - 材质 emissiveMap=map + intensity 0.3（夜晚可见，参考 TPMC）
 * - 加载失败回退程序化方块小人
 * 模型来源：https://github.com/hexianWeb/Third-Person-MC（皮肤来自 planetminecraft，仅供学习演示）
 */
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'

export interface PlayerState {
  moving: boolean
  running: boolean
  grounded: boolean
}

export interface Player {
  group: THREE.Group
  update: (dt: number, s: PlayerState) => void
}

/* ══════════ 程序化贴图模型（无 GLB 时的 fallback）
 * MC 标准 Steve 模型（头 8×8×8 / 身 8×12×4 / 四肢 4×12×4，0.0625 单位/像素）
 * + 标准 64×64 皮肤 UV 映射 + Canvas 程序化皮肤贴图（像素风）
 * ══════════ */
const U = 0.0625 // MC 1 像素 = 1/16 单位

function applySkinUV(geo: THREE.BoxGeometry, u: number, v: number, w: number, h: number) {
  // BoxGeometry 面顺序: +x(0) -x(1) +y(2) -y(3) +z(4) -z(5)；每面 4 顶点
  // MC 布局：右=u+2w, 左=u+3w, 前=u, 后=u+w, 顶=v+h, 底=v
  const uv = geo.attributes.uv as THREE.BufferAttribute
  const V = 64
  const setFace = (f: number, uf: number, vf: number, flip = false) => {
    const i = f * 4
    const du = w / V
    const dv = h / V
    const u0 = uf / V
    // three 纹理 flipY：v=0 对应图像顶部 → 用 v0 = 1 - vf/V - dv
    const v0 = 1 - vf / V - dv
    if (flip) {
      uv.setXY(i, u0 + du, v0 + dv)
      uv.setXY(i + 1, u0, v0 + dv)
      uv.setXY(i + 2, u0 + du, v0)
      uv.setXY(i + 3, u0, v0)
    } else {
      uv.setXY(i, u0, v0 + dv)
      uv.setXY(i + 1, u0 + du, v0 + dv)
      uv.setXY(i + 2, u0, v0)
      uv.setXY(i + 3, u0 + du, v0)
    }
  }
  setFace(4, u, v) // +z 前
  setFace(5, u + w, v, true) // -z 后
  setFace(0, u + 2 * w, v, true) // +x 右
  setFace(1, u + 3 * w, v) // -x 左
  setFace(2, u, v + h) // +y 顶
  setFace(3, u + w, v + h, true) // -y 底
}

/** Canvas 绘制 Steve 风皮肤贴图（64×64，MC 标准布局） */
function drawSteveSkin(): HTMLCanvasElement {
  const cv = document.createElement('canvas')
  cv.width = 64
  cv.height = 64
  const g = cv.getContext('2d')!
  const hair = '#593826'
  const skin = '#d8a06b'
  const shirt = '#1e9e5f'
  const shirtDark = '#16824e'
  const pants = '#3150b0'
  const pantsDark = '#27408c'
  const shoe = '#3a3a3a'
  const white = '#f5f5f5'
  const eye = '#3b6bd6'

  g.fillStyle = '#000'
  g.fillRect(0, 0, 64, 64) // 透明底
  g.clearRect(0, 0, 64, 64)
  const rect = (x: number, y: number, w: number, h: number, c: string) => {
    g.fillStyle = c
    g.fillRect(x, y, w, h)
  }

  // ── 头（8×8 区域）──
  rect(8, 0, 8, 8, hair) // 顶
  rect(16, 0, 8, 8, hair) // 底
  rect(0, 8, 8, 8, skin) // 右面
  rect(8, 8, 8, 8, skin) // 前面
  rect(16, 8, 8, 8, skin) // 左面
  rect(24, 8, 8, 8, hair) // 后面
  // 脸细节（前面 8,8）：刘海、眼、嘴
  rect(8, 8, 8, 3, hair)
  rect(9, 12, 2, 2, white) // 左眼白
  rect(13, 12, 2, 2, white) // 右眼白
  rect(10, 12, 1, 2, eye)
  rect(14, 12, 1, 2, eye)
  rect(10, 15, 4, 1, '#a0774f') // 嘴

  // ── 身体（8×12）──
  rect(20, 16, 8, 12, shirt) // 顶
  rect(28, 16, 8, 12, shirt) // 底
  rect(16, 20, 8, 12, shirtDark) // 右
  rect(20, 20, 8, 12, shirt) // 前
  rect(28, 20, 8, 12, shirtDark) // 左
  rect(32, 20, 8, 12, shirt) // 后
  rect(21, 20, 2, 2, shirtDark) // 领口
  rect(25, 20, 2, 2, shirtDark)

  // ── 腿（4×12）──
  rect(4, 16, 4, 12, pants) // 顶
  rect(8, 16, 4, 12, pants) // 底
  rect(0, 20, 4, 12, pantsDark) // 右
  rect(4, 20, 4, 12, pants) // 前
  rect(8, 20, 4, 12, pantsDark) // 左
  rect(12, 20, 4, 12, pants) // 后
  rect(4, 29, 4, 3, shoe) // 鞋（前）
  rect(0, 29, 4, 3, shoe)
  rect(8, 29, 4, 3, shoe)
  rect(12, 29, 4, 3, shoe)

  // ── 臂（4×12）──
  rect(44, 16, 4, 12, shirt) // 顶
  rect(48, 16, 4, 12, shirt) // 底
  rect(40, 20, 4, 12, shirtDark) // 右
  rect(44, 20, 4, 12, shirt) // 前
  rect(48, 20, 4, 12, shirtDark) // 左
  rect(52, 20, 4, 12, shirt) // 后
  rect(44, 28, 4, 4, skin) // 手
  rect(40, 28, 4, 4, skin)
  rect(48, 28, 4, 4, skin)
  rect(52, 28, 4, 4, skin)

  return cv
}

function createSkinPlayer(): Player {
  const group = new THREE.Group()
  // 皮肤纹理
  const tex = new THREE.CanvasTexture(drawSteveSkin())
  tex.magFilter = THREE.NearestFilter
  tex.minFilter = THREE.NearestFilter
  tex.colorSpace = THREE.SRGBColorSpace
  const mat = () => {
    const m = new THREE.MeshLambertMaterial({ map: tex })
    m.emissive = new THREE.Color(0xffffff)
    m.emissiveMap = tex
    m.emissiveIntensity = 0.3 // 夜间发光（同 GLB 处理）
    return m
  }

  // MC 标准部件（比例 0.0625/px）
  const addBox = (
    w: number, h: number, d: number,
    x: number, y: number,
    u: number, v: number, tw: number, th: number,
  ) => {
    const geo = new THREE.BoxGeometry(w * U, h * U, d * U)
    applySkinUV(geo, u, v, tw, th)
    const mesh = new THREE.Mesh(geo, mat())
    mesh.position.set(x, y, 0)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }

  const HEAD = 8
  const BODY = 12
  const LIMB = 12
  // 头
  addBox(HEAD, HEAD, HEAD, 0, 1.5 + HEAD * U / 2, 8, 8, HEAD, HEAD)
  // 身体
  addBox(8, BODY, 4, 0, 0.75 + BODY * U / 2, 20, 16, 8, BODY)
  // 腿（y 0..0.75）
  const legGeo = (side: number) => {
    const geo = new THREE.BoxGeometry(4 * U, LIMB * U, 4 * U)
    applySkinUV(geo, 4, 16, 4, LIMB)
    const mesh = new THREE.Mesh(geo, mat())
    mesh.position.set(side * 0.125, 0.75 / 2, 0)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }
  const legL = legGeo(-1)
  const legR = legGeo(1)
  // 臂（肩 y 0.75..1.5）
  const armGeo = (side: number) => {
    const geo = new THREE.BoxGeometry(4 * U, LIMB * U, 4 * U)
    applySkinUV(geo, 44, 16, 4, LIMB)
    const mesh = new THREE.Mesh(geo, mat())
    mesh.position.set(side * 0.375, 0.75 + LIMB * U / 2, 0)
    mesh.castShadow = true
    group.add(mesh)
    return mesh
  }
  const armL = armGeo(-1)
  const armR = armGeo(1)

  let walkPhase = 0
  const update = (dt: number, s: PlayerState) => {
    const swing = s.moving && s.grounded ? Math.sin(walkPhase) * 0.55 : 0
    legL.rotation.x = swing
    legR.rotation.x = -swing
    armL.rotation.x = s.moving && s.grounded ? -swing * 0.8 : 0
    armR.rotation.x = s.moving && s.grounded ? swing * 0.8 : 0
    if (s.moving && s.grounded) walkPhase += dt * (s.running ? 11 : 7)
    // 空中姿态：腿微张开
    if (!s.grounded) {
      legL.rotation.x = -0.5
      legR.rotation.x = 0.5
      armL.rotation.x = -0.9
      armR.rotation.x = -0.9
    }
  }
  return { group, update }
}

/* ══════════ GLTF 皮肤模型（主路径） ══════════ */
const CLIP_WEIGHT_LERP = 0.12

export const SKIN_LIST = [
  { id: 'steve', name: 'Steve', url: './models/character/steve.glb' },
  { id: 'alex', name: 'Alex', url: './models/character/alex.glb' },
  { id: 'player', name: 'Classic', url: './models/character/player.glb' },
] as const

export type SkinId = (typeof SKIN_LIST)[number]['id']

/** 裸模型加载：返回 group + mixer + actions（菜单预览与游戏共用） */
export async function loadModel(url: string) {
  const gltf = await new GLTFLoader().loadAsync(url)
  const model = gltf.scene

  // 缩放：模型高度 → 1.8（与方块世界 1:1）
  const box = new THREE.Box3().setFromObject(model)
  const h = box.max.y - box.min.y
  const scale = h > 0 ? 1.8 / h : 1
  model.scale.setScalar(scale)
  model.position.y = -box.min.y * scale
  // 模型朝向适配（参考 TPMC：模型正面与移动方向差 π）
  model.rotation.y = Math.PI
  model.traverse((o) => {
    const mesh = o as THREE.Mesh
    if (mesh.isMesh) {
      mesh.castShadow = true
      const m = mesh.material as THREE.MeshStandardMaterial
      if (m && m.map) {
        // 夜间发光：emissiveMap = 皮肤贴图（参考 TPMC emissiveIntensity 0.3）
        m.emissive = new THREE.Color(0xffffff)
        m.emissiveMap = m.map
        m.emissiveIntensity = 0.3
        m.needsUpdate = true
      }
    }
  })

  // 动画：按 clip 名建 actions
  const mixer = new THREE.AnimationMixer(model)
  const actions = new Map<string, THREE.AnimationAction>()
  for (const clip of gltf.animations) {
    const a = mixer.clipAction(clip)
    a.play()
    a.setEffectiveWeight(0)
    actions.set(clip.name, a)
  }
  return { group: model, mixer, actions }
}

/** 皮肤模型玩家（主路径）：idle/forward/running_forward/jump 权重混合 */
export async function createModelPlayer(
  scene: THREE.Scene,
  url = './models/character/steve.glb',
): Promise<Player> {
  const { group: model, mixer, actions } = await loadModel(url)
  scene.add(model)
  const has = (n: string) => actions.has(n)
  const w = (n: string, v: number) => {
    const a = actions.get(n)
    if (a) a.setEffectiveWeight(v)
  }

  const weights = { idle: 1, walk: 0, run: 0, jump: 0 }
  const jumpAction = actions.get('jump')
  let prevGrounded = true

  return {
    group: model,
    update(dt, s: PlayerState) {
      const justJumped = prevGrounded && !s.grounded
      prevGrounded = s.grounded
      const target = s.grounded
        ? s.moving
          ? s.running
            ? { idle: 0, walk: 0, run: 1, jump: 0 }
            : { idle: 0, walk: 1, run: 0, jump: 0 }
          : { idle: 1, walk: 0, run: 0, jump: 0 }
        : { idle: 0, walk: 0, run: 0, jump: 1 }
      if (justJumped && jumpAction) {
        // 起跳瞬间 reset 一次（LoopOnce 播完停在末帧，空中不再重置）
        jumpAction.reset().play()
      }
      if (s.grounded) {
        // 落地立即收尾：跳跃权重直接归零，其余按 lerp 过渡
        weights.jump = 0
        for (const k of ['idle', 'walk', 'run'] as const) {
          weights[k] += (target[k] - weights[k]) * CLIP_WEIGHT_LERP
        }
      } else {
        // 空中：快速切到跳跃
        weights.jump += (1 - weights.jump) * 0.35
        weights.idle = 0
        weights.walk = 0
        weights.run = 0
      }
      if (has('idle')) w('idle', weights.idle)
      if (has('forward')) w('forward', weights.walk)
      if (has('running_forward')) w('running_forward', weights.run)
      w('jump', weights.jump)
      mixer.update(dt)
    },
  }
}

/** 统一入口：优先皮肤模型（GLB），失败回退程序化贴图模型（MC 标准皮肤 UV） */
export async function createPlayer(scene: THREE.Scene, skin: SkinId = 'steve'): Promise<Player> {
  const def = SKIN_LIST.find((s) => s.id === skin) ?? SKIN_LIST[0]
  try {
    return await createModelPlayer(scene, def.url)
  } catch (e) {
    console.warn(`[player] ${def.url} 加载失败，回退程序化贴图模型：`, e)
    const p = createSkinPlayer()
    scene.add(p.group)
    return p
  }
}
