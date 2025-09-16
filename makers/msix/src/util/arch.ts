import { MsixArch } from 'electron-windows-msix';

/**
 * Converts an Electron architecture string to an MSIX architecture.
 * @param arch The Electron architecture string
 * @returns The corresponding MSIX architecture
 */
export function toMsixArch(arch: string): MsixArch {
  const validArchitectures = ['x64', 'arm64'];

  if (arch === 'ia32') {
    return 'x86';
  }

  if (validArchitectures.includes(arch)) {
    return arch as MsixArch;
  }

  throw new Error(
    `Invalid architecture: ${arch}. Must be one of: ${validArchitectures.join(', ')}, ia32`
  );
}