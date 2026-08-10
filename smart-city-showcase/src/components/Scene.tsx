/**
 * 原型用途：智慧城市数据大屏 —— 共享 3D 场景（三个变体复用）。
 * 含：区县挤出地图（hover 高亮 / 点击选中抬高变色）、飞线、粒子、地面网格、
 * 中文标签（drei Html，DOM 叠加）、辉光（drei 10.x <Effects> + three-stdlib UnrealBloomPass）、
 * OrbitControls 慢速自转。
 *
 * 色板设计意图（v2 降亮）：全区块/飞线/粒子/网格从高亮青降为暗青蓝阶（主色 #1ba8c4 量级），
 * hover 用 #46c8d8、选中用暖金 #e3ad52 作唯一高亮点缀；灯光整体降档，避免区块过曝发白。
 *
 * 性能取舍：hover/选中改增量顶点更新（只遍历涉及的区县区间，避免 17.7 万顶点全量重建）；
 * DPR 上限 1.5 + bloom 降分辨率（1024×576），降低高分屏全屏辉光开销。
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import * as THREE from 'three'
import { Canvas, extend, useFrame, type ThreeEvent } from '@react-three/fiber'
import { CatmullRomLine, Effects, Grid, Html, OrbitControls, PointMaterial, Points } from '@react-three/drei'
import { UnrealBloomPass, type Line2 } from 'three-stdlib'
import { buildCityGeo, buildFallbackGeo, LIFT, type CityGeoData } from '../lib/geo'

// 运行时注册 UnrealBloomPass（类型声明见 src/types/three-extend.d.ts）
extend({ UnrealBloomPass })

const COLOR_HOVER = new THREE.Color('#46c8d8')
const COLOR_SELECT = new THREE.Color('#e3ad52')

export interface SceneProps {
  className?: string
  autoRotate?: boolean
  bloomStrength?: number
  cameraPosition?: [number, number, number]
  showParticles?: boolean
  showFlyLines?: boolean
  showGrid?: boolean
  showLabels?: boolean
  /** 点击区块时回调区县名（取消选中时为 null） */
  onSelect?: (name: string | null) => void
}

/* ---------------- 飞线 ---------------- */
function FlyLines({ geo }: { geo: CityGeoData }) {
  const refs = useRef<(Line2 | null)[]>([])
  const centerTop = useMemo(
    () => new THREE.Vector3(0, geo.maxHeight + 8, 0),
    [geo],
  )

  useFrame((_, delta) => {
    for (const l of refs.current) {
      if (l) l.material.dashOffset -= delta * 3
    }
  })

  return (
    <>
      {geo.districts.map((d, i) => {
        const start = new THREE.Vector3(d.base.x, d.height + 0.6, d.base.z)
        const mid = new THREE.Vector3(
          (start.x + centerTop.x) / 2,
          Math.max(d.height, centerTop.y) + 9,
          (start.z + centerTop.z) / 2,
        )
        return (
          <CatmullRomLine
            key={d.name}
            ref={(el) => {
              refs.current[i] = el
            }}
            points={[start, mid, centerTop]}
            color="#2f93ad"
            lineWidth={1}
            transparent
            opacity={0.3}
            dashed
            dashSize={1.6}
            gapSize={3.2}
            dashScale={1}
          />
        )
      })}
    </>
  )
}

/* ---------------- 城市中心节点（脉动球 + 双环） ---------------- */
function CenterNode({ geo }: { geo: CityGeoData }) {
  const group = useRef<THREE.Group>(null)
  useFrame((state) => {
    const t = state.clock.elapsedTime
    const g = group.current
    if (!g) return
    g.children[0].scale.setScalar(1 + Math.sin(t * 2.2) * 0.18)
    g.children[1].rotation.z += 0.012
    g.children[2].rotation.z -= 0.008
  })
  const y = geo.maxHeight + 8
  return (
    <group ref={group} position={[0, y, 0]}>
      <mesh>
        <sphereGeometry args={[1.5, 24, 24]} />
        <meshBasicMaterial color="#37a3bd" transparent opacity={0.9} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[3.4, 0.07, 8, 56]} />
        <meshBasicMaterial color="#2b8ba6" transparent opacity={0.55} />
      </mesh>
      <mesh rotation-x={Math.PI / 2}>
        <torusGeometry args={[5.2, 0.05, 8, 56]} />
        <meshBasicMaterial color="#23577a" transparent opacity={0.4} />
      </mesh>
    </group>
  )
}

/* ---------------- 粒子 ---------------- */
function Particles({ geo }: { geo: CityGeoData }) {
  const group = useRef<THREE.Group>(null)
  const positions = useMemo(() => {
    const n = 520
    const arr = new Float32Array(n * 3)
    const r = geo.radius * 0.92
    for (let i = 0; i < n; i++) {
      arr[i * 3] = (Math.random() - 0.5) * r * 2
      arr[i * 3 + 1] = Math.random() * (geo.maxHeight + 14)
      arr[i * 3 + 2] = (Math.random() - 0.5) * r * 2
    }
    return arr
  }, [geo])

  useFrame((_, delta) => {
    if (group.current) group.current.rotation.y += delta * 0.04
  })

  return (
    <group ref={group}>
      <Points positions={positions} stride={3} frustumCulled={false}>
        <PointMaterial
          color="#4d9fb5"
          size={1.1}
          sizeAttenuation
          transparent
          opacity={0.5}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </Points>
    </group>
  )
}

/* ---------------- 3D 中文标签 ---------------- */
function MapLabels({ geo, hover, selected }: { geo: CityGeoData; hover: number | null; selected: number | null }) {
  if (!geo.districts.length) return null
  return (
    <>
      {geo.districts.map((d) => {
        const cls = [
          'district-label',
          hover === d.index ? 'hover' : '',
          selected === d.index ? 'sel' : '',
        ]
          .filter(Boolean)
          .join(' ')
        return (
          <Html
            key={d.name}
            position={[d.centroid.x, d.centroid.y + 0.8, d.centroid.z]}
            center
            pointerEvents="none"
            zIndexRange={[9, 0]}
            className="map-label"
          >
            <div className={cls}>{d.name}</div>
          </Html>
        )
      })}
    </>
  )
}

/* ---------------- 3D 内容 ---------------- */
function CityWorld({ geo, autoRotate, bloomStrength, showParticles, showFlyLines, showGrid, showLabels, onSelect }: SceneProps & { geo: CityGeoData }) {
  const [hover, setHover] = useState<number | null>(null)
  const [selected, setSelected] = useState<number | null>(null)
  const geom = geo.geometry

  // 性能：增量更新 hover/选中 —— 用 ref 记录上次 hover/selected 索引，
  // 只遍历涉及的区县顶点区间，避免每次切换都全量重建 17.7 万顶点/颜色。
  const lastHoverRef = useRef<number | null>(null)
  const lastSelectRef = useRef<number | null>(null)

  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        vertexColors: true,
        roughness: 0.55,
        metalness: 0.3,
        emissive: '#071b30',
        emissiveIntensity: 0.3,
      }),
    [],
  )

  // hover / 选中：抬高 + 变色（增量式，基于顶点区间；初始颜色/位置在构建时已写入）
  useLayoutEffect(() => {
    const posAttr = geom.attributes.position as THREE.BufferAttribute
    const colorAttr = geom.attributes.color as THREE.BufferAttribute
    const pos = posAttr.array as Float32Array
    const colors = colorAttr.array as Float32Array
    const prevHover = lastHoverRef.current
    const prevSelect = lastSelectRef.current

    // 位置：仅 selected 变化时，把"上次 selected"区县顶点 y 减回 LIFT、"新 selected"加上 LIFT
    if (prevSelect !== selected) {
      if (prevSelect != null && geo.districts[prevSelect]) {
        const info = geo.districts[prevSelect]
        for (let v = info.start; v < info.end; v++) pos[v * 3 + 1] -= LIFT
      }
      if (selected != null && geo.districts[selected]) {
        const info = geo.districts[selected]
        for (let v = info.start; v < info.end; v++) pos[v * 3 + 1] += LIFT
      }
      posAttr.needsUpdate = true
    }

    // 颜色：只重写"上次/本次 hover、上次/本次 selected"涉及的区县区间（去重后最多 4 个），
    // 其余区县颜色保持不动；被替换掉的区县恢复为 d.color
    const affected = new Set<number>()
    if (prevHover != null) affected.add(prevHover)
    if (prevSelect != null) affected.add(prevSelect)
    if (hover != null) affected.add(hover)
    if (selected != null) affected.add(selected)
    if (affected.size > 0) {
      for (const idx of affected) {
        const info = geo.districts[idx]
        if (!info) continue
        let target = info.color
        if (selected === idx) target = COLOR_SELECT
        else if (hover === idx) target = COLOR_HOVER
        for (let v = info.start; v < info.end; v++) {
          colors[v * 3] = target.r
          colors[v * 3 + 1] = target.g
          colors[v * 3 + 2] = target.b
        }
      }
      colorAttr.needsUpdate = true
    }

    lastHoverRef.current = hover
    lastSelectRef.current = selected
  }, [hover, selected, geom, geo])

  const districtAt = (e: ThreeEvent<MouseEvent>): number | null => {
    if (!e.face) return null
    const attr = geom.getAttribute('district') as THREE.BufferAttribute
    return attr.getX(e.face.a)
  }

  return (
    <>
      {/* 灯光（v2 降档：避免区块过曝发白） */}
      <ambientLight intensity={0.55} color="#b8d0e8" />
      <directionalLight position={[60, 90, 40]} intensity={0.9} />
      <directionalLight position={[-50, 60, -70]} intensity={0.32} color="#2a548f" />
      <pointLight position={[0, 46, 0]} intensity={200} color="#2a86a8" distance={110} decay={2} />

      {/* 区县挤出地图 */}
      <mesh
        geometry={geom}
        material={material}
        onPointerOver={(e) => {
          e.stopPropagation()
          const i = districtAt(e)
          if (i != null) setHover(i)
        }}
        onPointerOut={() => setHover(null)}
        onClick={(e) => {
          e.stopPropagation()
          const i = districtAt(e)
          const next = i != null && i !== selected ? i : null
          setSelected(next)
          onSelect?.(next != null ? geo.districts[next].name : null)
        }}
      />

      {showFlyLines && <FlyLines geo={geo} />}
      <CenterNode geo={geo} />
      {showParticles && <Particles geo={geo} />}

      {showGrid && (
        <Grid
          position={[0, -0.3, 0]}
          args={[420, 420]}
          cellSize={10}
          cellThickness={0.4}
          cellColor="#0a2a40"
          sectionSize={50}
          sectionThickness={1}
          sectionColor="#13425f"
          fadeDistance={380}
          fadeStrength={1.1}
          side={THREE.DoubleSide}
        />
      )}

      {showLabels && <MapLabels geo={geo} hover={hover} selected={selected} />}

      <OrbitControls
        target={[0, 6, 0]}
        enableDamping
        dampingFactor={0.08}
        autoRotate={autoRotate}
        autoRotateSpeed={0.7}
        minDistance={40}
        maxDistance={430}
        maxPolarAngle={Math.PI / 2.15}
      />

      {bloomStrength != null && bloomStrength > 0 && (
        <Effects renderIndex={1}>
          <unrealBloomPass args={[new THREE.Vector2(1024, 576), bloomStrength, 0.8, 0.12]} />
        </Effects>
      )}
    </>
  )
}

/* ---------------- 场景入口 ---------------- */
export function Scene({ className, onSelect, ...rest }: SceneProps) {
  const [geo, setGeo] = useState<CityGeoData | null>(null)
  const { cameraPosition, ...worldProps } = rest

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      try {
        const res = await fetch('/geojson/fuzhou.json')
        if (!res.ok) throw new Error(`HTTP ${res.status}`)
        const fc = await res.json()
        if (!cancelled) setGeo(buildCityGeo(fc))
      } catch {
        // 下载失败 → 模拟区块兜底（页面标注"模拟数据"）
        if (!cancelled) setGeo(buildFallbackGeo())
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [])

  return (
    <div className={className ?? 'scene-fill'}>
        <Canvas
          dpr={[1, 1.5]}
          camera={{ position: cameraPosition ?? [0, 85, 140], fov: 50, near: 1, far: 2000 }}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        onCreated={({ gl }) => gl.setClearColor('#04080f', 0)}
      >
        {geo && <CityWorld geo={geo} onSelect={onSelect} {...worldProps} />}
      </Canvas>
      {!geo && <div className="scene-loading">地图数据加载中…</div>}
      {geo?.simulated && <div className="scene-sim-note">⚠ 模拟数据（GeoJSON 加载失败，已用演示区块替代）</div>}
    </div>
  )
}
