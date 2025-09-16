import { PackagingOptions } from 'electron-windows-msix';

/**
 * The configuration object for the MSIX maker.
 * The `outputDir` and `appDir` parameters are handled by Electron Forge and should not be provided.
 */
export type MakerMsixConfig = Omit<PackagingOptions, 'outputDir' | 'appDir'>;