// Types and helper function based on @electron-forge/core-utils
type PackagePerson = string | { name?: string; email?: string; url?: string };

function parseAuthor(author: string): { name?: string; email?: string; url?: string } {
  const match = author.match(/^(.+?)\s*(?:<(.+?)>)?\s*(?:\((.+?)\))?$/);
  return {
    name: match?.[1]?.trim(),
    email: match?.[2]?.trim(),
    url: match?.[3]?.trim(),
  };
}

function getNameFromAuthor(author: PackagePerson): string {
  let publisher: PackagePerson = author || '';

  if (typeof publisher === 'string') {
    publisher = parseAuthor(publisher);
  }

  if (
    typeof publisher !== 'string' &&
    publisher &&
    typeof publisher.name === 'string'
  ) {
    publisher = publisher.name;
  }

  if (typeof publisher !== 'string') {
    publisher = '';
  }

  return publisher;
}
import { MakerBase, MakerOptions } from '@electron-forge/maker-base';
import { ForgePlatform } from '@electron-forge/shared-types';
import { packageMSIX } from 'electron-windows-msix';
import { MakerMsixConfig } from './Config';
import { toMsixArch } from './util/arch';

export default class MakerMsix extends MakerBase<MakerMsixConfig> {
  name = 'msix';
  defaultPlatforms: ForgePlatform[] = ['win32'];

  isSupportedOnCurrentPlatform(): boolean {
    return process.platform === 'win32';
  }

  async make({
    dir,
    makeDir,
    targetArch,
    packageJSON,
    appName,
  }: MakerOptions): Promise<string[]> {
    const configManifestVariables = this.config.manifestVariables;
    const packageOptions = this.config;
    delete packageOptions.manifestVariables;

    const result = await packageMSIX({
      manifestVariables: {
        packageDescription: packageJSON.description,
        appExecutable: `${appName}.exe`,
        packageVersion: packageJSON.version,
        publisher: getNameFromAuthor(packageJSON.author),
        packageIdentity: appName,
        targetArch: toMsixArch(targetArch),
        ...configManifestVariables,
      },
      ...packageOptions,
      appDir: dir,
      outputDir: makeDir,
    });

    return [result.msixPackage];
  }
}