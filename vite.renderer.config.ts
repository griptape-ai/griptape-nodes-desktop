import { defineConfig } from 'vite';
import { getBuildInfo } from './src/common/build-info';
import { resolve } from 'path';
import { commonWatchIgnored } from './vite.common.config';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
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
