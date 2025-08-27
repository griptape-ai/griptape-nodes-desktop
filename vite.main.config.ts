import { defineConfig } from 'vite';
import { getBuildInfo } from './src/build-info';

const buildInfo = getBuildInfo();

// https://vitejs.dev/config
export default defineConfig({
  define: {
    __BUILD_INFO__: JSON.stringify(buildInfo)
  }
});
