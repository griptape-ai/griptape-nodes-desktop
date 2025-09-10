import { defineConfig } from 'vite';
import { commonWatchIgnored } from './vite.common.config';

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
        entryFileNames: 'setup.js'
      }
    }
  }
});
