import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'
import { resolve } from 'path'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/icons/*',
          dest: 'icons'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: resolve(__dirname, 'src/popup/index.html'),
        options: resolve(__dirname, 'src/options/index.html'),
        background: resolve(__dirname, 'src/background/service_worker.ts'),
        content: resolve(__dirname, 'src/content/scripts/content.ts')
      },
      output: {
        entryFileNames: (chunkInfo) => {
          if (chunkInfo.name === 'background') {
            return 'background/service_worker.js'
          }
          if (chunkInfo.name === 'content') {
            return 'content/scripts/content.js'
          }
          return '[name]/[name].js'
        },
        chunkFileNames: '[name]/[name].js',
        assetFileNames: '[name]/[name].[ext]'
      }
    },
    target: 'es2022',
    minify: 'terser',
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@/types': resolve(__dirname, 'src/types'),
      '@/lib': resolve(__dirname, 'src/lib'),
      '@/components': resolve(__dirname, 'src/popup/components')
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV || 'development')
  }
})