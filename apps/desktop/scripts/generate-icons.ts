/**
 * Copyright 2026-present Termlnk
 *
 * Licensed under the PolyForm Noncommercial License 1.0.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     https://polyformproject.org/licenses/noncommercial/1.0.0
 *
 * Use of this software for any commercial purpose is prohibited.
 * The software is provided "AS IS", WITHOUT WARRANTY OR CONDITION OF ANY KIND,
 * either express or implied. See the License for the specific language
 * governing permissions and limitations under the License.
 */

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import process from 'node:process';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'pathe';
import png2icons from 'png2icons';
import sharp from 'sharp';

const __dirname = dirname(fileURLToPath(import.meta.url));
const resourcesDir = resolve(__dirname, '../resources');
const iconsDir = resolve(resourcesDir, 'icons');
const staticDir = resolve(__dirname, '../static');

// Union of all platform-required sizes:
//   macOS .icns  → 16, 32, 64, 128, 256, 512, 1024
//   Windows .ico → 16, 24, 32, 48, 64, 128, 256
//   Linux PNG    → 16, 24, 32, 48, 64, 128, 256, 512, 1024
const PNG_SIZES = [16, 24, 32, 48, 64, 128, 256, 512, 1024] as const;

function createDmgBackgroundSvg(width: number, height: number): string {
  const centerY = height / 2;
  const leftCardX = width * 0.2;
  const rightCardX = width * 0.68;
  const cardY = height * 0.28;
  const cardWidth = width * 0.16;
  const cardHeight = height * 0.28;
  const arrowLeft = width * 0.43;
  const arrowRight = width * 0.57;
  const arrowMidY = centerY;
  const arrowTop = centerY - height * 0.045;
  const arrowBottom = centerY + height * 0.045;
  const arrowTipX = width * 0.61;
  const arrowBaseX = width * 0.54;
  const titleY = height * 0.16;
  const subtitleY = height * 0.21;

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="${width}" y2="${height}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#F8FAFD" />
          <stop offset="100%" stop-color="#EEF3FA" />
        </linearGradient>
        <radialGradient id="glow-left" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(${width * 0.28} ${height * 0.72}) rotate(90) scale(${height * 0.44} ${width * 0.34})">
          <stop offset="0%" stop-color="#5DA8FF" stop-opacity="0.18" />
          <stop offset="100%" stop-color="#5DA8FF" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glow-right" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse"
          gradientTransform="translate(${width * 0.72} ${height * 0.28}) rotate(90) scale(${height * 0.42} ${width * 0.3})">
          <stop offset="0%" stop-color="#7BD5FF" stop-opacity="0.12" />
          <stop offset="100%" stop-color="#7BD5FF" stop-opacity="0" />
        </radialGradient>
        <linearGradient id="arrow" x1="${arrowLeft}" y1="${arrowMidY}" x2="${arrowTipX}" y2="${arrowMidY}" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stop-color="#2D3648" />
          <stop offset="100%" stop-color="#0F172A" />
        </linearGradient>
      </defs>

      <rect width="${width}" height="${height}" rx="${Math.round(height * 0.04)}" fill="url(#bg)" />
      <rect width="${width}" height="${height}" rx="${Math.round(height * 0.04)}" fill="url(#glow-left)" />
      <rect width="${width}" height="${height}" rx="${Math.round(height * 0.04)}" fill="url(#glow-right)" />

      <text x="${width / 2}" y="${titleY}" text-anchor="middle" font-size="${Math.round(height * 0.06)}" font-family="SF Pro Display, Helvetica, Arial, sans-serif" font-weight="700" fill="#0F172A">
        Install Termlnk
      </text>
      <text x="${width / 2}" y="${subtitleY}" text-anchor="middle" font-size="${Math.round(height * 0.032)}" font-family="SF Pro Text, Helvetica, Arial, sans-serif" font-weight="500" fill="#5B6474">
        Drag the app into Applications
      </text>

      <rect x="${leftCardX - cardWidth / 2}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${Math.round(width * 0.03)}" fill="#FFFFFF" fill-opacity="0.72" stroke="#D9E2EF" />
      <rect x="${rightCardX - cardWidth / 2}" y="${cardY}" width="${cardWidth}" height="${cardHeight}" rx="${Math.round(width * 0.03)}" fill="#FFFFFF" fill-opacity="0.64" stroke="#D9E2EF" />

      <path d="M ${arrowLeft} ${arrowTop} H ${arrowBaseX} V ${arrowTop - height * 0.06} L ${arrowTipX} ${arrowMidY} L ${arrowBaseX} ${arrowBottom + height * 0.06} V ${arrowBottom} H ${arrowLeft} Z" fill="url(#arrow)" />

      <circle cx="${leftCardX}" cy="${cardY + cardHeight + height * 0.09}" r="${Math.round(height * 0.012)}" fill="#5DA8FF" fill-opacity="0.75" />
      <circle cx="${rightCardX}" cy="${cardY + cardHeight + height * 0.09}" r="${Math.round(height * 0.012)}" fill="#7BD5FF" fill-opacity="0.75" />
    </svg>
  `.trim();
}

async function generateIcons() {
  const svgBuffer = readFileSync(resolve(resourcesDir, 'logo.svg'));

  // Render SVG at native 1024×1024
  const png1024 = await sharp(svgBuffer, { density: 72 }).png().toBuffer();

  // --- Individual PNGs (for Linux .desktop, tray, etc.) ---
  mkdirSync(iconsDir, { recursive: true });
  await Promise.all(
    PNG_SIZES.map(async (size) => {
      const buf = size === 1024
        ? png1024
        : await sharp(png1024).resize(size, size).png().toBuffer();
      writeFileSync(resolve(iconsDir, `${size}x${size}.png`), buf);
    })
  );
  console.log(`Generated PNG set: ${PNG_SIZES.map((s) => `${s}x${s}`).join(', ')}`);

  // --- icon.png — 512×512 for Electron Forge (Linux) ---
  writeFileSync(
    resolve(resourcesDir, 'icon.png'),
    readFileSync(resolve(iconsDir, '512x512.png'))
  );
  console.log('Generated icon.png (512×512)');

  // --- icon.icns — macOS (sizes: 16 → 1024, BICUBIC scaling) ---
  const icns = png2icons.createICNS(png1024, png2icons.BICUBIC, 0);
  if (!icns) {
    console.error('Failed to generate icon.icns');
    process.exit(1);
  }
  writeFileSync(resolve(resourcesDir, 'icon.icns'), icns);
  console.log('Generated icon.icns');

  // --- icon.ico — Windows (sizes: 16 → 256, BICUBIC scaling) ---
  const ico = png2icons.createICO(png1024, png2icons.BICUBIC, 0, true);
  if (!ico) {
    console.error('Failed to generate icon.ico');
    process.exit(1);
  }
  writeFileSync(resolve(resourcesDir, 'icon.ico'), ico);
  console.log('Generated icon.ico');

  // --- DMG assets (macOS installer window) ---
  mkdirSync(staticDir, { recursive: true });
  writeFileSync(resolve(staticDir, 'dmg-icon.icns'), icns);
  console.log('Generated dmg-icon.icns');

  const dmgBackground = await sharp(Buffer.from(createDmgBackgroundSvg(660, 400))).png().toBuffer();
  writeFileSync(resolve(staticDir, 'dmg-background.png'), dmgBackground);
  console.log('Generated dmg-background.png (660x400)');

  const dmgBackground2x = await sharp(Buffer.from(createDmgBackgroundSvg(1320, 800))).png().toBuffer();
  writeFileSync(resolve(staticDir, 'dmg-background@2x.png'), dmgBackground2x);
  console.log('Generated dmg-background@2x.png (1320x800)');

  // --- Tray icons (colored app icon for system tray) ---
  const trayPng256 = await sharp(png1024).resize(256, 256).png().toBuffer();
  writeFileSync(resolve(resourcesDir, 'icon-tray.png'), trayPng256);
  console.log('Generated icon-tray.png (256×256)');

  const trayIco = png2icons.createICO(trayPng256, png2icons.BICUBIC, 0, true);
  if (!trayIco) {
    console.error('Failed to generate icon-tray.ico');
    process.exit(1);
  }
  writeFileSync(resolve(resourcesDir, 'icon-tray.ico'), trayIco);
  console.log('Generated icon-tray.ico');

  console.log('\nAll icons generated successfully!');
}

generateIcons().catch((err) => {
  console.error(err);
  process.exit(1);
});
