import { defineConfig } from 'vite';
import { getBuildInfo } from './src/shared/build-info';
import { resolve } from 'path';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  },
  publicDir: 'public',
  base: './',
  build: {
    rollupOptions: {
      input: {
        index: resolve(__dirname, 'index.html')
      }
    },
    assetsDir: 'assets',
    copyPublicDir: true
  }
});
