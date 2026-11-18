import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { act, fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import i18n from '@/i18n'
import { VegetableImage } from '@/components/VegetableImage'
import { VegetablePlaceholder } from '@/components/VegetablePlaceholder'
import {
  EXPECTED_VEGETABLE_IMAGES,
  resolveVegetableImage,
} from '@/features/catalog/vegetableImages'
import {
  VEGETABLE_ILLUSTRATIONS,
  getVegetableIllustration,
} from '@/features/catalog/vegetableIllustrations'

/** Builds a minimal valid binary JPEG buffer containing SOF0 dimensions. */
function makeMinimalJpeg(width: number, height: number, extraBytes = 0): Buffer {
  const header = Buffer.from([
    0xff, 0xd8, // SOI
    0xff, 0xc0, // SOF0
    0x00, 0x0b, // segment length = 11
    0x08, // 8-bit precision
    (height >> 8) & 0xff,
    height & 0xff,
    (width >> 8) & 0xff,
    width & 0xff,
    0x01, // 1 component
    0x01,
    0x11,
    0x00,
    0xff, 0xd9, // EOI
  ])
  if (extraBytes <= 0) return header
  return Buffer.concat([header.subarray(0, header.length - 2), Buffer.alloc(extraBytes, 0), header.subarray(header.length - 2)])
}

describe('Vegetable image & per-slug illustration pipeline', () => {
  beforeEach(async () => {
    await act(async () => {
      await i18n.changeLanguage('en')
    })
  })

  it('has a distinct 120x120 SVG line illustration for every one of the 36 expected vegetables', () => {
    expect(EXPECTED_VEGETABLE_IMAGES).toHaveLength(36)

    const seenSignatures = new Set<string>()
    for (const item of EXPECTED_VEGETABLE_IMAGES) {
      const spec = VEGETABLE_ILLUSTRATIONS[item.slug]
      expect(spec, `Missing illustration entry for slug "${item.slug}"`).toBeDefined()
      expect(spec.slug).toBe(item.slug)
      expect(spec.paths.length).toBeGreaterThan(0)

      const signature = spec.paths.map((p) => p.d).join('|')
      expect(seenSignatures.has(signature), `Duplicate SVG path for ${item.slug}`).toBe(false)
      seenSignatures.add(signature)
    }

    // Sibling vegetables previously conflated must remain distinct
    const gourdAndBrinjalSlugs = ['bitter-gourd', 'bottle-gourd', 'brinjal', 'cabbage']
    const sigs = gourdAndBrinjalSlugs.map((slug) =>
      getVegetableIllustration(slug).paths.map((p) => p.d).join('|'),
    )
    expect(new Set(sigs).size).toBe(4)
  })

  it('shows vegetable name beneath illustration even at small sizes (xs, sm)', () => {
    const { container } = render(
      <>
        <VegetablePlaceholder
          nameEn="Bitter Gourd (Karela)"
          category="Everyday Vegetables"
          label="Karela"
          size="xs"
        />
        <VegetablePlaceholder
          nameEn="Bottle Gourd (Dudhi)"
          category="Everyday Vegetables"
          label="Dudhi"
          size="sm"
        />
      </>,
    )

    expect(screen.getByText('Karela')).toBeInTheDocument()
    expect(screen.getByText('Dudhi')).toBeInTheDocument()
    expect(container.querySelector('[data-vegetable-slug="bitter-gourd"]')).toBeInTheDocument()
    expect(container.querySelector('[data-vegetable-slug="bottle-gourd"]')).toBeInTheDocument()
  })

  it('renders localized alt text with object-cover photo and falls back to its own slug illustration on error', async () => {
    await act(async () => {
      await i18n.changeLanguage('mr')
    })

    const statusSpy = vi.fn()
    const { container } = render(
      <MemoryRouter>
        <VegetableImage
          nameEn="Brinjal (Vangi)"
          nameMr="वांगी"
          nameHi="बैंगन"
          category="Everyday Vegetables"
          size="card"
          onStatusChange={statusSpy}
        />
      </MemoryRouter>,
    )

    const img = screen.getByRole('img', { name: 'वांगी' })
    expect(img).toHaveAttribute('src', resolveVegetableImage('Brinjal (Vangi)'))
    expect(img).toHaveAttribute('width', '600')
    expect(img).toHaveAttribute('height', '600')
    expect(img.className).toContain('object-cover')
    expect(img.className).toContain('object-center')
    expect(container.firstElementChild?.className).toContain('aspect-square')
    expect(container.firstElementChild?.getAttribute('data-image-state')).toBe('photo')

    fireEvent.error(img)

    expect(statusSpy).toHaveBeenCalledWith('illustration')
    expect(container.firstElementChild?.getAttribute('data-image-state')).toBe('illustration')
    expect(container.querySelector('[data-vegetable-slug="brinjal"]')).toBeInTheDocument()
    expect(screen.getByText('वांगी')).toBeInTheDocument()
  })

  it('enforces consistent 1:1 square containers across xs, sm, md, lg, and card sizes', () => {
    const sizes = ['xs', 'sm', 'md', 'lg', 'card'] as const
    const { container } = render(
      <>
        {sizes.map((sz) => (
          <VegetableImage key={sz} nameEn="Tomato" category="Everyday Vegetables" size={sz} />
        ))}
      </>,
    )
    const frames = container.querySelectorAll('[data-vegetable-slug="tomato"]')
    expect(frames).toHaveLength(sizes.length)
    frames.forEach((frame) => {
      expect(frame.className).toContain('aspect-square')
    })
  })

  it('check-images CLI passes when documented/empty and fails (exit 1) when an image lacks Source/Licence or is non-square', () => {
    const scriptPath = path.resolve(process.cwd(), 'scripts', 'check-images.mjs')
    const docsFile = fs.existsSync(path.resolve(process.cwd(), 'docs', 'IMAGES.md'))
      ? path.resolve(process.cwd(), 'docs', 'IMAGES.md')
      : path.resolve(process.cwd(), '..', 'docs', 'IMAGES.md')
    const rawDocs = fs.readFileSync(docsFile, 'utf8')
    const baseDocs = rawDocs.replace(
      /^\|\s*35\s*\|\s*`tomato`.*$/m,
      '| 35 | `tomato` | Tomato | illustration | - | - | - | - | - | no |',
    )
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'tt-check-images-'))

    try {
      const vegDir = path.join(tmpDir, 'vegetables')
      const docsPath = path.join(tmpDir, 'IMAGES.md')
      fs.mkdirSync(vegDir, { recursive: true })
      fs.writeFileSync(docsPath, baseDocs, 'utf8')

      // 1) All missing (0/36 present) exits 0
      const cleanOut = execFileSync(
        process.execPath,
        [scriptPath, `--veg-dir=${vegDir}`, `--docs=${docsPath}`],
        { encoding: 'utf8' },
      )
      expect(cleanOut).toContain('(0/36 present)')

      // 2) Present 600x600 square JPEG without Source/Licence in IMAGES.md must exit 1
      fs.writeFileSync(path.join(vegDir, 'tomato.jpg'), makeMinimalJpeg(600, 600))
      let failedUnlicenced = false
      try {
        execFileSync(
          process.execPath,
          [scriptPath, `--veg-dir=${vegDir}`, `--docs=${docsPath}`],
          { encoding: 'utf8' },
        )
      } catch (err) {
        failedUnlicenced = true
        const execErr = err as { status?: number; stdout?: string }
        expect(execErr.status).toBe(1)
        expect(execErr.stdout).toContain('missing Source & Licence')
      }
      expect(failedUnlicenced).toBe(true)

      // 3) Recording Source & Licence allows square <= 80 KB JPEG to exit 0
      const documentedDocs = baseDocs.replace(
        '| 35 | `tomato` | Tomato | illustration | - | - | - | - | - | no |',
        '| 35 | `tomato` | Tomato | photo | own | Owner | own-shoot | Own work (TazaTokri) | 2026-11-15 | yes |',
      )
      fs.writeFileSync(docsPath, documentedDocs, 'utf8')
      const validOut = execFileSync(
        process.execPath,
        [scriptPath, `--veg-dir=${vegDir}`, `--docs=${docsPath}`],
        { encoding: 'utf8' },
      )
      expect(validOut).toContain('(1/36 present)')

      // 4) Non-square 600x400 JPEG must exit 1 even when Source & Licence exist
      fs.writeFileSync(path.join(vegDir, 'tomato.jpg'), makeMinimalJpeg(600, 400))
      let failedNonSquare = false
      try {
        execFileSync(
          process.execPath,
          [scriptPath, `--veg-dir=${vegDir}`, `--docs=${docsPath}`],
          { encoding: 'utf8' },
        )
      } catch (err) {
        failedNonSquare = true
        const execErr = err as { status?: number; stdout?: string }
        expect(execErr.status).toBe(1)
        expect(execErr.stdout).toContain('600x400 (must be square 1:1')
      }
      expect(failedNonSquare).toBe(true)

      // 5) Over-80KB warning check with valid 600x600
      fs.writeFileSync(path.join(vegDir, 'tomato.jpg'), makeMinimalJpeg(600, 600, 85 * 1024))
      const warnOut = execFileSync(
        process.execPath,
        [scriptPath, `--veg-dir=${vegDir}`, `--docs=${docsPath}`],
        { encoding: 'utf8' },
      )
      expect(warnOut).toContain('Warnings (1):')
      expect(warnOut).toContain('recommended <= 80 KB')
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true })
    }
  })
})
