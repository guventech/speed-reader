import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = join(__dirname, '..', 'public', 'icons')
mkdirSync(outDir, { recursive: true })

function crc32(buf) {
  let c = ~0
  for (let i = 0; i < buf.length; i += 1) {
    c ^= buf[i]
    for (let k = 0; k < 8; k += 1) {
      c = c & 1 ? (0xedb88320 ^ (c >>> 1)) : c >>> 1
    }
  }
  return ~c >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function solidPng(size, rgb) {
  const [r, g, b] = rgb
  const row = Buffer.alloc(1 + size * 3)
  for (let x = 0; x < size; x += 1) {
    const i = 1 + x * 3
    row[i] = r
    row[i + 1] = g
    row[i + 2] = b
  }
  // Draw a simple white "S" mark in the center using a thicker vertical + curves approx via bars
  const mid = Math.floor(size / 2)
  const thickness = Math.max(2, Math.floor(size / 16))
  const raw = Buffer.alloc((1 + size * 3) * size)
  for (let y = 0; y < size; y += 1) {
    row.copy(raw, y * row.length)
  }
  const setPixel = (x, y, color) => {
    if (x < 0 || y < 0 || x >= size || y >= size) return
    const offset = y * row.length + 1 + x * 3
    raw[offset] = color[0]
    raw[offset + 1] = color[1]
    raw[offset + 2] = color[2]
  }
  const white = [245, 240, 232]
  for (let y = Math.floor(size * 0.25); y < Math.floor(size * 0.75); y += 1) {
    for (let t = -thickness; t <= thickness; t += 1) {
      setPixel(mid + t, y, white)
    }
  }
  for (let x = Math.floor(size * 0.3); x < Math.floor(size * 0.7); x += 1) {
    for (let t = -thickness; t <= thickness; t += 1) {
      setPixel(x, Math.floor(size * 0.28) + t, white)
      setPixel(x, Math.floor(size * 0.72) + t, white)
    }
  }

  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

for (const size of [192, 512]) {
  const png = solidPng(size, [11, 110, 79])
  writeFileSync(join(outDir, `icon-${size}.png`), png)
}

console.log('Wrote icons to', outDir)
