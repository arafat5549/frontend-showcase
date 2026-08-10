/**
 * 原型用途：智慧城市数据大屏 —— 把福州区县 GeoJSON 转换为 3D 挤出几何体。
 * 流程：d3-geo geoMercator().fitSize() 平面投影 → THREE.Shape → ExtrudeGeometry 按 GDP 挤出
 * → 每个区县多边形部件合并（mergeGeometries，three 0.185 的正确 API）→ 全区县合并为单一网格
 * → 顶点附带 district 索引属性（用于 hover/选中识别）+ vertex color（按区县着色）。
 * 若 GeoJSON 加载失败，回退为演示用六边形模拟区块（页面会标注"模拟数据"）。
 */
import * as THREE from 'three'
import { geoMercator, geoCentroid } from 'd3-geo'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { districts, statsByName } from '../data/mock'

/** 投影画布尺寸（仅决定相对比例） */
const MAP_W = 160
const MAP_H = 130
/** 挤出高度范围（世界单位） */
const MIN_H = 1.6
const MAX_H = 16
/** 选中抬升高度 */
export const LIFT = 2.6

const COLOR_LOW = new THREE.Color('#0b2f52')
const COLOR_HIGH = new THREE.Color('#17c3e0')

export interface GeoDistrictInfo {
  name: string
  index: number
  /** 顶面中心（标签、飞线起点） */
  centroid: THREE.Vector3
  /** 底面中心 */
  base: THREE.Vector3
  height: number
  color: THREE.Color
  /** 在合并几何体中的顶点区间 [start, end) */
  start: number
  end: number
}

export interface CityGeoData {
  geometry: THREE.BufferGeometry
  districts: GeoDistrictInfo[]
  basePositions: Float32Array
  baseColors: Float32Array
  center: THREE.Vector3
  radius: number
  maxHeight: number
  simulated: boolean
}

type Ring = Array<[number, number]>

function projectRing(
  ring: Ring,
  project: (p: [number, number]) => [number, number] | null,
  cx: number,
  cy: number,
): THREE.Vector2[] {
  return ring.map((pt) => {
    const p = project(pt)
    return new THREE.Vector2(p ? p[0] - cx : 0, p ? cy - p[1] : 0)
  })
}

/** 由任意 FeatureCollection（any，运行时数据）构建城市几何 */
export function buildCityGeo(fc: unknown): CityGeoData {
  const collection = fc as {
    features: Array<{
      properties?: { name?: string; adcode?: string | number }
      geometry?: { type?: string; coordinates?: unknown }
    }>
  }
  const features = collection?.features ?? []

  const gdps = districts.map((d) => d.GDP)
  const minGdp = Math.min(...gdps)
  const maxGdp = Math.max(...gdps)

  const projection = geoMercator().fitSize([MAP_W, MAP_H], fc as never)

  // 收集所有投影点求包围盒中心
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const walk = (coords: unknown) => {
    if (!Array.isArray(coords)) return
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      const p = projection(coords as [number, number])
      if (p) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0])
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
      }
      return
    }
    for (const c of coords) walk(c)
  }
  features.forEach((f) => walk(f.geometry?.coordinates))
  const cx = (minX + maxX) / 2 || 0
  const cy = (minY + maxY) / 2 || 0

  const geos: THREE.BufferGeometry[] = []
  const infos: GeoDistrictInfo[] = []
  let vertexCursor = 0

  features.forEach((f, i) => {
    const name = f.properties?.name ?? `区县${i + 1}`
    const stat = statsByName[name]
    const gdp = stat?.GDP ?? 600
    const h = MIN_H + ((gdp - minGdp) / (maxGdp - minGdp)) * (MAX_H - MIN_H)

    const coords = f.geometry?.coordinates as unknown
    const polygons = Array.isArray(coords) && f.geometry?.type === 'Polygon' ? [coords] : (coords as unknown[]) ?? []

    const parts: THREE.ExtrudeGeometry[] = []
    for (const poly of polygons) {
      if (!Array.isArray(poly) || poly.length === 0) continue
      const outer = projectRing(poly[0] as Ring, projection, cx, cy)
      if (outer.length < 3) continue
      const shape = new THREE.Shape(outer)
      for (let hi = 1; hi < poly.length; hi++) {
        const hole = projectRing(poly[hi] as Ring, projection, cx, cy)
        if (hole.length >= 3) shape.holes.push(new THREE.Path(hole))
      }
      const g = new THREE.ExtrudeGeometry(shape, {
        depth: h,
        bevelEnabled: true,
        bevelSize: 0.32,
        bevelThickness: 0.32,
        bevelSegments: 2,
        curveSegments: 8,
      })
      // 挤出沿 +z，旋转后沿 +y（高度向上），底面落在 y=0
      g.rotateX(-Math.PI / 2)
      parts.push(g)
    }
    if (parts.length === 0) return

    const districtGeo = parts.length === 1 ? parts[0] : (mergeGeometries(parts) ?? parts[0])
    const count = districtGeo.attributes.position.count
    districtGeo.setAttribute('district', new THREE.BufferAttribute(new Float32Array(count).fill(i), 1))

    const cll = geoCentroid(f as never)
    const cp = projection(cll as [number, number]) ?? [cx, cy]

    const t = (gdp - minGdp) / (maxGdp - minGdp)
    const color = new THREE.Color().lerpColors(COLOR_LOW, COLOR_HIGH, t)

    infos.push({
      name,
      index: i,
      centroid: new THREE.Vector3(cp[0] - cx, h + 1.2, cy - cp[1]),
      base: new THREE.Vector3(cp[0] - cx, 0.2, cy - cp[1]),
      height: h,
      color,
      start: vertexCursor,
      end: vertexCursor + count,
    })
    vertexCursor += count
    geos.push(districtGeo)
  })

  const merged = mergeGeometries(geos)
  if (!merged) throw new Error('区县几何合并失败')

  // 顶点颜色：按区县着色
  const totalVerts = merged.attributes.position.count
  const baseColors = new Float32Array(totalVerts * 3)
  for (const info of infos) {
    const c = info.color
    for (let v = info.start; v < info.end; v++) {
      baseColors[v * 3] = c.r
      baseColors[v * 3 + 1] = c.g
      baseColors[v * 3 + 2] = c.b
    }
  }
  merged.setAttribute('color', new THREE.BufferAttribute(baseColors.slice(), 3))
  merged.computeBoundingSphere()

  return {
    geometry: merged,
    districts: infos,
    basePositions: (merged.attributes.position.array as Float32Array).slice(),
    baseColors,
    center: new THREE.Vector3(0, 0, 0),
    radius: MAP_W / 2,
    maxHeight: MAX_H,
    simulated: false,
  }
}

/** GeoJSON 加载失败时的回退：生成 6 个演示六边形区块（页面标注"模拟数据"） */
export function buildFallbackGeo(): CityGeoData {
  const names = ['演示区·北', '演示区·东', '演示区·中', '演示区·南', '演示区·西', '演示区·港']
  const cols = 3
  const rows = 2
  const cellW = 26
  const cellH = 22
  const geos: THREE.BufferGeometry[] = []
  const infos: GeoDistrictInfo[] = []
  let vertexCursor = 0

  names.forEach((name, i) => {
    const gx = (i % cols) - (cols - 1) / 2
    const gy = Math.floor(i / cols) - (rows - 1) / 2
    const cx0 = gx * cellW
    const cy0 = gy * cellH
    const h = 6 + (i % 4) * 2.4

    const hex: [number, number][] = []
    for (let k = 0; k < 6; k++) {
      const a = (Math.PI / 3) * k + Math.PI / 6
      hex.push([cx0 + Math.cos(a) * 11, cy0 + Math.sin(a) * 11])
    }
    const shape = new THREE.Shape(hex.map(([x, y]) => new THREE.Vector2(x, y)))
    const g = new THREE.ExtrudeGeometry(shape, {
      depth: h,
      bevelEnabled: true,
      bevelSize: 0.3,
      bevelThickness: 0.3,
      bevelSegments: 1,
      curveSegments: 6,
    })
    g.rotateX(-Math.PI / 2)
    const count = g.attributes.position.count
    g.setAttribute('district', new THREE.BufferAttribute(new Float32Array(count).fill(i), 1))
    geos.push(g)

    const color = new THREE.Color().lerpColors(COLOR_LOW, COLOR_HIGH, (i % 4) / 4)
    infos.push({
      name,
      index: i,
      centroid: new THREE.Vector3(cx0, h + 1.2, cy0),
      base: new THREE.Vector3(cx0, 0.2, cy0),
      height: h,
      color,
      start: vertexCursor,
      end: vertexCursor + count,
    })
    vertexCursor += count
  })

  const merged = mergeGeometries(geos)!
  const totalVerts = merged.attributes.position.count
  const baseColors = new Float32Array(totalVerts * 3)
  for (const info of infos) {
    for (let v = info.start; v < info.end; v++) {
      baseColors[v * 3] = info.color.r
      baseColors[v * 3 + 1] = info.color.g
      baseColors[v * 3 + 2] = info.color.b
    }
  }
  merged.setAttribute('color', new THREE.BufferAttribute(baseColors.slice(), 3))
  merged.computeBoundingSphere()

  return {
    geometry: merged,
    districts: infos,
    basePositions: (merged.attributes.position.array as Float32Array).slice(),
    baseColors,
    center: new THREE.Vector3(0, 0, 0),
    radius: MAP_W / 2,
    maxHeight: MAX_H,
    simulated: true,
  }
}
