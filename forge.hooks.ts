import type { ForgeHookFn } from '@electron-forge/shared-types';
import { downloadPython } from './src/main/services/downloader';
import { generateIcons } from './scripts/generate-icons.js';

export const generateAssets: ForgeHookFn<'generateAssets'> = async (config, platform, arch) => {
  // Generate icons first
  console.log('Generating app icons...');
  await generateIcons();
  
  // Then download Python
  console.log(`Downloading Python for ${platform}-${arch}...`);
  await downloadPython(platform, arch, './resources');
};