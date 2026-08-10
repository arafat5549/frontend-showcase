import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 原型用途：智慧城市数据大屏 UI 原型（throwaway），供客户挑选布局/视觉方向。
// 端口规则：6001 起固定 +1，crawler-showcase=6002，本目录=6003。
export default defineConfig({
  plugins: [react()],
  server: {
    port: 6003,
    strictPort: true,
  },
})
