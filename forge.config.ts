import { FuseV1Options, FuseVersion } from '@electron/fuses';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerRpm } from '@electron-forge/maker-rpm';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { PublisherGithub } from '@electron-forge/publisher-github';
import { PublisherS3 } from '@electron-forge/publisher-s3';
import type { ForgeConfig } from '@electron-forge/shared-types';

// Get release configuration from environment variables
const tagPrefix = process.env.TAG_PREFIX;
const draft = process.env.DRAFT === 'true';
const prerelease = process.env.PRERELEASE === 'true';

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ...(process.platform === 'darwin' && { icon: 'generated/icons/icon.icns' }),
    ...(process.platform === 'win32' && { icon: 'generated/icons/icon.ico' }),
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
  rebuildConfig: {},
  makers: [
    // Maker for Windows
    new MakerSquirrel(arch => ({
      name: "GriptapeNodes",
      loadingGif: './public/loading.gif',
      iconUrl: 'https://griptape-nodes-desktop-public.s3.us-west-2.amazonaws.com/icon.ico',
      setupIcon: 'generated/icons/icon_installer_windows.ico',
      remoteReleases: `https://griptape-nodes-desktop-updates.s3.amazonaws.com/win32/${arch}`
    })),
    // Maker for Mac
    new MakerDMG({
      name: "Griptape Nodes Installer",
      title: "Griptape Nodes Installer",
      icon: 'generated/icons/icon_installer_mac.icns',
      iconSize: 100,
    }, ['darwin']),
    // Maker for ZIP updates to Mac app
    new MakerZIP(arch => ({
      macUpdateManifestBaseUrl: `https://griptape-nodes-desktop-updates.s3.amazonaws.com/darwin/${arch}`
    })),
    new MakerRpm(),
    new MakerDeb(),
  ],
  publishers: [
    new PublisherGithub({
      repository: {
        owner: 'griptape-ai',
        name: 'griptape-nodes-desktop'
      },
      draft,
      prerelease,
      tagPrefix
    }),
    // Only include S3 publisher for production releases (when tagPrefix is "v")
    ...(tagPrefix !== 'v' ? [] : [
      new PublisherS3({
        bucket: 'griptape-nodes-desktop-updates',
        keyResolver: (filename, platform, arch) => `${platform}/${arch}/${filename}`
      })
    ]),
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
          config: 'vite.setup.config.ts',
          target: 'main',
        },
        {
          entry: 'src/workers/python/index.ts',
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
