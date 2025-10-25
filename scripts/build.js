import { build } from 'vite';
import { copyFileSync, mkdirSync, existsSync } from 'fs';
import { resolve } from 'path';

async function buildExtension() {
  console.log('🚀 Building ScriptFlow...\n');
  
  // Build with Vite
  await build();
  
  // Ensure dist directory exists
  if (!existsSync('dist')) {
    mkdirSync('dist', { recursive: true });
  }
  
  // Copy manifest
  console.log('📦 Copying manifest.json...');
  copyFileSync(
    resolve('manifest.json'),
    resolve('dist/manifest.json')
  );
  
  // Copy icons
  console.log('🎨 Copying icons...');
  mkdirSync('dist/icons', { recursive: true });
  
  const iconSizes = [16, 32, 48, 128];
  for (const size of iconSizes) {
    const iconFile = `icon-${size}.png`;
    copyFileSync(
      resolve(`public/icons/${iconFile}`),
      resolve(`dist/icons/${iconFile}`)
    );
  }
  
  console.log('\n✅ Build complete! Load dist/ folder in Chrome\n');
}

buildExtension().catch(console.error);