import path, { resolve } from 'path';
import { defineConfig } from 'vite';
import { getBuildInfo } from './src/common/build-info';
import { commonWatchIgnored } from './vite.common.config';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@/logger": path.resolve(__dirname, "src/renderer/utils/logger.ts")
    }
  },
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  },
  publicDir: 'public',
  base: './',
  server: {
    watch: {
      ignored: commonWatchIgnored
    }
  },
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
