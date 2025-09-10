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
    ...(process.platform === 'darwin' && { icon: 'generated/icons/icon' }),
    executableName: 'griptape-nodes-desktop',
    appBundleId: 'com.griptape.nodes.desktop',
    protocols: [
      {
        name: 'Griptape Nodes Desktop',
        schemes: ['gtn']
      }
    ],
    // Only enable code signing and notarization in GitHub Actions CI/CD environment
    ...(process.env.GITHUB_ACTIONS && {
      osxSign: {
        identity: process.env.APPLE_IDENTITY,
        entitlements: 'entitlements.plist',
        'hardened-runtime': true, // Required for Developer ID Application certificates
      },
      osxNotarize: {
        appleId: process.env.APPLE_ID,
        appleIdPassword: process.env.APPLE_PASSWORD,
        teamId: process.env.APPLE_TEAM_ID,
      },
    }),
  },
  hooks: {
    generateAssets
  },
  rebuildConfig: {},
  makers: [
    // Maker for Windows
    new MakerSquirrel({
      name: "GriptapeNodes",
    }),
    // Maker for Mac
    new MakerDMG({
      name: "Griptape Nodes Installer",
      title: "Griptape Nodes Installer",
      icon: 'generated/icons/icon_installer.icns',
      iconSize: 100,
    }, ['darwin']),
    new MakerRpm(),
    new MakerDeb(),
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
          entry: 'src/setup/index.ts',
          config: 'vite.setup.config.ts',
          target: 'main',
        },
        {
          entry: 'src/python/index.ts',
          config: 'vite.python.config.ts',
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
