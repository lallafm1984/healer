// src/art/app-icon.svg → Android legacy/adaptive launcher resources.
// npm run icons:build (Playwright Chromium 필요). 원본 색상과 투명도를 유지한다.
import { chromium } from 'playwright';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { crc32, deflateSync } from 'node:zlib';

// Encode straight RGBA so alpha edges do not introduce extra RGB colors.
function png(width, height, pixels) {
  const chunk = (type, data) => {
    const tag = Buffer.from(type), result = Buffer.alloc(data.length + 12);
    result.writeUInt32BE(data.length, 0); tag.copy(result, 4); data.copy(result, 8);
    result.writeUInt32BE(crc32(Buffer.concat([tag, data])), data.length + 8);
    return result;
  };
  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  const rows = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) pixels.copy(rows, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', header), chunk('IDAT', deflateSync(rows, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const res = join(root, 'android/app/src/main/res');
const svg = readFileSync(join(root, 'src/art/app-icon.svg'), 'utf8');
const [, , width, height] = svg.match(/viewBox="([^"]+)"/)[1].split(/\s+/).map(Number);
if (width !== height) throw new Error('App icon must be square');
const inner = svg.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
const background = svg.match(/<rect[^>]*fill="(#[0-9a-f]{6})"/i)[1];
const paths = [...svg.matchAll(/<path fill="(#[0-9a-f]{6})"[^>]* d="([^"]+)"\/>/gi)];
if (paths.length !== 4) throw new Error('Expected the approved four-color foreground');
const palette = [...new Set([background, ...paths.map(p => p[1])])];
if (palette.length > 5) throw new Error('App icon exceeds five colors');
const scale = 72 / width;
const foreground = paths.map(p => p[0]).join('');
const shell = content => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}">${content}</svg>`;
const masked = shape => shell(`<defs><clipPath id="mask">${shape}</clipPath></defs><g clip-path="url(#mask)">${inner}</g>`);
const rounded = masked(`<rect width="${width}" height="${height}" rx="${width * .22}"/>`);
const round = masked(`<circle cx="${width / 2}" cy="${height / 2}" r="${width / 2}"/>`);
// 108dp adaptive layer: central 72dp matches the approved full icon preview.
// The party/healer remain in the central safe area; wing tips are decoration.
const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="108" height="108"><g transform="translate(18 18) scale(${scale})">${foreground}</g></svg>`;
const densities = [['mdpi', 1], ['hdpi', 1.5], ['xhdpi', 2], ['xxhdpi', 3], ['xxxhdpi', 4]];
const colorFile = join(res, 'values/ic_launcher_background.xml');
const splashBackground = readFileSync(colorFile, 'utf8').match(/<color name="splash_background">([^<]+)</)[1];
const browser = await chromium.launch();
try {
  const page = await browser.newPage();
  const render = async (source, width, height, inks, destination) => {
    const result = await page.evaluate(async ({ source, width, height, inks }) => {
      const image = new Image();
      image.src = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(source)))}`;
      await image.decode();
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(image, 0, 0, width, height);
      const pixels = ctx.getImageData(0, 0, width, height);
      const colors = inks.map(c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)));
      const cache = new Map();
      for (let i = 0; i < pixels.data.length; i += 4) {
        if (!pixels.data[i + 3]) { pixels.data.set(colors[0], i); continue; }
        const [r, g, b] = pixels.data.subarray(i, i + 3), key = (r << 16) | (g << 8) | b;
        let nearest = cache.get(key);
        if (!nearest) {
          nearest = colors.reduce((best, color) => {
            const distance = color.reduce((sum, value, channel) => sum + (value - [r, g, b][channel]) ** 2, 0);
            return distance < best.distance ? { distance, color } : best;
          }, { distance: Infinity }).color;
          cache.set(key, nearest);
        }
        pixels.data.set(nearest, i);
      }
      let binary = '';
      for (let i = 0; i < pixels.data.length; i += 8192) binary += String.fromCharCode(...pixels.data.subarray(i, i + 8192));
      return btoa(binary);
    }, { source, width, height, inks });
    writeFileSync(destination, png(width, height, Buffer.from(result, 'base64')));
  };
  for (const [density, ratio] of densities) {
    for (const [name, source, dp, inks] of [
      ['ic_launcher', rounded, 48, palette],
      ['ic_launcher_round', round, 48, palette],
      ['ic_launcher_foreground', adaptive, 108, paths.map(p => p[1])],
    ]) {
      const size = Math.round(dp * ratio);
      await render(source, size, size, inks, join(res, `mipmap-${density}/${name}.png`));
    }
  }
  // Older Android launch screens also contained the former priest emblem.
  const splashSizes = [
    ['drawable', 480, 320, 1],
    ['drawable-land-mdpi', 480, 320, 1], ['drawable-land-hdpi', 800, 480, 1.5],
    ['drawable-land-xhdpi', 1280, 720, 2], ['drawable-land-xxhdpi', 1600, 960, 3], ['drawable-land-xxxhdpi', 1920, 1280, 4],
    ['drawable-port-mdpi', 320, 480, 1], ['drawable-port-hdpi', 480, 800, 1.5],
    ['drawable-port-xhdpi', 720, 1280, 2], ['drawable-port-xxhdpi', 960, 1600, 3], ['drawable-port-xxxhdpi', 1280, 1920, 4],
  ];
  const roundedInner = rounded.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');
  for (const [folder, w, h, ratio] of splashSizes) {
    const side = 96 * ratio;
    const source = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}"><rect width="${w}" height="${h}" fill="${splashBackground}"/><g transform="translate(${(w - side) / 2} ${(h - side) / 2}) scale(${side / width})">${roundedInner}</g></svg>`;
    await render(source, w, h, [...palette, splashBackground], join(res, folder, 'splash.png'));
  }
} finally {
  await browser.close();
}

// Keep the drawable fallback consistent with the PNG foreground.
const vectorPaths = paths.map(p => `        <path android:fillColor="${p[1]}" android:fillType="evenOdd" android:pathData="${p[2]}"/>`).join('\n');
writeFileSync(join(res, 'drawable-v24/ic_launcher_foreground.xml'), `<?xml version="1.0" encoding="utf-8"?>\n<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="108dp" android:height="108dp" android:viewportWidth="108" android:viewportHeight="108">\n    <group android:translateX="18" android:translateY="18" android:scaleX="${scale}" android:scaleY="${scale}">\n${vectorPaths}\n    </group>\n</vector>\n`);
writeFileSync(join(res, 'drawable/ic_launcher_background.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<shape xmlns:android="http://schemas.android.com/apk/res/android" android:shape="rectangle">\n    <solid android:color="@color/ic_launcher_background"/>\n</shape>\n');
const colorsFile = join(res, 'values/ic_launcher_background.xml');
writeFileSync(colorsFile, readFileSync(colorsFile, 'utf8').replace(/(<color name="ic_launcher_background">)[^<]+/, `$1${background}`));
console.log('Updated 15 Android launcher PNGs, 11 launch screens, foreground fallback and background from src/art/app-icon.svg');
