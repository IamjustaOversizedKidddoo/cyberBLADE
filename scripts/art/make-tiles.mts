/**
 * Generates NEON's texture tiles (paper grain, photocopy toner) as tiny grayscale+alpha PNGs.
 * Seeded, so re-running produces identical files. Run: npx tsx scripts/art/make-tiles.mts
 */
import fs from "node:fs";
import zlib from "node:zlib";

function rng(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const CRC = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf: Buffer) => {
  let c = 0xffffffff;
  for (const b of buf) c = CRC[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
function chunk(type: string, data: Buffer) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** Black pixels whose alpha follows `alpha(x, y)`: the tile darkens whatever it sits on (multiply). */
function png(size: number, alpha: (x: number, y: number) => number): Buffer {
  const raw = Buffer.alloc(size * (size * 2 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 2 + 1)] = 0;
    for (let x = 0; x < size; x++) {
      const o = y * (size * 2 + 1) + 1 + x * 2;
      raw[o] = 0;
      raw[o + 1] = Math.max(0, Math.min(255, Math.round(alpha(x, y))));
    }
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 4; // grayscale + alpha
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

const grain = rng(7);
const toner = rng(42);
const tiles = {
  // fine, even paper grain
  "grain.png": png(64, () => Math.floor(grain() * 8) * 9), // 8 levels: same look at low opacity, compresses well
  // sparse toner specks and streaks, like a tired photocopier
  "photocopy.png": png(64, (x) => (toner() > 0.93 ? 90 + toner() * 120 : x % 23 === 0 && toner() > 0.6 ? 60 : 0)),
};
for (const [name, buf] of Object.entries(tiles)) {
  fs.writeFileSync(`public/art/tiles/${name}`, buf);
  if (buf.length > 4096) throw new Error(`${name} is ${buf.length} bytes (> 4 KB budget)`);
  console.log(`${name}: ${buf.length} bytes`);
}
