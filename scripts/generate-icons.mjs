import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = resolve(__dirname, '..', 'public', 'icons')

function crc32(buf) {
  let crc = 0xffffffff
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    }
    table[n] = c
  }
  for (let i = 0; i < buf.length; i++) {
    crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeB, data])
  const crcB = Buffer.alloc(4)
  crcB.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, typeB, data, crcB])
}

function createPNG(size, r, g, b) {
  const rowSize = size * 3 + 1
  const rawData = Buffer.alloc(size * rowSize)
  for (let y = 0; y < size; y++) {
    rawData[y * rowSize] = 0
    for (let x = 0; x < size; x++) {
      const offset = y * rowSize + 1 + x * 3
      rawData[offset] = r
      rawData[offset + 1] = g
      rawData[offset + 2] = b
    }
  }
  const compressed = deflateSync(rawData)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', compressed),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

mkdirSync(OUT, { recursive: true })

const petrol = [0x12, 0x3F, 0x48]

for (const size of [16, 48, 128]) {
  writeFileSync(resolve(OUT, `icon-${size}.png`), createPNG(size, ...petrol))
  console.log(`Generated icon-${size}.png`)
}
