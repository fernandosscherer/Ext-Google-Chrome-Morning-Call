import fs from 'node:fs'
import zlib from 'node:zlib'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SRC = path.resolve(__dirname, '..', 'extension', 'icons', 'logo-morningcall.png')
const OUT = path.resolve(__dirname, '..', 'extension', 'icons')
const SIZES = [16, 32, 48, 128]

/* PNG decode (color type 6 RGBA) */
function decodePNG(buf) {
  let off = 8
  let w, h, bd, ct, idat = []
  while (off < buf.length) {
    const len = buf.readUInt32BE(off)
    const type = buf.toString('ascii', off + 4, off + 8)
    const data = buf.slice(off + 8, off + 8 + len)
    if (type === 'IHDR') {
      w = data.readUInt32BE(0)
      h = data.readUInt32BE(4)
      bd = data[8]
      ct = data[9]
    }
    if (type === 'IDAT') idat.push(data)
    off += 12 + len
  }
  const raw = zlib.inflateSync(Buffer.concat(idat))
  const channels = ct === 6 ? 4 : ct === 2 ? 3 : 1
  const stride = w * channels
  const out = Buffer.alloc(h * stride)
  let pos = 0
  for (let y = 0; y < h; y++) {
    const filter = raw[pos++]
    const row = raw.slice(pos, pos + stride)
    pos += stride
    const prev = y > 0 ? out.slice((y - 1) * stride, y * stride) : Buffer.alloc(stride)
    const cur = Buffer.alloc(stride)
    for (let x = 0; x < stride; x++) {
      const a = x >= channels ? cur[x - channels] : 0
      const b = prev[x]
      const c = x >= channels ? prev[x - channels] : 0
      let val = row[x]
      if (filter === 1) val = (val + a) & 255
      else if (filter === 2) val = (val + b) & 255
      else if (filter === 3) val = (val + ((a + b) >> 1)) & 255
      else if (filter === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        val = (val + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      }
      cur[x] = val
    }
    cur.copy(out, y * stride)
  }
  return { width: w, height: h, channels, data: out }
}

/* Bilinear scale */
function scaleImage(src, srcW, srcH, channels, dstW, dstH) {
  const dstStride = dstW * channels
  const dst = Buffer.alloc(dstH * dstStride)
  for (let dy = 0; dy < dstH; dy++) {
    const sy = (dy + 0.5) * srcH / dstH - 0.5
    const y0 = Math.max(0, Math.min(srcH - 1, Math.floor(sy)))
    const y1 = Math.min(srcH - 1, y0 + 1)
    const ty = sy - y0
    for (let dx = 0; dx < dstW; dx++) {
      const sx = (dx + 0.5) * srcW / dstW - 0.5
      const x0 = Math.max(0, Math.min(srcW - 1, Math.floor(sx)))
      const x1 = Math.min(srcW - 1, x0 + 1)
      const tx = sx - x0
      for (let c = 0; c < channels; c++) {
        const v00 = src[(y0 * srcW + x0) * channels + c]
        const v10 = src[(y0 * srcW + x1) * channels + c]
        const v01 = src[(y1 * srcW + x0) * channels + c]
        const v11 = src[(y1 * srcW + x1) * channels + c]
        const v0 = v00 * (1 - tx) + v10 * tx
        const v1 = v01 * (1 - tx) + v11 * tx
        const v = Math.round(v0 * (1 - ty) + v1 * ty)
        dst[dy * dstStride + dx * channels + c] = Math.max(0, Math.min(255, v))
      }
    }
  }
  return dst
}

/* Crop to content bbox from source decoded data */
function cropToContent(src, srcW, srcH, channels) {
  let minX = srcW, minY = srcH, maxX = -1, maxY = -1
  for (let y = 0; y < srcH; y++) {
    for (let x = 0; x < srcW; x++) {
      const a = src[(y * srcW + x) * channels + 3]
      if (a >= 16) {
        if (x < minX) minX = x
        if (y < minY) minY = y
        if (x > maxX) maxX = x
        if (y > maxY) maxY = y
      }
    }
  }
  if (maxX < 0) return { data: src, width: srcW, height: srcH }
  const cw = maxX - minX + 1
  const ch = maxY - minY + 1
  const out = Buffer.alloc(cw * ch * channels)
  for (let y = 0; y < ch; y++) {
    for (let x = 0; x < cw; x++) {
      const si = ((minY + y) * srcW + (minX + x)) * channels
      const di = (y * cw + x) * channels
      out[di] = src[si]
      out[di + 1] = src[si + 1]
      out[di + 2] = src[si + 2]
      out[di + 3] = src[si + 3]
    }
  }
  return { data: out, width: cw, height: ch }
}

/* Rounded corner mask */
function applyRoundedCorners(img, w, h, r) {
  const out = Buffer.from(img)
  const rr = r * r
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let dx = 0, dy = 0
      if (x < r) dx = r - x
      else if (x >= w - r) dx = x - (w - r) + 1
      if (y < r) dy = r - y
      else if (y >= h - r) dy = y - (h - r) + 1
      if (dx > 0 || dy > 0) {
        if (dx * dx + dy * dy > rr) {
          const i = (y * w + x) * 4 + 3
          out[i] = 0
        }
      }
    }
  }
  return out
}

/* PNG encode (same as generate-icons.mjs) */
function crc32(buf) {
  let crc = 0xffffffff
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1)
    table[n] = c
  }
  for (let i = 0; i < buf.length; i++) crc = table[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8)
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const typeB = Buffer.from(type, 'ascii')
  const crcData = Buffer.concat([typeB, data])
  const crcB = Buffer.alloc(4); crcB.writeUInt32BE(crc32(crcData))
  return Buffer.concat([len, typeB, data, crcB])
}

function encodePNG(img, w, h) {
  const rowSize = w * 4 + 1
  const raw = Buffer.alloc(h * rowSize)
  for (let y = 0; y < h; y++) {
    raw[y * rowSize] = 0
    for (let x = 0; x < w; x++) {
      const si = (y * w + x) * 4
      const di = y * rowSize + 1 + x * 4
      raw[di] = img[si]
      raw[di + 1] = img[si + 1]
      raw[di + 2] = img[si + 2]
      raw[di + 3] = img[si + 3]
    }
  }
  const compressed = zlib.deflateSync(raw)
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6
  return Buffer.concat([signature, chunk('IHDR', ihdr), chunk('IDAT', compressed), chunk('IEND', Buffer.alloc(0))])
}

/* Main */
const srcBuf = fs.readFileSync(SRC)
const src = decodePNG(srcBuf)
console.log(`Decoded ${src.width}x${src.height} ${src.channels}ch`)

/* Crop to opaque content */
const cropped = cropToContent(src.data, src.width, src.height, src.channels)
console.log(`Cropped to ${cropped.width}x${cropped.height}`)

const DARK = { r: 0x0C, g: 0x14, b: 0x1C } // #0C141C

for (const size of SIZES) {
  const padding = Math.max(1, Math.round(size * 0.06))
  const radius = Math.max(1, Math.round(size * 0.25))
  const inner = size - 2 * padding
  const scale = Math.min(inner / cropped.width, inner / cropped.height)
  const dstW = Math.max(1, Math.round(cropped.width * scale))
  const dstH = Math.max(1, Math.round(cropped.height * scale))

  const scaled = scaleImage(cropped.data, cropped.width, cropped.height, 4, dstW, dstH)

  /* Create canvas with dark background */
  const canvas = Buffer.alloc(size * size * 4)
  for (let i = 0; i < size * size; i++) {
    canvas[i * 4] = DARK.r
    canvas[i * 4 + 1] = DARK.g
    canvas[i * 4 + 2] = DARK.b
    canvas[i * 4 + 3] = 255
  }

  /* Center composite scaled logo */
  const offX = Math.floor((size - dstW) / 2)
  const offY = Math.floor((size - dstH) / 2)
  for (let y = 0; y < dstH; y++) {
    for (let x = 0; x < dstW; x++) {
      const si = (y * dstW + x) * 4
      const di = ((offY + y) * size + (offX + x)) * 4
      const sa = scaled[si + 3] / 255
      if (sa > 0) {
        const dr = canvas[di], dg = canvas[di + 1], db = canvas[di + 2], da = canvas[di + 3] / 255
        const sr = scaled[si], sg = scaled[si + 1], sb = scaled[si + 2]
        const oa = sa + da * (1 - sa)
        if (oa > 0) {
          canvas[di] = Math.round((sr * sa + dr * da * (1 - sa)) / oa)
          canvas[di + 1] = Math.round((sg * sa + dg * da * (1 - sa)) / oa)
          canvas[di + 2] = Math.round((sb * sa + db * da * (1 - sa)) / oa)
          canvas[di + 3] = Math.round(oa * 255)
        }
      }
    }
  }

  /* Rounded corners */
  const rounded = applyRoundedCorners(canvas, size, size, radius)

  /* Encode */
  const png = encodePNG(rounded, size, size)
  fs.writeFileSync(path.join(OUT, `${size}.png`), png)
  console.log(`Generated ${size}.png (inner ${dstW}x${dstH}, radius ${radius})`)
}