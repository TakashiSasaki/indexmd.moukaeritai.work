import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

const dir = 'public/visual-samples';

async function convert() {
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.svg'));
  for (const f of files) {
    const svgPath = path.join(dir, f);
    const pngPath = path.join(dir, f.replace('.svg', '.png'));
    console.log(`Converting ${f} to png...`);
    await sharp(svgPath)
      .png()
      .toFile(pngPath);
    console.log(`Done: ${pngPath}`);
  }
}

convert().catch(console.error);
