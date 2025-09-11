import { defineConfig } from 'vite';
import { commonWatchIgnored } from './vite.common.config';
import * as path from 'path';

// https://vitejs.dev/config
export default defineConfig({
  resolve: {
    alias: {
      "@/logger": path.resolve(__dirname, "src/renderer/utils/logger.ts")
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
        entryFileNames: 'preload.js'
      }
    }
  }
});
