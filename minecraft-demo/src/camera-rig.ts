/* 第三人称相机 rig：跟随玩家朝向的阻尼相机（参考 TPMC camera-rig 简化版） */
import * as THREE from 'three'

export interface CameraRig {
  update: (dt: number, playerPos: THREE.Vector3, facingAngle: number, mouseYOffset: number, zoom: number) => void
}

const damp = (cur: number, target: number, lambda: number, dt: number) =>
  cur + (target - cur) * (1 - Math.exp(-lambda * dt))

/** 相机位于玩家后上方 offset，注视玩家头部 + yOffset */
export function createCameraRig(camera: THREE.PerspectiveCamera): CameraRig {
  const baseOffset = new THREE.Vector3(0, 2.4, 3.6) // 相对玩家（朝向后方）
  const lookHeight = 1.5

  let smoothX = 0
  let smoothY = 0
  let smoothZ = 0

  return {
    update(dt, playerPos, facingAngle, mouseYOffset, zoom) {
      const off = baseOffset.clone().multiplyScalar(zoom)
      // 按朝向旋转偏移（相机在角色后方）
      const cos = Math.cos(facingAngle)
      const sin = Math.sin(facingAngle)
      const rx = off.x * cos + off.z * sin
      const rz = -off.x * sin + off.z * cos

      const tx = playerPos.x + rx
      const ty = playerPos.y + off.y
      const tz = playerPos.z + rz

      const lambda = 10
      smoothX = damp(smoothX, tx, lambda, dt)
      smoothY = damp(smoothY, ty, lambda, dt)
      smoothZ = damp(smoothZ, tz, lambda, dt)

      camera.position.set(smoothX, smoothY, smoothZ)
      camera.lookAt(playerPos.x, playerPos.y + lookHeight + mouseYOffset, playerPos.z)
    },
  }
}
