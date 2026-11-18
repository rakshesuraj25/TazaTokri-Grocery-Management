import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DEFAULT_ROOT = path.resolve(__dirname, '..')
const DEFAULT_VEG_DIR = path.join(DEFAULT_ROOT, 'public', 'vegetables')
const DEFAULT_DOCS_PATH = path.join(DEFAULT_ROOT, 'docs', 'IMAGES.md')

export const MAX_KB = 80

export const EXPECTED_VEGETABLES = [
  { slug: 'amaranth', nameEn: 'Amaranth (Math)' },
  { slug: 'beetroot', nameEn: 'Beetroot' },
  { slug: 'bitter-gourd', nameEn: 'Bitter Gourd (Karela)' },
  { slug: 'bottle-gourd', nameEn: 'Bottle Gourd (Dudhi)' },
  { slug: 'brinjal', nameEn: 'Brinjal (Vangi)' },
  { slug: 'cabbage', nameEn: 'Cabbage' },
  { slug: 'capsicum', nameEn: 'Capsicum' },
  { slug: 'carrot', nameEn: 'Carrot (Gajar)' },
  { slug: 'cauliflower', nameEn: 'Cauliflower' },
  { slug: 'cluster-beans', nameEn: 'Cluster Beans (Gawar)' },
  { slug: 'cucumber', nameEn: 'Cucumber' },
  { slug: 'curry-leaves', nameEn: 'Curry Leaves' },
  { slug: 'dill-leaves', nameEn: 'Dill Leaves (Shepu)' },
  { slug: 'drumstick', nameEn: 'Drumstick (Shevga)' },
  { slug: 'fenugreek', nameEn: 'Fenugreek (Methi)' },
  { slug: 'french-beans', nameEn: 'French Beans' },
  { slug: 'fresh-coriander', nameEn: 'Fresh Coriander' },
  { slug: 'garlic', nameEn: 'Garlic (Lasun)' },
  { slug: 'ginger', nameEn: 'Ginger (Ale)' },
  { slug: 'green-chilli', nameEn: 'Green Chilli (Mirchi)' },
  { slug: 'green-peas', nameEn: 'Green Peas (Matar)' },
  { slug: 'lemon', nameEn: 'Lemon (Limbu)' },
  { slug: 'mint', nameEn: 'Mint (Pudina)' },
  { slug: 'okra', nameEn: 'Okra (Bhendi)' },
  { slug: 'onion', nameEn: 'Onion (Kanda)' },
  { slug: 'potato', nameEn: 'Potato (Batata)' },
  { slug: 'pumpkin', nameEn: 'Pumpkin (Bhopla)' },
  { slug: 'radish', nameEn: 'Radish (Mula)' },
  { slug: 'raw-banana', nameEn: 'Raw Banana (Kaccha Kela)' },
  { slug: 'ridge-gourd', nameEn: 'Ridge Gourd (Dodka)' },
  { slug: 'spinach', nameEn: 'Spinach (Palak)' },
  { slug: 'spring-onion', nameEn: 'Spring Onion' },
  { slug: 'sweet-corn', nameEn: 'Sweet Corn' },
  { slug: 'sweet-potato', nameEn: 'Sweet Potato (Ratale)' },
  { slug: 'tomato', nameEn: 'Tomato' },
  { slug: 'yam', nameEn: 'Yam (Suran)' },
]

const PLACEHOLDER_VALUES = new Set(['', '-', '--', 'n/a', 'na', 'none', 'tbd', 'unknown'])

function isRecordedValue(value) {
  if (!value) return false
  return !PLACEHOLDER_VALUES.has(value.trim().toLowerCase())
}

/**
 * Extracts width & height from a binary JPEG buffer without external libraries.
 * Scans Start-Of-Frame markers (SOF0..SOF3, SOF5..SOF15 excluding DHT/JPG/DAC).
 */
export function readJpegDimensions(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 4) return null
  if (buffer[0] !== 0xff || buffer[1] !== 0xd8) return null

  let offset = 2
  while (offset + 3 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1
      continue
    }
    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1
    }
    if (offset >= buffer.length) break

    const marker = buffer[offset]
    offset += 1

    // Standalone markers without length payload
    if (marker === 0x00 || (marker >= 0xd0 && marker <= 0xd9)) {
      if (marker === 0xd9) break
      continue
    }

    if (offset + 1 >= buffer.length) break
    const segmentLength = buffer.readUInt16BE(offset)
    if (segmentLength < 2 || offset + segmentLength > buffer.length) break

    const isSof =
      marker >= 0xc0 &&
      marker <= 0xcf &&
      marker !== 0xc4 &&
      marker !== 0xc8 &&
      marker !== 0xcc

    if (isSof && segmentLength >= 7) {
      const height = buffer.readUInt16BE(offset + 3)
      const width = buffer.readUInt16BE(offset + 5)
      if (width > 0 && height > 0) {
        return { width, height }
      }
      return null
    }

    offset += segmentLength
  }

  return null
}

/**
 * Parses docs/IMAGES.md markdown table rows keyed by slug.
 */
export function parseImagesDocs(markdown) {
  const entries = new Map()
  if (!markdown) return entries

  const lines = markdown.split(/\r?\n/)
  let colMap = null

  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line.startsWith('|')) continue

    const cells = line
      .slice(1, line.endsWith('|') ? -1 : line.length)
      .split('|')
      .map((c) => c.trim())

    // Skip markdown alignment separator row
    if (cells.every((c) => /^:?-+:?$/.test(c))) continue

    const normalizedHeaders = cells.map((c) => c.toLowerCase())
    if (!colMap && normalizedHeaders.includes('slug') && normalizedHeaders.includes('licence')) {
      colMap = new Map()
      normalizedHeaders.forEach((h, idx) => colMap.set(h, idx))
      continue
    }

    if (!colMap) continue
    const slugIdx = colMap.get('slug')
    if (slugIdx === undefined || cells.length <= slugIdx) continue

    const slug = cells[slugIdx].replace(/`/g, '').trim()
    if (!slug) continue

    const get = (header) => {
      const idx = colMap.get(header)
      return idx !== undefined && idx < cells.length ? cells[idx].trim() : ''
    }

    entries.set(slug, {
      slug,
      status: get('status'),
      source: get('source'),
      author: get('author'),
      sourceUrl: get('source url'),
      licence: get('licence') || get('license'),
      dateAdded: get('date added'),
      reviewedByOwner: get('reviewed by owner'),
    })
  }

  return entries
}

export function runImageCheck({
  vegDir = DEFAULT_VEG_DIR,
  docsPath = DEFAULT_DOCS_PATH,
} = {}) {
  const docsExists = fs.existsSync(docsPath)
  const docsContent = docsExists ? fs.readFileSync(docsPath, 'utf8') : ''
  const docEntries = parseImagesDocs(docsContent)

  const rows = []
  const warnings = []
  const errors = []
  let presentCount = 0

  if (!docsExists) {
    errors.push(`Missing inventory file: ${docsPath}`)
  }

  const expectedSlugSet = new Set(EXPECTED_VEGETABLES.map((v) => v.slug))

  const inspectFile = (slug, nameEn, fullPath) => {
    const stat = fs.statSync(fullPath)
    const kb = stat.size / 1024
    const sizeKb = `${kb.toFixed(1)} KB`
    const buf = fs.readFileSync(fullPath)
    const dims = readJpegDimensions(buf)
    const dimsLabel = dims ? `${dims.width}x${dims.height}` : 'invalid'

    if (!dims) {
      errors.push(`ERROR: public/vegetables/${slug}.jpg is not a valid readable JPEG image.`)
    } else if (dims.width !== dims.height) {
      errors.push(
        `ERROR: public/vegetables/${slug}.jpg is ${dims.width}x${dims.height} (must be square 1:1, recommended 600x600).`,
      )
    }

    if (kb > MAX_KB) {
      warnings.push(
        `WARNING: public/vegetables/${slug}.jpg is ${kb.toFixed(1)} KB (recommended <= ${MAX_KB} KB).`,
      )
    }

    const doc = docEntries.get(slug)
    const hasSource = Boolean(doc && isRecordedValue(doc.source))
    const hasLicence = Boolean(doc && isRecordedValue(doc.licence))
    const docRecorded = hasSource && hasLicence

    if (!docRecorded) {
      const missing = [
        !hasSource ? 'Source' : null,
        !hasLicence ? 'Licence' : null,
      ]
        .filter(Boolean)
        .join(' & ')
      errors.push(
        `ERROR: public/vegetables/${slug}.jpg is present on disk but docs/IMAGES.md is missing ${missing}.`,
      )
    }

    return {
      slug,
      nameEn,
      status: 'present',
      dimensions: dimsLabel,
      sizeKb,
      docRecorded: docRecorded ? 'yes' : 'MISSING',
    }
  }

  for (const item of EXPECTED_VEGETABLES) {
    const filename = `${item.slug}.jpg`
    const fullPath = path.join(vegDir, filename)

    if (fs.existsSync(fullPath) && fs.statSync(fullPath).isFile()) {
      presentCount += 1
      rows.push(inspectFile(item.slug, item.nameEn, fullPath))
    } else {
      rows.push({
        slug: item.slug,
        nameEn: item.nameEn,
        status: 'missing',
        dimensions: '-',
        sizeKb: '-',
        docRecorded: docEntries.has(item.slug) ? 'listed' : 'missing-row',
      })
    }
  }

  // Flag any extra image files placed directly inside public/vegetables/
  if (fs.existsSync(vegDir)) {
    for (const fileName of fs.readdirSync(vegDir)) {
      if (fileName === '.gitkeep') continue
      const fullPath = path.join(vegDir, fileName)
      if (!fs.statSync(fullPath).isFile()) continue

      const ext = path.extname(fileName).toLowerCase()
      const slug = path.basename(fileName, ext)
      if (ext !== '.jpg') {
        errors.push(
          `ERROR: Unexpected non-JPG asset in public/vegetables/${fileName} (only <slug>.jpg is supported).`,
        )
        continue
      }
      if (!expectedSlugSet.has(slug)) {
        presentCount += 1
        rows.push(inspectFile(slug, '(Unexpected extra file)', fullPath))
      }
    }
  }

  const exitCode = errors.length > 0 ? 1 : 0
  return {
    presentCount,
    totalExpected: EXPECTED_VEGETABLES.length,
    rows,
    warnings,
    errors,
    exitCode,
  }
}

function formatReport(result) {
  const header = `| # | Slug | Display Name | Status | Dimensions | Size (KB) | Licence Recorded |`
  const divider = `|---|---|---|---|---|---|---|`
  const lines = result.rows.map(
    (r, idx) =>
      `| ${idx + 1} | \`${r.slug}\` | ${r.nameEn} | ${r.status} | ${r.dimensions} | ${r.sizeKb} | ${r.docRecorded} |`,
  )

  const parts = [
    `TazaTokri Vegetable Image Check (${result.presentCount}/${result.totalExpected} present)`,
    '',
    header,
    divider,
    ...lines,
  ]

  if (result.warnings.length > 0) {
    parts.push('', `Warnings (${result.warnings.length}):`, ...result.warnings.map((w) => `- ${w}`))
  }

  if (result.errors.length > 0) {
    parts.push('', `Errors (${result.errors.length}):`, ...result.errors.map((e) => `- ${e}`))
  }

  return parts.join('\n')
}

function parseCliArgs(argv) {
  let vegDir = DEFAULT_VEG_DIR
  let docsPath = DEFAULT_DOCS_PATH
  for (const arg of argv) {
    if (arg.startsWith('--veg-dir=')) vegDir = path.resolve(arg.slice('--veg-dir='.length))
    if (arg.startsWith('--docs=')) docsPath = path.resolve(arg.slice('--docs='.length))
  }
  return { vegDir, docsPath }
}

const isCliEntry =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))

if (isCliEntry) {
  const opts = parseCliArgs(process.argv.slice(2))
  const result = runImageCheck(opts)
  console.log(formatReport(result))
  process.exit(result.exitCode)
}
