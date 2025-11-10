import { FuseV1Options, FuseVersion } from '@electron/fuses'
import { MakerDeb } from '@electron-forge/maker-deb'
import { MakerRpm } from '@electron-forge/maker-rpm'
import { MakerZIP } from '@electron-forge/maker-zip'
import { FusesPlugin } from '@electron-forge/plugin-fuses'
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives'
import { WebpackPlugin } from '@electron-forge/plugin-webpack'
import type { ForgeConfig } from '@electron-forge/shared-types'

import { mainConfig } from './webpack.main.config.ts'
import { rendererConfig } from './webpack.renderer.config.ts'

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    ...(process.platform === 'darwin' && { icon: 'generated/icons/icon.icns' }),
    ...(process.platform === 'win32' && { icon: 'generated/icons/icon.ico' }),
    ...(process.platform === 'linux' && { icon: 'generated/icons/icon.png' }),
    executableName: 'griptape-nodes-desktop',
    appBundleId: 'ai.griptape.nodes.desktop',
    ...(process.platform === 'darwin' && {
      extendInfo: {
        NSCameraUsageDescription:
          'Griptape Nodes uses your camera for video-based AI workflows and visual input processing.',
        NSMicrophoneUsageDescription:
          'Griptape Nodes uses your microphone for audio-based AI workflows and voice input processing.'
      }
    }),
    // protocols: [
    //   {
    //     name: 'Griptape Nodes Desktop',
    //     schemes: ['gtn']
    //   }
    // ],
    // Only enable code signing and notarization in GitHub Actions CI/CD environment
    ...(process.env.GITHUB_ACTIONS && {
      osxSign: {
        identity: process.env.APPLE_IDENTITY,
        entitlements: 'entitlements.entitlements',
        'hardened-runtime': true // Required for Developer ID Application certificates
      } as any
      // osxNotarize: {
      //   appleId: process.env.APPLE_ID as string,
      //   appleIdPassword: process.env.APPLE_PASSWORD as string,
      //   teamId: process.env.APPLE_TEAM_ID as string,
      // },
    })
  },
  rebuildConfig: {},
  makers: [new MakerZIP({}, ['darwin']), new MakerRpm({}), new MakerDeb({})],
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
              js: './src/preload/index.ts'
            }
          },
          {
            name: 'webview_preload',
            preload: {
              js: './src/preload/webview-preload.ts'
            }
          }
        ]
      }
    }),
    // Fuses are used to enable/disable various Electron functionality
    // at package time, before code signing the application
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      // Cookie encryption is disabled to prevent keychain prompts on first launch.
      // IMPORTANT: With this disabled, we MUST use in-memory partitions for all BrowserWindows
      // and webviews (e.g., partition: 'memory-only' instead of partition: 'persist:name').
      // In-memory partitions store cookies only in RAM and never write to disk, preventing
      // accidental storage of sensitive data in plain text. We use electron-store with
      // safeStorage for explicit credential encryption when the user opts in.
      [FuseV1Options.EnableCookieEncryption]: false,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true
    })
  ]
}

export default config
