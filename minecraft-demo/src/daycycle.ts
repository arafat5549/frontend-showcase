/* 昼夜循环：时段驱动 光照/天空/fog/太阳月亮 插值（简化版，无贴图） */
import * as THREE from 'three'

export interface DayState {
  timeOfDay: number // 0..1
  label: string
  sunPos: THREE.Vector3
  moonPos: THREE.Vector3
}

interface Phase {
  label: string
  from: number
  to: number
  sunIntensity: number
  sunColor: string
  hemiIntensity: number
  hemiColor: string
  fogColor: string
  fogDensity: number
  skyTop: string
  skyBottom: string
}

const PHASES: Phase[] = [
  { label: '日出', from: 0.04, to: 0.16, sunIntensity: 1.0, sunColor: '#ffd9a0', hemiIntensity: 0.55, hemiColor: '#c8a8c0', fogColor: '#d8b8a8', fogDensity: 0.0022, skyTop: '#5a6fb0', skyBottom: '#ffc98a' },
  { label: '上午', from: 0.16, to: 0.32, sunIntensity: 1.5, sunColor: '#fff4d6', hemiIntensity: 0.8, hemiColor: '#bfe3ff', fogColor: '#cfe8f5', fogDensity: 0.0016, skyTop: '#3f7fd0', skyBottom: '#cfe8f5' },
  { label: '正午', from: 0.32, to: 0.55, sunIntensity: 1.7, sunColor: '#ffffff', hemiIntensity: 0.9, hemiColor: '#cfeeff', fogColor: '#d2ecf8', fogDensity: 0.0014, skyTop: '#2f6fd0', skyBottom: '#d2ecf8' },
  { label: '黄昏', from: 0.55, to: 0.72, sunIntensity: 1.0, sunColor: '#ffb36b', hemiIntensity: 0.55, hemiColor: '#c8a8b8', fogColor: '#e8b890', fogDensity: 0.0026, skyTop: '#4a4a8a', skyBottom: '#ff9a5a' },
  { label: '夜晚', from: 0.72, to: 1.04, sunIntensity: 0.14, sunColor: '#5a6a9a', hemiIntensity: 0.32, hemiColor: '#2a3550', fogColor: '#16223a', fogDensity: 0.0045, skyTop: '#0a1030', skyBottom: '#1a2440' },
]

const smooth = (t: number) => t * t * (3 - 2 * t)
const clamp01 = (t: number) => Math.min(1, Math.max(0, t))

export function createDayCycle(
  opts: {
    fog: THREE.FogExp2
    sun: THREE.DirectionalLight
    hemi: THREE.HemisphereLight
    skyUniforms: Record<string, { value: THREE.Color | number }>
    sunDisc: THREE.Mesh
    moonDisc: THREE.Mesh
    dayDuration?: number
  },
): { state: DayState; update: (dt: number) => void } {
  const duration = opts.dayDuration ?? 120 // 演示一天 2 分钟
  const state: DayState = {
    timeOfDay: 0.3,
    label: '上午',
    sunPos: new THREE.Vector3(),
    moonPos: new THREE.Vector3(),
  }

  const lerpColor = (a: string, b: string, t: number) =>
    new THREE.Color(a).lerp(new THREE.Color(b), t)

  function phaseAt(t: number): { p: Phase; mix: number } {
    const tt = t % 1
    for (let i = 0; i < PHASES.length; i++) {
      const p = PHASES[i]
      if (tt >= p.from && tt < p.to) {
        const span = p.to - p.from
        return { p, mix: smooth(clamp01((tt - p.from) / span)) }
      }
    }
    // 0..0.04 属于夜晚（from 0.72..1.04 跨 0）
    const night = PHASES[4]
    return { p: night, mix: smooth(clamp01((tt + 1 - night.from) / (night.to - night.from))) }
  }

  const tmp = new THREE.Color()
  const tmp2 = new THREE.Color()

  const update = (dt: number) => {
    state.timeOfDay = (state.timeOfDay + dt / duration) % 1
    const t = state.timeOfDay
    const { p, mix } = phaseAt(t)
    state.label = p.label

    // 光照：当前段向下一段插值（mix 为段内进度，这里用段目标值的平滑）
    const pi = PHASES.indexOf(p)
    const next = PHASES[(pi + 1) % PHASES.length]
    const m = smooth(clamp01(mix))
    const sunCol = lerpColor(p.sunColor, next.sunColor, m)
    opts.sun.color.copy(sunCol)
    opts.sun.intensity = p.sunIntensity + (next.sunIntensity - p.sunIntensity) * m
    const hemiCol = lerpColor(p.hemiColor, next.hemiColor, m)
    opts.hemi.color.copy(hemiCol)
    opts.hemi.intensity = p.hemiIntensity + (next.hemiIntensity - p.hemiIntensity) * m

    // fog
    opts.fog.color.copy(lerpColor(p.fogColor, next.fogColor, m))
    opts.fog.density = p.fogDensity + (next.fogDensity - p.fogDensity) * m

    // 天空（渐变球 uniforms）
    ;(opts.skyUniforms.topColor.value as THREE.Color).copy(lerpColor(p.skyTop, next.skyTop, m))
    ;(opts.skyUniforms.bottomColor.value as THREE.Color).copy(lerpColor(p.skyBottom, next.skyBottom, m))

    // 太阳/月亮轨迹：白天 0.08..0.72 沿弧线，夜晚月亮在对面
    const dayT = clamp01((t - 0.08) / 0.64)
    const angle = dayT * Math.PI
    const sx = Math.cos(angle) * 90
    const sy = Math.max(Math.sin(angle) * 80, -6)
    state.sunPos.set(sx, sy, 0)
    opts.sun.position.copy(state.sunPos)
    opts.sunDisc.position.copy(state.sunPos)
    const nightT = clamp01((t - 0.74) / 0.24)
    const mAngle = nightT * Math.PI + Math.PI // 月亮在对面
    state.moonPos.set(Math.cos(mAngle) * 90, Math.max(Math.sin(mAngle) * 70, -4), 0)
    opts.moonDisc.position.copy(state.moonPos)
    // 月光亮度
    tmp.setHex(0xffffff)
    tmp2.copy(sunCol)
    tmp2.multiplyScalar(0.0001)
    void tmp
    void tmp2
  }

  return { state, update }
}
