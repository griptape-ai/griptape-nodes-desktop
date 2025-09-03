const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

async function generateIconsFromSource(sourcePath, outputPrefix) {
  const generatedDir = path.join(__dirname, '..', 'generated', 'icons');
  const iconsetDir = path.join(generatedDir, `${outputPrefix}.iconset`);
  
  // Ensure generated directory exists
  if (!fs.existsSync(generatedDir)) {
    fs.mkdirSync(generatedDir, { recursive: true });
  }

  // Check if source icon exists
  if (!fs.existsSync(sourcePath)) {
    console.error(`❌ Source icon not found at ${sourcePath}`);
    return false;
  }

  console.log(`🎨 Generating ${outputPrefix} icons from ${path.basename(sourcePath)}...`);

  try {
    // Create iconset directory
    if (!fs.existsSync(iconsetDir)) {
      fs.mkdirSync(iconsetDir, { recursive: true });
    }

    // Generate different sizes for macOS .icns
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

    // Check platform
    const platform = process.platform;

    if (platform === 'darwin') {
      // macOS - use sips and iconutil
      console.log('📱 Generating macOS icons...');
      
      for (const { size, name } of sizes) {
        const outputPath = path.join(iconsetDir, name);
        if (size === 1024) {
          // Copy the original for the largest size
          await execAsync(`cp "${sourcePath}" "${outputPath}"`);
        } else {
          // Resize for other sizes
          await execAsync(`sips -z ${size} ${size} "${sourcePath}" --out "${outputPath}"`);
        }
        console.log(`  ✓ Generated ${name}`);
      }

      // Generate .icns file
      const icnsPath = path.join(generatedDir, `${outputPrefix}.icns`);
      await execAsync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
      console.log(`  ✓ Generated ${outputPrefix}.icns`);

    } else if (platform === 'linux') {
      // Linux - use ImageMagick if available
      console.log('🐧 Generating Linux icons...');
      
      try {
        await execAsync('which convert');
        // ImageMagick is available
        for (const { size, name } of sizes) {
          const outputPath = path.join(iconsetDir, name);
          await execAsync(`convert "${sourcePath}" -resize ${size}x${size} "${outputPath}"`);
          console.log(`  ✓ Generated ${name}`);
        }
      } catch (error) {
        console.log('  ⚠️  ImageMagick not found. Install it for better icon generation.');
        console.log('  Using fallback: copying original icon...');
        // Fallback: just copy the original
        for (const { size, name } of sizes) {
          const outputPath = path.join(iconsetDir, name);
          fs.copyFileSync(sourcePath, outputPath);
        }
      }

    } else if (platform === 'win32') {
      // Windows
      console.log('🪟 Generating Windows icons...');
      console.log('  ℹ️  On Windows, .ico generation requires additional tools.');
      console.log('  Using PNG fallback for now...');
    }

    // Copy source PNG to generated folder
    const pngPath = path.join(generatedDir, `${outputPrefix}.png`);
    fs.copyFileSync(sourcePath, pngPath);
    console.log(`  ✓ Copied ${outputPrefix}.png`);
    
    // Copy source as .ico for Windows (simple fallback)
    const icoPath = path.join(generatedDir, `${outputPrefix}.ico`);
    fs.copyFileSync(sourcePath, icoPath);
    console.log(`  ✓ Created ${outputPrefix}.ico (PNG format)`);

    // Clean up iconset directory if not on macOS (since we don't need it)
    if (platform !== 'darwin') {
      fs.rmSync(iconsetDir, { recursive: true, force: true });
    }

    console.log(`✅ ${outputPrefix} icon generation complete!`);
    return true;

  } catch (error) {
    console.error(`❌ Error generating ${outputPrefix} icons:`, error.message);
    return false;
  }
}

async function generateIcons() {
  const publicDir = path.join(__dirname, '..', 'public');
  
  // Generate app icons
  const appIcon = path.join(publicDir, 'icon.png');
  const appSuccess = await generateIconsFromSource(appIcon, 'icon');
  
  // Generate installer icons
  const installerIcon = path.join(publicDir, 'icon_installer.png');
  const installerSuccess = await generateIconsFromSource(installerIcon, 'icon_installer');
  
  if (!appSuccess || !installerSuccess) {
    process.exit(1);
  }
  
  console.log('✅ All icons generated successfully!');
}

// Run if called directly
if (require.main === module) {
  generateIcons();
}

module.exports = { generateIcons };