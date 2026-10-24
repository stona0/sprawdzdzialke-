// Generuje ikony z src/app/icon.svg (jedno źródło znaku; Next podaje je też jako <link rel="icon">):
//   src/app/favicon.ico    — 16/32/48 px (PNG w kontenerze ICO; Safari i /favicon.ico z wyszukiwarek)
//   src/app/apple-icon.png — 180 px, bez zaokrągleń (iOS zaokrągla sam, przezroczyste rogi byłyby czarne)
//   public/logo.png        — 512 px, logo organizacji w JSON-LD
//
//   node scripts/assets/build-icons.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import sharp from 'sharp'

const root = path.resolve(import.meta.dirname, '../..')
const svg = readFileSync(path.join(root, 'src/app/icon.svg'), 'utf8')
const square = svg.replace(/ rx="\d+"/, '')

const png = (source, size) =>
  sharp(Buffer.from(source), { density: (72 * size) / 32 }).resize(size, size).png().toBuffer()

function ico(images) {
  const header = Buffer.alloc(6 + 16 * images.length)
  header.writeUInt16LE(0, 0)
  header.writeUInt16LE(1, 2) // typ: ikona
  header.writeUInt16LE(images.length, 4)
  let offset = header.length
  images.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i
    header.writeUInt8(size >= 256 ? 0 : size, e)
    header.writeUInt8(size >= 256 ? 0 : size, e + 1)
    header.writeUInt16LE(1, e + 4) // płaszczyzny
    header.writeUInt16LE(32, e + 6) // bity na piksel
    header.writeUInt32LE(data.length, e + 8)
    header.writeUInt32LE(offset, e + 12)
    offset += data.length
  })
  return Buffer.concat([header, ...images.map(i => i.data)])
}

const sizes = [16, 32, 48]
const icons = await Promise.all(sizes.map(async size => ({ size, data: await png(svg, size) })))
writeFileSync(path.join(root, 'src/app/favicon.ico'), ico(icons))
writeFileSync(path.join(root, 'src/app/apple-icon.png'), await png(square, 180))
writeFileSync(path.join(root, 'public/logo.png'), await png(svg, 512))
console.log('favicon.ico, apple-icon.png, logo.png gotowe')
