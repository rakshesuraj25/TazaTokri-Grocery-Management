import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { EXPECTED_VEGETABLES, MAX_KB, runImageCheck } from './check-images.mjs'

const require = createRequire(path.resolve('package.json'))
const { chromium } = require('playwright')

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const VEG_DIR = path.join(ROOT, 'public', 'vegetables')
const IMAGES_MD_PATH = path.join(ROOT, 'docs', 'IMAGES.md')
const IMAGE_SOURCES_MD_PATH = path.join(ROOT, 'docs', 'IMAGE_SOURCES.md')
const CONTACT_SHEET_PATH = path.join(ROOT, 'docs', 'screens', 'vegetable-contact-sheet.png')

const SEARCH_QUERIES = {
  amaranth: ['Amaranthus viridis vegetable greens', 'Red amaranth spinach leaves'],
  beetroot: ['Beetroot bulbs fresh market', 'Beta vulgaris red beetroot'],
  'bitter-gourd': ['Momordica charantia fruit green', 'Bitter gourd karela vegetable'],
  'bottle-gourd': ['Lagenaria siceraria fruit', 'Bottle gourd dudhi calabash'],
  brinjal: ['Solanum melongena eggplants purple', 'Aubergine brinjal vegetable'],
  cabbage: ['Green cabbage Brassica oleracea', 'Fresh cabbage head vegetable'],
  capsicum: ['Green bell pepper Capsicum annuum', 'Capsicum green peppers'],
  carrot: ['Carrots orange Daucus carota', 'Fresh carrots harvest'],
  cauliflower: ['Cauliflower head Brassica oleracea', 'Fresh white cauliflower'],
  'cluster-beans': ['Cyamopsis tetragonoloba guar pods', 'Cluster beans gawar pods'],
  cucumber: ['Cucumis sativus fresh green cucumber', 'Cucumbers market'],
  'curry-leaves': ['Murraya koenigii leaves fresh', 'Curry leaves sprig'],
  'dill-leaves': ['Anethum graveolens dill leaves', 'Fresh dill herb greens'],
  drumstick: ['Moringa oleifera pods', 'Moringa drumstick vegetable pods'],
  fenugreek: ['Trigonella foenum-graecum methi leaves', 'Fenugreek greens vegetable'],
  'french-beans': ['Phaseolus vulgaris green beans pods', 'Fresh French beans'],
  'fresh-coriander': ['Coriandrum sativum cilantro leaves', 'Fresh coriander leaves bunch'],
  garlic: ['Allium sativum garlic bulbs', 'Fresh white garlic'],
  ginger: ['Zingiber officinale fresh rhizome', 'Fresh ginger root'],
  'green-chilli': ['Green chili peppers Capsicum', 'Fresh green chillies'],
  'green-peas': ['Pisum sativum peas in pod', 'Fresh green peas vegetable'],
  lemon: ['Citrus limon yellow lemons', 'Fresh yellow lemons whole'],
  mint: ['Mentha spicata fresh leaves', 'Fresh mint leaves herb'],
  okra: ['Abelmoschus esculentus okra pods', 'Fresh green okra bhindi'],
  onion: ['Red onions Allium cepa bulbs', 'Fresh red onions'],
  potato: ['Solanum tuberosum potatoes', 'Fresh potatoes harvest'],
  pumpkin: ['Cucurbita maxima pumpkin vegetable', 'Fresh ripe pumpkin'],
  radish: ['Daikon white radish Raphanus sativus', 'White radish mooli'],
  'raw-banana': ['Green plantains unripe bananas', 'Raw green banana bunch'],
  'ridge-gourd': ['Luffa acutangula ridge gourd', 'Ridged luffa vegetable'],
  spinach: ['Spinacia oleracea spinach leaves', 'Fresh green spinach bunch'],
  'spring-onion': ['Allium fistulosum scallions', 'Fresh spring onions green onions'],
  'sweet-corn': ['Zea mays sweet corn cob', 'Fresh sweet corn ears'],
  'sweet-potato': ['Ipomoea batatas sweet potato tubers', 'Fresh sweet potatoes'],
  tomato: ['Solanum lycopersicum red tomatoes', 'Fresh ripe tomatoes'],
  yam: ['Amorphophallus paeoniifolius corm', 'Elephant foot yam vegetable'],
}

const REJECT_TEXT_RE =
  /\b(illustration|drawing|sketch|diagram|map|stamp|herbarium|dried specimen|blight|wilt|virus|disease|larva|caterpillar|aphid|beetle|weevil|nematode|chart|logo|icon|seed packet|cartoon)\b/i

export function cleanText(html = '') {
  return String(html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Evaluates a Wikimedia Commons short licence string for commercial grocery compatibility.
 * Rejects NC, ND, fair use, copyrighted, and unknown licences.
 */
export function classifyLicense(shortName = '', licenseUrl = '') {
  const s = cleanText(shortName).toLowerCase()
  if (!s) return null
  if (/(nc|nd|non-commercial|noncommercial|fair use|copyrighted|all rights reserved|unknown|restricted)/.test(s)) {
    return null
  }

  if (/^(cc0|cc-zero|public domain|pd|pd-self|pd-old|pd-usgov|pd-user)/.test(s)) {
    return {
      accepted: true,
      priority: 30,
      name: cleanText(shortName),
      url: licenseUrl || 'https://creativecommons.org/publicdomain/zero/1.0/',
    }
  }

  if (/^cc[\s-]by([\s-]\d\.\d)?$/.test(s)) {
    return {
      accepted: true,
      priority: 20,
      name: cleanText(shortName),
      url: licenseUrl || 'https://creativecommons.org/licenses/by/4.0/',
    }
  }

  if (/^cc[\s-]by[\s-]sa([\s-]\d\.\d)?$/.test(s)) {
    return {
      accepted: true,
      priority: 10,
      name: cleanText(shortName),
      url: licenseUrl || 'https://creativecommons.org/licenses/by-sa/4.0/',
    }
  }

  return null
}

function scoreCandidate(page, slug, usedTitles) {
  if (!page?.title || usedTitles.has(page.title)) return null
  const info = page?.imageinfo?.[0]
  if (!info) return null
  if (!['image/jpeg', 'image/png', 'image/webp'].includes(info.mime)) return null
  if ((info.width ?? 0) < 400 || (info.height ?? 0) < 300) return null

  const meta = info.extmetadata ?? {}
  const lic = classifyLicense(meta.LicenseShortName?.value ?? '', meta.LicenseUrl?.value ?? '')
  if (!lic) return null

  const combinedText = [
    page.title,
    cleanText(meta.ObjectName?.value ?? ''),
    cleanText(meta.ImageDescription?.value ?? ''),
    cleanText(meta.Categories?.value ?? ''),
  ].join(' ')

  if (REJECT_TEXT_RE.test(combinedText)) return null
  if (slug !== 'cauliflower' && /\bflower(s)?\b/i.test(page.title) && !/leaf|leaves|fruit|pod|bulb|root/i.test(page.title)) {
    return null
  }

  const ratio = Math.min(info.width / info.height, info.height / info.width)
  let score = lic.priority + ratio * 15
  if (/\.jpe?g$/i.test(page.title)) score += 6
  const thumbUrl = info.thumburl || info.url
  const originalUrl = info.url || thumbUrl
  if (!thumbUrl) return null

  return {
    title: page.title,
    score,
    thumbUrl,
    originalUrl,
    descriptionUrl:
      info.descriptionurl || `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title)}`,
    creator: cleanText(meta.Artist?.value ?? meta.Credit?.value ?? 'Wikimedia Commons contributor')
      .replace(/\|/g, '/')
      .slice(0, 90) || 'Wikimedia Commons contributor',
    licenseName: lic.name.replace(/\|/g, '/'),
    licenseUrl: lic.url,
  }
}

async function searchWikimediaWithContinuation(query, slug, usedTitles, maxPages = 3) {
  const candidates = []
  let gsroffset = null

  for (let p = 0; p < maxPages; p += 1) {
    const params = new URLSearchParams({
      action: 'query',
      generator: 'search',
      gsrnamespace: '6',
      gsrlimit: '12',
      gsrsearch: `${query} filetype:bitmap`,
      prop: 'imageinfo',
      iiprop: 'url|mime|size|extmetadata',
      iiurlwidth: '600',
      format: 'json',
      origin: '*',
    })
    if (gsroffset !== null) {
      params.set('gsroffset', String(gsroffset))
    }

    const res = await fetch(`https://commons.wikimedia.org/w/api.php?${params}`, {
      headers: { 'User-Agent': 'TazaTokriLocalPhotoInstaller/1.0 (https://tazatokri.local)' },
      signal: AbortSignal.timeout(15000),
    })
    if (!res.ok) throw new Error(`API HTTP ${res.status}`)

    const data = await res.json()
    const pages = Object.values(data?.query?.pages ?? {})
    for (const page of pages) {
      const scored = scoreCandidate(page, slug, usedTitles)
      if (scored) candidates.push(scored)
    }

    if (candidates.some((c) => c.score >= 38)) break
    const nextOffset = data?.continue?.gsroffset
    if (nextOffset === undefined || nextOffset === null) break
    gsroffset = nextOffset
  }

  candidates.sort((a, b) => b.score - a.score)
  return candidates[0] ?? null
}

async function optimizeSquare600Jpeg(page, imageBuffer, mimeHint = 'image/jpeg') {
  const dataUrl = `data:${mimeHint};base64,${imageBuffer.toString('base64')}`
  const encoded = await page.evaluate(async ({ src, maxBytes }) => {
    const img = new Image()
    await new Promise((resolve, reject) => {
      img.onload = resolve
      img.onerror = () => reject(new Error('Browser could not decode downloaded image'))
      img.src = src
    })

    const size = 600
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#FAF8F2'
    ctx.fillRect(0, 0, size, size)

    // Center-crop without stretching/distortion
    const side = Math.min(img.naturalWidth, img.naturalHeight)
    const sx = (img.naturalWidth - side) / 2
    const sy = (img.naturalHeight - side) / 2
    ctx.drawImage(img, sx, sy, side, side, 0, 0, size, size)

    let quality = 0.85
    let url = canvas.toDataURL('image/jpeg', quality)
    while (url.length * 0.75 > maxBytes && quality > 0.45) {
      quality -= 0.06
      url = canvas.toDataURL('image/jpeg', quality)
    }
    return url
  }, { src: dataUrl, maxBytes: MAX_KB * 1024 })

  return Buffer.from(encoded.replace(/^data:image\/jpeg;base64,/, ''), 'base64')
}

export function buildDocsContent(records) {
  const installedCount = records.filter((r) => r.installed).length

  const imagesRows = records.map((r, i) => {
    if (r.installed) {
      return `| ${i + 1} | \`${r.slug}\` | ${r.nameEn} | photo | Wikimedia Commons | ${r.creator} | ${r.descriptionUrl} | ${r.licenseName} | ${r.dateAdded} | no |`
    }
    return `| ${i + 1} | \`${r.slug}\` | ${r.nameEn} | illustration | - | - | - | - | - | no |`
  })

  const imagesMd = `# TazaTokri Vegetable Image Inventory (\`public/vegetables/<slug>.jpg\`)

Every vegetable image must be self-hosted at \`public/vegetables/<slug>.jpg\` (**square \`600x600\` JPEG**, target size **under ${MAX_KB} KB**) with documented source and licence before shipping.

- **Current photo coverage:** \`${installedCount} / 36\` photos present (${installedCount === 36 ? 'All 36 verified commercial-licence photographs installed' : `${36 - installedCount} remaining / fallback SVG active`}).
- **Presentation:** \`<VegetableImage />\` enforces a uniform \`1:1\` square \`aspect-square\` container (\`object-cover object-center\`), localized alt text, and category-washed SVG fallback illustrations (\`src/components/VegetablePlaceholder.tsx\`).
- **Verification:** Run \`npm run check:images\` after adding or updating any file.

---

## Inventory (36 Vegetables)

| # | Slug | Display Name | Status | Source | Author | Source URL | Licence | Date Added | Reviewed by Owner |
|---:|---|---|---|---|---|---|---|---|---|
${imagesRows.join('\n')}

---

## Allowed Values & Field Rules

- **Status:** \`illustration\` (placeholder shown) or \`photo\` (JPEG file present at \`public/vegetables/<slug>.jpg\`).
- **Source:** \`own\`, \`Wikimedia Commons\`, \`Pexels\`, \`Unsplash\`, or \`Pixabay\` (or \`-\` when \`illustration\`).
- **Author:** Photographer / studio name, or store owner name if \`own\`.
- **Source URL:** Direct Wikimedia file page or photo page URL.
`

  const sourceRows = records.map((r, i) => {
    if (r.installed) {
      return `| ${i + 1} | ${r.nameEn} | \`${r.slug}\` | \`public/vegetables/${r.slug}.jpg\` | ${r.originalUrl} | ${r.descriptionUrl} | ${r.creator} | ${r.licenseName} | ${r.licenseUrl} | ${r.dateAdded} | Verified Photo (600x600, ${r.kb} KB) |`
    }
    return `| ${i + 1} | ${r.nameEn} | \`${r.slug}\` | \`public/vegetables/${r.slug}.jpg\` | - | - | - | - | - | - | Pending / BLOCKED (SVG fallback active) |`
  })

  const imageSourcesMd = `# TazaTokri Vegetable Image Sourcing & Attribution Registry (\`IMAGE_SOURCES.md\`)

**Verified Photographs Installed:** **\`${installedCount} / 36\`**

All installed photographs are cropped to \`600 × 600\` JPEG (\`<= ${MAX_KB} KB\`), downloaded from Wikimedia Commons under verified open commercial licences (\`CC0\`, \`Public Domain\`, \`CC BY\`, or \`CC BY-SA\`), stored locally in \`public/vegetables/<slug>.jpg\`, and validated with \`npm run check:images\`.

---

## 36-Vegetable Image Source Registry

| # | Vegetable Name | Slug | Local Filename | Original Image URL | Wikimedia File Page URL | Creator | Licence | Licence URL | Download Date | Status |
|---:|---|---|---|---|---|---|---|---|---|---|
${sourceRows.join('\n')}
`

  return { imagesMd, imageSourcesMd }
}

async function generateContactSheet(page, records) {
  const tiles = records.map((r) => {
    const filePath = path.join(VEG_DIR, `${r.slug}.jpg`)
    let dataUri = ''
    if (fs.existsSync(filePath)) {
      dataUri = `data:image/jpeg;base64,${fs.readFileSync(filePath).toString('base64')}`
    }
    return { slug: r.slug, nameEn: r.nameEn, dataUri, kb: r.kb ?? '-' }
  })

  await page.setViewportSize({ width: 1280, height: 1500 })
  await page.setContent(`
    <!doctype html>
    <html>
      <body style="margin:0;padding:24px;background:#FAF8F2;font-family:system-ui,sans-serif;color:#202820;">
        <h1 style="margin:0 0 16px;font-size:20px;">TazaTokri 36 Vegetable Photographs Contact Sheet</h1>
        <div style="display:grid;grid-template-columns:repeat(6,1fr);gap:12px;">
          ${tiles
            .map(
              (t) => `
            <div style="background:#fff;border:1px solid #E9E1D4;border-radius:12px;padding:8px;text-align:center;">
              ${
                t.dataUri
                  ? `<img src="${t.dataUri}" style="width:100%;aspect-ratio:1/1;object-fit:cover;border-radius:8px;display:block;" />`
                  : `<div style="width:100%;aspect-ratio:1/1;background:#EAF2E7;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:11px;">MISSING</div>`
              }
              <div style="margin-top:6px;font-size:11px;font-weight:700;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.nameEn}</div>
              <div style="font-size:10px;color:#545F57;">${t.slug}.jpg (${t.kb} KB)</div>
            </div>`,
            )
            .join('')}
        </div>
      </body>
    </html>
  `)
  fs.mkdirSync(path.dirname(CONTACT_SHEET_PATH), { recursive: true })
  await page.screenshot({ path: CONTACT_SHEET_PATH, fullPage: true })
}

async function main() {
  fs.mkdirSync(VEG_DIR, { recursive: true })
  const today = new Date().toISOString().slice(0, 10)
  const usedTitles = new Set()
  const records = []

  const browser = await chromium.launch({
    executablePath: fs.existsSync('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe')
      ? 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe'
      : undefined,
    headless: true,
    args: ['--no-sandbox'],
  })
  const page = await browser.newPage()

  try {
    for (const item of EXPECTED_VEGETABLES) {
      const queries = SEARCH_QUERIES[item.slug] ?? [item.nameEn]
      let winner = null
      for (const q of queries) {
        try {
          winner = await searchWikimediaWithContinuation(q, item.slug, usedTitles)
          if (winner) break
        } catch (err) {
          console.error(`[search error] ${item.slug} (${q}): ${err.message}`)
        }
      }

      if (!winner) {
        console.log(`PENDING ${item.slug}`)
        records.push({ ...item, installed: false })
        continue
      }

      usedTitles.add(winner.title)

      try {
        const res = await fetch(winner.thumbUrl, {
          headers: { 'User-Agent': 'TazaTokriLocalPhotoInstaller/1.0 (https://tazatokri.local)' },
          signal: AbortSignal.timeout(15000),
        })
        if (!res.ok) throw new Error(`IMG HTTP ${res.status}`)
        const rawBuf = Buffer.from(await res.arrayBuffer())
        const contentType = res.headers.get('content-type') || 'image/jpeg'
        const jpegBuf = await optimizeSquare600Jpeg(page, rawBuf, contentType)
        const dest = path.join(VEG_DIR, `${item.slug}.jpg`)
        fs.writeFileSync(dest, jpegBuf)

        const kb = Number((jpegBuf.length / 1024).toFixed(1))
        console.log(`INSTALLED ${item.slug}.jpg (${kb} KB, ${winner.licenseName})`)
        records.push({
          ...item,
          installed: true,
          kb,
          dateAdded: today,
          ...winner,
        })
      } catch (err) {
        console.error(`FAILED ${item.slug}: ${err.message}`)
        records.push({ ...item, installed: false })
      }
    }

    const { imagesMd, imageSourcesMd } = buildDocsContent(records)
    fs.writeFileSync(IMAGES_MD_PATH, imagesMd)
    fs.writeFileSync(IMAGE_SOURCES_MD_PATH, imageSourcesMd)

    await generateContactSheet(page, records)
  } finally {
    await browser.close()
  }

  const checkResult = runImageCheck({ vegDir: VEG_DIR, docsPath: IMAGES_MD_PATH })
  console.log(`\nValidation Summary: ${checkResult.presentCount}/${checkResult.totalExpected} present`)
  if (checkResult.warnings.length > 0) console.log('Warnings:', checkResult.warnings)
  if (checkResult.errors.length > 0) console.error('Errors:', checkResult.errors)
  console.log(`Visual contact sheet saved to: ${CONTACT_SHEET_PATH}`)
  process.exit(checkResult.exitCode)
}

const isCli =
  process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))
if (isCli) {
  main()
}
