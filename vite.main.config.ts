import { defineConfig } from 'vite';
import { getBuildInfo } from './src/shared/build-info';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
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
