import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteStaticCopy } from 'vite-plugin-static-copy'

export default defineConfig({
  plugins: [
    react(),
    viteStaticCopy({
      targets: [
        {
          src: 'public/icons/*',
          dest: 'icons'
        },
        {
          src: 'manifest.json',
          dest: '.'
        }
      ]
    })
  ],
  build: {
    outDir: 'dist',
    rollupOptions: {
      input: {
        popup: 'src/popup/index.html',
        options: 'src/options/index.html',
        background: 'src/background/service_worker.ts',
        content: 'src/content/scripts/content.ts'
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
        assetFileNames: (assetInfo) => {
          if (assetInfo.name?.endsWith('.html')) {
            return '[name].html';
          }
          return '[name]/[name].[ext]';
        }
      }
    },
    target: 'es2022',
    minify: 'terser',
    sourcemap: false
  },
  resolve: {
    alias: {
      '@': '/src',
      '@/types': '/src/types',
      '@/lib': '/src/lib',
      '@/components': '/src/popup/components'
    }
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('development')
  }
})