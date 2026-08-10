/**
 * 原型用途：智慧城市数据大屏 —— 把福州区县 GeoJSON 转换为 3D 挤出几何体。
 * 流程：d3-geo geoMercator().fitSize() 平面投影 → THREE.Shape → ExtrudeGeometry 按 GDP 挤出
 * → 每个区县多边形部件合并（mergeGeometries，three 0.185 的正确 API）→ 全区县合并为单一网格
 * → 顶点附带 district 索引属性（用于 hover/选中识别）+ vertex color（按区县着色）。
 * 若 GeoJSON 加载失败，回退为演示用六边形模拟区块（页面会标注"模拟数据"）。
 */
import * as THREE from 'three'
import { geoMercator } from 'd3-geo'
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

  // 手动 fit：d3-geo 的 fitSize/geoBounds 遵循"外环顺时针"旧约定，对 RFC 7946
  // 标准（外环逆时针）GeoJSON 会返回全球 bounds → 缩放被算成极小值，地图挤成细柱。
  // 这里直接按经纬度包围盒求缩放，方向无关。
  const walkCoords = (coords: unknown, visit: (lon: number, lat: number) => void) => {
    if (!Array.isArray(coords)) return
    if (coords.length === 2 && typeof coords[0] === 'number' && typeof coords[1] === 'number') {
      visit(coords[0], coords[1])
      return
    }
    for (const c of coords) walkCoords(c, visit)
  }

  let minLon = Infinity
  let maxLon = -Infinity
  let minLat = Infinity
  let maxLat = -Infinity
  features.forEach((f) =>
    walkCoords(f.geometry?.coordinates, (lon, lat) => {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }),
  )
  if (minLon === Infinity) throw new Error('GeoJSON 无有效坐标')

  const unit = geoMercator().scale(1).translate([0, 0])
  // mercator y 随纬度递减，用四角 min/max 求投影后范围（方向无关）
  const corners = (
    [
      unit([minLon, minLat]),
      unit([minLon, maxLat]),
      unit([maxLon, minLat]),
      unit([maxLon, maxLat]),
    ] as Array<[number, number] | null>
  ).filter((c): c is [number, number] => c != null)
  const px0 = Math.min(...corners.map((c) => c[0]))
  const px1 = Math.max(...corners.map((c) => c[0]))
  const py0 = Math.min(...corners.map((c) => c[1]))
  const py1 = Math.max(...corners.map((c) => c[1]))
  const k = Math.min(MAP_W / (px1 - px0), MAP_H / (py1 - py0))
  const projection = geoMercator().scale(k).translate([0, 0])

  // 投影后包围盒中心（居中到原点）
  let minX = Infinity
  let maxX = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  features.forEach((f) =>
    walkCoords(f.geometry?.coordinates, (lon, lat) => {
      const p = projection([lon, lat])
      if (p) {
        minX = Math.min(minX, p[0]); maxX = Math.max(maxX, p[0])
        minY = Math.min(minY, p[1]); maxY = Math.max(maxY, p[1])
      }
    }),
  )
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
    let sumX = 0
    let sumZ = 0
    let sumN = 0
    for (const poly of polygons) {
      if (!Array.isArray(poly) || poly.length === 0) continue
      const outer = projectRing(poly[0] as Ring, projection, cx, cy)
      if (outer.length < 3) continue
      // 区县中心 = 外环投影点算术平均（geoCentroid 受环方向影响不可用）
      for (const v of outer) {
        sumX += v.x
        sumZ += v.y
        sumN++
      }
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

    const avgX = sumN ? sumX / sumN : 0
    const avgZ = sumN ? sumZ / sumN : 0

    const t = (gdp - minGdp) / (maxGdp - minGdp)
    const color = new THREE.Color().lerpColors(COLOR_LOW, COLOR_HIGH, t)

    infos.push({
      name,
      index: i,
      centroid: new THREE.Vector3(avgX, h + 1.2, avgZ),
      base: new THREE.Vector3(avgX, 0.2, avgZ),
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
