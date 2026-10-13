import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      'react-native': 'react-native-web',
      // Core Modal only uses these two hooks. The upstream barrel also imports
      // Tailwind's build-time resolver, which does not belong in a browser bundle.
      '@gluestack-ui/utils/hooks': fileURLToPath(new URL('./src/components/ui/gluestack-web-hooks.js', import.meta.url)),
      '@gluestack-ui/web-hooks': fileURLToPath(new URL('./node_modules/@gluestack-ui/utils/lib/esm/hooks', import.meta.url)),
    },
    extensions: ['.web.tsx', '.web.ts', '.web.jsx', '.web.js', '.tsx', '.ts', '.jsx', '.js', '.json'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:5001',
        changeOrigin: true,
      },
    },
  },
})
