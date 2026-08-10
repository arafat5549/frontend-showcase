# Three.js 大屏技术选型 — 调研结论

> wayfinder 票「调研：Three.js 大屏技术选型」resolution。日期 2026-08-10，版本号经 npm registry 实测。
> ✅=实测 🔶=推断

## 1. 渲染架构（版本实测）

- `three` latest = **0.185.1**（2026-07-01）✅
- `@react-three/fiber` latest = **9.7.0**（2026-04-28），peerDeps: react 19.x / three >=0.156；v10 仍 alpha ✅
- `@react-three/drei` latest = **10.7.8**，peerDeps: react ^19 / three >=0.159 / fiber ^9 ✅
- **结论：React 19 + three 0.185.1 + R3F 9.7.x + drei 10.7.x 是当前官方支持的组合**（fiber@8 配 react@18，fiber@9 配 react@19）。
- 维护状态：fiber 31.7k stars 当日活跃、drei 2026-08 活跃、three 正常发版节奏，均 MIT。
- R3F vs 原生：大屏多组件拼装 R3F 声明式 + hooks 效率显著更高，性能仅多一层 reconciler diff；官方指引 draw call ≤1000、`frameloop="demand"` 按需渲染、PerformanceMonitor 自适应 DPR。对纯展示大屏 R3F 收益大于成本 🔶。

## 2. 核心效果实现路径（对照 ThreeMaps mini3d 配方）

- **挤出区块**：`ExtrudeGeometry` + `BufferGeometryUtils.mergeGeometries`（r185 存在；旧 `mergeBufferGeometries` 已移除）；d3-geo 3.1.1 的 geoMercator `fitSize/fitExtent` 直接吃 GeoJSON。注意 r168+ TSL 节点材质体系，传统 ShaderMaterial 仍可用。
- **飞线**：`Line2/LineGeometry/LineMaterial`（r185 addons，线宽可控）；drei `<Line>`/`<CatmullRomLine>` 现成；流动动画 gsap 3.15.0 或自定义 shader。
- **粒子**：`Points + PointsMaterial`（贴图 sprite）；drei `<Points>` 封装。
- **3D 文字标签**：drei `<Text>`（troika-three-text ^0.52.4，SDF、支持 CJK，字体需含中文字形、建议子集化）首选；或 drei `<Html>`（DOM overlay，中文零成本，限十几个标签）；原生 CSS2DRenderer 需手动桥接。
- **辉光后期**：drei 10.x **已移除 `EffectComposer`，替换为 `<Effects>`**，底层 three-stdlib 2.36.1（含 UnrealBloomPass）；或 three addons 原生 EffectComposer + RenderPass + OutputPass。⚠️ 规划时按 drei 10.x `<Effects>` 写，不要照旧教程用 EffectComposer。

## 3. 大屏适配

- autofit.js：latest 3.2.8（2025-04-22 后停发约 15 个月）⚠️ 维护停滞，建议弃用。
- **推荐自写 CSS `transform: scale`**：按设计稿基准（如 1920×1080）等比缩放 + 居中，React 一个 useResizeObserver 即实现 🔶。

## 4. 数据面板

- ECharts latest = **6.1.0**（5.6.0 为 5.x 末版），Apache-2.0 ✅。
- 官方无 React 绑定；社区事实标准 echarts-for-react：latest **3.0.6**（⚠️ 2026-05 曾发 3.2.8 但已撤回 404，勿用高于 3.0.6 版本）。
- 大屏面板较多 → 推荐**手写 `useECharts` hook**（echarts/core 按需注册 + init/setOption/ResizeObserver/dispose，几十行、零依赖风险）🔶。

## 5. 性能基线

- three.module.min.js 0.185.1：raw 357KB / gzip 85.1KB / brotli 70.7KB ✅；R3F+drei tree-shake 后 +30-50KB gzip 🔶；首屏预算 <500KB gzip。
- 行政区级场景（几百多边形 + 几千粒子 + 十几飞线）：几何合并后约 1 draw call（区块）+ 1 Points + 十余 Line，**low-end 设备流畅无压力** 🔶。
- 演进预留：真实城市数千建筑 → `InstancedMesh`（单 draw call 几十万对象）或 `BatchedMesh`（r185 新增）；行政区大屏不需要，但架构上留升级口。

## 关键结论

React 19 + three 0.185.1 + R3F 9.7 + drei 10.7 是当前健康组合；ThreeMaps 全部效果在新栈都有等价现成组件。两个坑：drei 10 后处理用 `<Effects>`（three-stdlib 底座）；echarts-for-react 只认 3.0.6（或手写 hook）；autofit.js 弃用换自研 transform: scale。
