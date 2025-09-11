import { defineConfig } from 'vite';
import { commonWatchIgnored } from './vite.common.config';
import path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@/logger": path.resolve(__dirname, "src/workers/utils/logger.ts")
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
        entryFileNames: 'setup.js'
      }
    }
  }
});
