const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);
const publicDir = path.join(__dirname, '..', 'public');


async function generateIcons() {
  await generateMacIcons();
  await generateWindowsIcons();
}

async function generateMacIcons() {
  const appIcon = path.join(publicDir, 'icon_app_mac.png');
  const installerIcon = path.join(publicDir, 'icon_installer_mac.png');

  await generateMacIconsFromSource(appIcon, 'icon');
  await generateMacIconsFromSource(installerIcon, 'icon_installer_mac');
}

async function generateWindowsIcons() {
  const appIcon = path.join(publicDir, 'icon_app_windows.png');
  const installerIcon = path.join(publicDir, 'icon_installer_windows.png');

  await generateWindowsIconsFromSource(appIcon, 'icon');
  await generateWindowsIconsFromSource(installerIcon, 'icon_installer_windows');
}

async function generateMacIconsFromSource(sourcePath, outputPrefix) {
  const generatedDir = createGeneratedDir();
  const iconsetDir = createIconsetDir(generatedDir, outputPrefix);

  console.log(`Generating ${outputPrefix} from ${path.basename(sourcePath)}`);

  await generateMacIconSizes(sourcePath, iconsetDir);
  await createIcnsFile(iconsetDir, generatedDir, outputPrefix);
  copySourcePng(sourcePath, generatedDir, outputPrefix);
  cleanupTempDir(iconsetDir);

  console.log(`Generated: ${outputPrefix}`);
  return true;
}

async function generateWindowsIconsFromSource(sourcePath, outputPrefix) {
  const generatedDir = createGeneratedDir();
  const iconsetDir = createIconsetDir(generatedDir, outputPrefix);

  console.log(`Generating ${outputPrefix} from ${path.basename(sourcePath)}`);

  await createWindowsIco(sourcePath, generatedDir, outputPrefix, iconsetDir);
  copySourcePng(sourcePath, generatedDir, outputPrefix);
  cleanupTempDir(iconsetDir);

  console.log(`Generated ${outputPrefix}`);
}

function createGeneratedDir() {
  const generatedDir = path.join(__dirname, '..', 'generated', 'icons');
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }
  return generatedDir;
}

function createIconsetDir(generatedDir, outputPrefix) {
  const iconsetDir = path.join(generatedDir, `${outputPrefix}.iconset`);
  if (!fs.existsSync(iconsetDir)) {
    fs.mkdirSync(iconsetDir, { recursive: true });
  }
  return iconsetDir;
}

async function generateMacIconSizes(sourcePath, iconsetDir) {
  const sizes = [
    { size: 16, name: 'icon_16x16.png' },
    { size: 32, name: 'icon_16x16@2x.png' },
    { size: 32, name: 'icon_32x32.png' },
    { size: 64, name: 'icon_32x32@2x.png' },
    { size: 128, name: 'icon_128x128.png' },
    { size: 256, name: 'icon_128x128@2x.png' },
    { size: 256, name: 'icon_256x256.png' },
    { size: 512, name: 'icon_256x256@2x.png' },
    { size: 512, name: 'icon_512x512.png' },
    { size: 1024, name: 'icon_512x512@2x.png' }
  ];

  for (const { size, name } of sizes) {
    await generateSingleIcon(sourcePath, iconsetDir, size, name);
  }
}

async function generateSingleIcon(sourcePath, iconsetDir, size, name) {
  const outputPath = path.join(iconsetDir, name);

  if (size === 1024) {
    await execAsync(`cp "${sourcePath}" "${outputPath}"`);
  } else {
    await execAsync(`sips -z ${size} ${size} "${sourcePath}" --out "${outputPath}"`);
  }
}

async function createIcnsFile(iconsetDir, generatedDir, outputPrefix) {
  const icnsPath = path.join(generatedDir, `${outputPrefix}.icns`);
  await execAsync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
  console.log(`Generated ${outputPrefix}.icns`);
}

async function createWindowsIco(sourcePath, generatedDir, outputPrefix, iconsetDir) {
  await generateIcoWithImageMagick(sourcePath, generatedDir, outputPrefix, iconsetDir);
}

async function generateIcoWithImageMagick(sourcePath, generatedDir, outputPrefix, iconsetDir) {
  const icoSizes = [16, 32, 48, 64, 128, 256];
  const tempFiles = await createTempIconFiles(sourcePath, iconsetDir, icoSizes);
  await combineIntoIco(tempFiles, generatedDir, outputPrefix);
  cleanupTempFiles(tempFiles);
}

async function createTempIconFiles(sourcePath, iconsetDir, icoSizes) {
  const tempFiles = [];

  for (const size of icoSizes) {
    const tempFile = path.join(iconsetDir, `temp_${size}.png`);
    await execAsync(`magick "${sourcePath}" -resize ${size}x${size} "${tempFile}"`);
    tempFiles.push(tempFile);
    console.log(`Generated ${size}x${size} icon`);
  }

  return tempFiles;
}

async function combineIntoIco(tempFiles, generatedDir, outputPrefix) {
  const icoPath = path.join(generatedDir, `${outputPrefix}.ico`);
  const tempFilesStr = tempFiles.map(f => `"${f}"`).join(' ');
  await execAsync(`magick ${tempFilesStr} "${icoPath}"`);
  console.log(`Generated ${outputPrefix}.ico`);
}

function cleanupTempFiles(tempFiles) {
  tempFiles.forEach(file => fs.unlinkSync(file));
}

function copySourcePng(sourcePath, generatedDir, outputPrefix) {
  const pngPath = path.join(generatedDir, `${outputPrefix}.png`);
  fs.copyFileSync(sourcePath, pngPath);
  console.log(`Copied ${outputPrefix}.png`);
}

function cleanupTempDir(iconsetDir) {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}

// Run if called directly
if (require.main === module) {
  generateIcons();
}

module.exports = { generateIcons };
