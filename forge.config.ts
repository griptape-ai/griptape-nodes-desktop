import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { WebpackPlugin } from '@electron-forge/plugin-webpack';
import type { ForgeConfig } from '@electron-forge/shared-types';

import { mainConfig } from './webpack.main.config.ts';
import { rendererConfig } from './webpack.renderer.config.ts';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ...(process.platform === 'darwin' && { icon: 'generated/icons/icon.icns' }),
    ...(process.platform === 'win32' && { icon: 'generated/icons/icon.ico' }),
    executableName: 'griptape-nodes-desktop',
    appBundleId: 'ai.griptape.nodes.desktop',
    // protocols: [
    //   {
    //     name: 'Griptape Nodes Desktop',
    //     schemes: ['gtn']
    //   }
    // ],
  },
  rebuildConfig: {},
  makers: [
    new MakerZIP({}, ['darwin']),
    new MakerRpm({}),
    new MakerDeb({}),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new WebpackPlugin({
      mainConfig,
      renderer: {
        config: rendererConfig,
        entryPoints: [
          {
            name: 'main_window',
            html: './index.html',
            js: './src/renderer/index.tsx',
            preload: {
              js: './src/preload/index.ts',
            },
          },
        ],
      },
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
