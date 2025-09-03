import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { generateAssets } from './forge.hooks';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    icon: process.platform === 'darwin' ? 'generated/icons/icon' : 'generated/icons/icon',
    executableName: 'griptape-nodes-desktop',
    extraResource: [
      'resources/uv',
      'resources/python',
    ],
    protocols: [
      {
        name: 'Griptape Nodes Desktop',
        schemes: ['gtn']
      }
    ]
  },
  hooks: {
    generateAssets
  },
  rebuildConfig: {},
  makers: [
    // Maker for Windows
    new MakerSquirrel({
      name: "GriptapeNodes",
      setupIcon: 'generated/icons/icon.ico',
      iconUrl: 'https://raw.githubusercontent.com/griptape-ai/griptape-nodes-desktop/main/public/icon.ico',
    }),
    // Maker for Mac
    new MakerDMG({
      name: "Griptape Nodes Installer",
      title: "Griptape Nodes Installer",
      icon: 'generated/icons/icon_installer.icns',
      iconSize: 100,
    }, ['darwin']),
    new MakerRpm({
      options: {
        icon: 'generated/icons/icon.png',
      }
    }),
    new MakerDeb({
      options: {
        icon: 'generated/icons/icon.png',
      }
    }),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'griptape-ai',
        name: 'griptape-nodes-desktop'
      },
      draft: true,
      prerelease: true,
    })
  ],
  plugins: [
    new VitePlugin({
      // `build` can specify multiple entry builds, which can be Main process, Preload scripts, Worker process, etc.
      // If you are familiar with Vite configuration, it will look really familiar.
      build: [
        {
          // `entry` is just an alias for `build.lib.entry` in the corresponding file of `config`.
          entry: 'src/main/index.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload/index.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
        {
          entry: 'src/workers/setup/index.ts',
          config: 'vite.worker.config.ts',
          target: 'main',
        },
        {
          entry: 'src/workers/python-worker.ts',
          config: 'vite.python-worker.config.ts',
          target: 'main',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
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
