import type { ForgeHookFn } from '@electron-forge/shared-types'
import { generateIcons } from './scripts/generate-icons.js'

export const generateAssets: ForgeHookFn<'generateAssets'> = async () => {
  // Generate icons
  console.log('Generating app icons...')
  await generateIcons()
}
