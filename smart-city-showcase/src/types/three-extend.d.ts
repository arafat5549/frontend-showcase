/**
 * 原型用途：智慧城市数据大屏 —— 声明 R3F 自定义 JSX 元素类型。
 * drei 10.x 的 <Effects> 基于 three-stdlib 的 EffectComposer，
 * 子级 pass 通过 R3F 的 extend() 注册（运行时）与 ThreeElements 增强（类型）。
 */
import type { ThreeElement } from '@react-three/fiber'
import type { UnrealBloomPass } from 'three-stdlib'

declare module '@react-three/fiber' {
  interface ThreeElements {
    unrealBloomPass: ThreeElement<typeof UnrealBloomPass>
  }
}

export {}
