import { describe, expect, it } from 'vitest'
// @ts-expect-error ESM helper script without .d.ts declarations
import { buildDocsContent, classifyLicense } from '../../scripts/install-wikimedia-photos.mjs'
// @ts-expect-error ESM helper script without .d.ts declarations
import { EXPECTED_VEGETABLES } from '../../scripts/check-images.mjs'

describe('Wikimedia photo installer licence & attribution checks', () => {
  it('accepts CC0, Public Domain, CC BY, and CC BY-SA while rejecting NC/ND/unclear licences', () => {
    expect(classifyLicense('CC0')?.priority).toBe(30)
    expect(classifyLicense('Public domain')?.priority).toBe(30)
    expect(classifyLicense('CC BY 4.0')?.priority).toBe(20)
    expect(classifyLicense('CC BY-SA 4.0')?.priority).toBe(10)

    expect(classifyLicense('CC BY-NC 4.0')).toBeNull()
    expect(classifyLicense('CC BY-NC-SA 3.0')).toBeNull()
    expect(classifyLicense('CC BY-NC-ND 4.0')).toBeNull()
    expect(classifyLicense('CC BY-ND 4.0')).toBeNull()
    expect(classifyLicense('Fair use')).toBeNull()
    expect(classifyLicense('')).toBeNull()
  })

  it('builds consistent IMAGES.md and IMAGE_SOURCES.md rows across all 36 slugs', () => {
    const mockRecords = EXPECTED_VEGETABLES.map((v: { slug: string; nameEn: string }, idx: number) =>
      idx === 0
        ? {
            ...v,
            installed: true,
            kb: 42.5,
            dateAdded: '2026-11-16',
            creator: 'Photographer One',
            originalUrl: 'https://upload.wikimedia.org/example/amaranth.jpg',
            descriptionUrl: 'https://commons.wikimedia.org/wiki/File:Amaranth.jpg',
            licenseName: 'CC0',
            licenseUrl: 'https://creativecommons.org/publicdomain/zero/1.0/',
          }
        : { ...v, installed: false },
    )

    const { imagesMd, imageSourcesMd } = buildDocsContent(mockRecords)
    expect(imagesMd).toContain('`1 / 36`')
    expect(imagesMd).toContain('| 1 | `amaranth` | Amaranth (Math) | photo | Wikimedia Commons | Photographer One |')
    expect(imageSourcesMd).toContain('**`1 / 36`**')
    expect(imageSourcesMd).toContain('https://commons.wikimedia.org/wiki/File:Amaranth.jpg')
    expect(imageSourcesMd).toContain('https://creativecommons.org/publicdomain/zero/1.0/')
  })
})
