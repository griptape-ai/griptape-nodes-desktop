import { defineConfig } from 'vite';
import { getBuildInfo } from './src/common/build-info';
import { commonWatchIgnored } from './vite.common.config';
import path from 'path';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@/logger": path.resolve(__dirname, "src/main/utils/logger.ts")
    }
  },
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
