import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { visualizer } from 'rollup-plugin-visualizer';

export default defineConfig({
  plugins: [
    react(),
    visualizer({ open: false, filename: 'dist/bundle-stats.html' }),
  ],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('@babel/standalone')) return 'babel-runtime';
          if (id.includes('/sass/') || id.includes('\\sass\\')) return 'sass-runtime';
          if (id.includes('/less/') || id.includes('\\less\\')) return 'less-runtime';
          if (id.includes('/typescript/') || id.includes('\\typescript\\')) return 'ts-runtime';
          if (id.includes('@codemirror') || id.includes('@lezer')) return 'codemirror';
          if (id.includes('@vue/compiler-sfc')) return 'vue-compiler';
          if (
            id.includes('react-dom') ||
            id.includes('react-router') ||
            id.includes('scheduler')
          ) return 'vendor-react';
          if (id.includes('node_modules/react/')) return 'vendor-react';
        },
      },
    },
    chunkSizeWarningLimit: 500,
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
    },
  },
  envPrefix: 'VITE_',
  define: {
    'process.env.NODE_ENV': JSON.stringify(process.env.NODE_ENV ?? 'development'),
  },
});
