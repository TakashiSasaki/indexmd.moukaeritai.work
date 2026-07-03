import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PUBLIC_DIR = path.join(__dirname, '..', 'public');
const ICONS_DIR = path.join(PUBLIC_DIR, 'icons');
const SVG_PATH = path.join(PUBLIC_DIR, 'icon.svg');

if (!fs.existsSync(ICONS_DIR)) {
  fs.mkdirSync(ICONS_DIR, { recursive: true });
}

async function generate() {
  const svgBuffer = fs.readFileSync(SVG_PATH);

  // Favicons
  await sharp(svgBuffer).resize(16, 16).png().toFile(path.join(PUBLIC_DIR, 'favicon-16x16.png'));
  await sharp(svgBuffer).resize(32, 32).png().toFile(path.join(PUBLIC_DIR, 'favicon-32x32.png'));
  
  // Apple touch icon
  await sharp(svgBuffer).resize(180, 180).png().toFile(path.join(PUBLIC_DIR, 'apple-touch-icon.png'));

  // Android / PWA icons
  await sharp(svgBuffer).resize(192, 192).png().toFile(path.join(ICONS_DIR, 'icon-192.png'));
  await sharp(svgBuffer).resize(512, 512).png().toFile(path.join(ICONS_DIR, 'icon-512.png'));
  
  // Maskable icons (adding some padding to simulate maskable if the original svg isn't)
  await sharp(svgBuffer)
    .resize(192, 192, { fit: 'contain', background: { r: 79, g: 70, b: 229, alpha: 1 } }) // #4F46E5
    .png()
    .toFile(path.join(ICONS_DIR, 'maskable-192.png'));

  await sharp(svgBuffer)
    .resize(512, 512, { fit: 'contain', background: { r: 79, g: 70, b: 229, alpha: 1 } })
    .png()
    .toFile(path.join(ICONS_DIR, 'maskable-512.png'));

  // OG Image
  await sharp(svgBuffer)
    .resize(1200, 630, { fit: 'contain', background: { r: 248, g: 250, b: 252, alpha: 1 } }) // slate-50
    .png()
    .toFile(path.join(PUBLIC_DIR, 'og-image.png'));

  console.log('Icons generated successfully.');
}

generate().catch(console.error);
