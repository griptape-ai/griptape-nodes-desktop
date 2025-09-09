import { defineConfig } from 'vite';
import { getBuildInfo } from './src/shared/build-info';
import { commonWatchIgnored } from './vite.common.config';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
  server: {
    watch: {
      ignored: commonWatchIgnored
    }
  },
  build: {
    rollupOptions: {
      output: {
        entryFileNames: 'main.js'
      }
    }
  },
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  }
});
