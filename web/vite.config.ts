import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // GitHub Pages 등 하위 경로 배포에서도 동작하도록 상대 경로 사용
  base: './',
  plugins: [react()],
})
