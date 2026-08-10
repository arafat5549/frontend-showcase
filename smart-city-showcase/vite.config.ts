import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 原型用途：智慧城市数据大屏 UI 原型（throwaway），供客户挑选布局/视觉方向。
// 端口：6001 起固定 +1 分配；crawler-showcase=6002、minecraft-demo=6003（根 README 端口表），
// 本目录原定为 6003 但与 minecraft-demo 冲突（其 dev server 常驻 6003），经确认改用 6004。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 6004,
    strictPort: true,
  },
})
