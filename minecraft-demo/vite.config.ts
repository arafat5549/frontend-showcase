import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// base './'：产物可部署到任意子路径（GitHub Pages /frontend-showcase/minecraft-demo/）
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    port: 6003, // 前端端口规则：6001 起固定 +1 分配（见根 AGENTS.md）
    strictPort: true,
  },
})
