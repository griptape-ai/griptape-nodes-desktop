import type { ForgeHookFn } from '@electron-forge/shared-types';
import { downloadPython } from './src/python-downloader';

export const generateAssets: ForgeHookFn<'generateAssets'> = async (config, platform, arch) => {
  console.log(`Downloading Python for ${platform}-${arch}...`);
  await downloadPython(platform, arch);
};