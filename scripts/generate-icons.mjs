// Erzeugt die App-Icons (PNG) ohne externe Abhängigkeiten.
// Motiv: ruhiger, offener Kreis (Ensō) auf dunklem Grün.
import { writeFileSync, mkdirSync } from 'node:fs';
import { deflateSync } from 'node:zlib';

const BG = [0x1f, 0x3d, 0x2b];
const FG = [0xd9, 0xe8, 0xd4];
const OUT = new URL('../public/', import.meta.url);
mkdirSync(OUT, { recursive: true });

const crcTable = new Uint32Array(256).map((_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
function png(size, pixel) {
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const [r, g, b, a] = pixel(x + 0.5, y + 0.5, size);
      const o = y * (size * 4 + 1) + 1 + x * 4;
      raw[o] = r; raw[o + 1] = g; raw[o + 2] = b; raw[o + 3] = a;
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

const clamp = (v) => Math.max(0, Math.min(1, v));
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));

/** Ring mit Lücke oben rechts; scale = Radius relativ zur Bildgröße */
function ensoCoverage(x, y, size, scale) {
  const cx = size / 2, cy = size / 2;
  const dx = x - cx, dy = y - cy;
  const d = Math.hypot(dx, dy);
  const R = size * scale;
  const ang = Math.atan2(dy, dx); // -PI..PI, 0 = rechts
  // Strichstärke variiert leicht entlang des Kreises (Pinselcharakter)
  const t = (ang + Math.PI) / (2 * Math.PI);
  const w = size * scale * (0.16 + 0.07 * Math.sin(t * Math.PI));
  let cov = clamp(w / 2 - Math.abs(d - R) + 0.5);
  // Lücke zwischen ca. -70° und -35°
  const gapStart = -1.22, gapEnd = -0.62;
  if (ang > gapStart && ang < gapEnd) {
    const edge = Math.min(ang - gapStart, gapEnd - ang) * R;
    cov *= clamp(1 - edge / 2);
  }
  return cov;
}

function roundedMask(x, y, size, radius) {
  const r = size * radius;
  const qx = Math.max(Math.abs(x - size / 2) - (size / 2 - r), 0);
  const qy = Math.max(Math.abs(y - size / 2) - (size / 2 - r), 0);
  return clamp(r - Math.hypot(qx, qy) + 0.5);
}

const anyIcon = (x, y, size) => {
  const c = ensoCoverage(x, y, size, 0.3);
  const [r, g, b] = mix(BG, FG, c);
  return [r, g, b, Math.round(255 * roundedMask(x, y, size, 0.22))];
};
const maskableIcon = (x, y, size) => {
  const c = ensoCoverage(x, y, size, 0.24);
  return [...mix(BG, FG, c), 255];
};

writeFileSync(new URL('icon-192.png', OUT), png(192, anyIcon));
writeFileSync(new URL('icon-512.png', OUT), png(512, anyIcon));
writeFileSync(new URL('maskable-512.png', OUT), png(512, maskableIcon));
writeFileSync(new URL('apple-touch-icon.png', OUT), png(180, maskableIcon));
writeFileSync(
  new URL('favicon.svg', OUT),
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><rect width="64" height="64" rx="14" fill="#1f3d2b"/><path d="M44.5 17.5A19 19 0 1 0 51 32" fill="none" stroke="#d9e8d4" stroke-width="6" stroke-linecap="round"/></svg>\n`,
);
console.log('Icons erzeugt in public/');
