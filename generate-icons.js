// Generates icon-192.png and icon-512.png with no dependencies
// Run: node generate-icons.js
const zlib = require('zlib');
const fs   = require('fs');

// ── CRC32 ──────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

// ── PNG builder ─────────────────────────────────────────────
function pngChunk(type, data) {
  const t = Buffer.from(type, 'ascii');
  const d = Buffer.isBuffer(data) ? data : Buffer.from(data);
  const lenBuf = Buffer.allocUnsafe(4); lenBuf.writeUInt32BE(d.length);
  const crcVal = crc32(Buffer.concat([t, d]));
  const crcBuf = Buffer.allocUnsafe(4); crcBuf.writeUInt32BE(crcVal);
  return Buffer.concat([lenBuf, t, d, crcBuf]);
}

function makePNG(pixels, w, h) {
  // pixels: Buffer of length w*h*4 (RGBA)
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdr = Buffer.allocUnsafe(13);
  ihdr.writeUInt32BE(w, 0);
  ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;

  // Raw scanlines (each row prefixed with filter byte 0)
  const rowSize = w * 4;
  const raw = Buffer.allocUnsafe((rowSize + 1) * h);
  for (let y = 0; y < h; y++) {
    raw[y * (rowSize + 1)] = 0; // filter: None
    pixels.copy(raw, y * (rowSize + 1) + 1, y * rowSize, (y + 1) * rowSize);
  }

  const compressed = zlib.deflateSync(raw, { level: 6 });

  return Buffer.concat([
    sig,
    pngChunk('IHDR', ihdr),
    pngChunk('IDAT', compressed),
    pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Icon renderer ────────────────────────────────────────────
function generateIcon(size) {
  const w = size, h = size;
  const pixels = Buffer.alloc(w * h * 4, 0); // fully transparent

  // Colors
  const BG     = [0x07, 0x08, 0x0d, 0xff]; // #07080d
  const STROKE = [0x4f, 0x8e, 0xff, 0xff]; // #4f8eff

  function setPixel(x, y, rgba) {
    x = Math.round(x); y = Math.round(y);
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const i = (y * w + x) * 4;
    pixels[i] = rgba[0]; pixels[i+1] = rgba[1]; pixels[i+2] = rgba[2]; pixels[i+3] = rgba[3];
  }

  // Fill rounded rectangle (background)
  const r = Math.round(size * 0.208); // radius ~40 for 192px
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = Math.max(r, Math.min(w - 1 - r, x));
      const cy = Math.max(r, Math.min(h - 1 - r, y));
      const dx = x - cx, dy = y - cy;
      if (dx * dx + dy * dy <= r * r) setPixel(x, y, BG);
    }
  }

  // Draw thick line using circle stamps along path
  function drawLine(x0, y0, x1, y1, color, thickness) {
    const dx = x1 - x0, dy = y1 - y0;
    const steps = Math.ceil(Math.sqrt(dx * dx + dy * dy)) * 3;
    const rad = thickness / 2;
    for (let i = 0; i <= steps; i++) {
      const t = i / steps;
      const px = x0 + dx * t, py = y0 + dy * t;
      for (let cy = -rad; cy <= rad; cy += 0.5) {
        for (let cx = -rad; cx <= rad; cx += 0.5) {
          if (cx * cx + cy * cy <= rad * rad) setPixel(px + cx, py + cy, color);
        }
      }
    }
  }

  // Scale coordinates from 192-based reference
  const s = size / 192;
  const sw = Math.round(14 * s); // polyline stroke width
  const dw = Math.round(12 * s); // slash stroke width

  // Left <
  drawLine(68*s, 72*s,  44*s, 96*s,  STROKE, sw);
  drawLine(44*s, 96*s,  68*s, 120*s, STROKE, sw);
  // Right >
  drawLine(124*s, 72*s, 148*s, 96*s,  STROKE, sw);
  drawLine(148*s, 96*s, 124*s, 120*s, STROKE, sw);
  // Slash /
  drawLine(108*s, 66*s, 84*s, 126*s,  STROKE, dw);

  return makePNG(pixels, w, h);
}

// ── Write files ──────────────────────────────────────────────
fs.mkdirSync('icons', { recursive: true });
fs.writeFileSync('icons/icon-192.png', generateIcon(192));
console.log('✓ icons/icon-192.png');
fs.writeFileSync('icons/icon-512.png', generateIcon(512));
console.log('✓ icons/icon-512.png');
