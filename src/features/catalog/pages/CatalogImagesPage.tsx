import { useCallback, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Camera, ImageIcon, Info, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { EmptyState } from '@/components/EmptyState'
import { VegetableImage } from '@/components/VegetableImage'
import { useVegetableName } from '@/hooks/useVegetableName'
import { ProductsTabs } from '../components/ProductsTabs'
import { DEFAULT_CATALOG_VEGETABLES } from '../defaultCatalog'
import { useVegetables } from '../hooks'
import { EXPECTED_VEGETABLE_IMAGES } from '../vegetableImages'

type StatusFilter = 'all' | 'photo' | 'illustration'

export default function CatalogImagesPage() {
  const { t } = useTranslation()
  const { name, subtitle } = useVegetableName()
  const vegetables = useVegetables()

  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<StatusFilter>('all')
  const [statusBySlug, setStatusBySlug] = useState<Record<string, 'photo' | 'illustration'>>({})

  const handleStatusChange = useCallback((slug: string, status: 'photo' | 'illustration') => {
    setStatusBySlug((prev) => (prev[slug] === status ? prev : { ...prev, [slug]: status }))
  }, [])

  const liveByNameEn = useMemo(
    () => new Map((vegetables.data ?? []).map((v) => [v.nameEn.toLowerCase(), v])),
    [vegetables.data],
  )

  const defaultCategoryByNameEn = useMemo(
    () => new Map(DEFAULT_CATALOG_VEGETABLES.map((v) => [v.nameEn.toLowerCase(), v.categoryName])),
    [],
  )

  const rows = useMemo(
    () =>
      EXPECTED_VEGETABLE_IMAGES.map((entry) => {
        const live = liveByNameEn.get(entry.nameEn.toLowerCase())
        const categoryName =
          live?.categoryName ?? defaultCategoryByNameEn.get(entry.nameEn.toLowerCase()) ?? null
        const status = statusBySlug[entry.slug] ?? 'illustration'
        return {
          slug: entry.slug,
          nameEn: entry.nameEn,
          nameMr: live?.nameMr ?? null,
          nameHi: live?.nameHi ?? null,
          imageUrl: live?.imageUrl ?? null,
          categoryName,
          filePath: `public/vegetables/${entry.slug}.jpg`,
          status,
        }
      }),
    [liveByNameEn, defaultCategoryByNameEn, statusBySlug],
  )

  const photoCount = useMemo(
    () => rows.filter((r) => r.status === 'photo').length,
    [rows],
  )
  const missingCount = rows.length - photoCount

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    return rows.filter((r) => {
      if (filter !== 'all' && r.status !== filter) return false
      if (!q) return true
      return (
        r.nameEn.toLowerCase().includes(q) ||
        r.slug.includes(q) ||
        (r.nameMr ?? '').toLowerCase().includes(q) ||
        (r.nameHi ?? '').toLowerCase().includes(q)
      )
    })
  }, [rows, filter, search])

  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <h1 className="font-display text-2xl font-extrabold">
            {t('staff.catalog.imagesTitle', { defaultValue: 'Vegetable Images (36)' })}
          </h1>
          <Badge variant="secondary">{rows.length}</Badge>
        </div>
        <Button asChild variant="outline" size="sm">
          <Link to="/staff/catalog">
            <ArrowLeft className="size-4" aria-hidden />
            {t('common.back', { defaultValue: 'Back' })}
          </Link>
        </Button>
      </div>

      <ProductsTabs />

      <div className="border-border bg-card flex flex-col gap-2 rounded-xl border p-4 text-sm sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-2.5">
          <Info className="text-primary mt-0.5 size-4 shrink-0" aria-hidden />
          <div className="space-y-1">
            <p className="font-semibold">
              {t('staff.catalog.imagesReadOnlyNotice', {
                defaultValue:
                  'Read-only image review board. Real photos are self-hosted — no server upload endpoint exists yet.',
              })}
            </p>
            <p className="text-muted-foreground text-xs leading-relaxed">
              Crop square to <code className="text-foreground font-mono">600x600</code> JPEG (&lt;= 80 KB) using{' '}
              <span className="text-foreground font-medium">squoosh.app</span> (quality 80), save to the exact{' '}
              <code className="text-foreground font-mono">public/vegetables/&lt;slug&gt;.jpg</code> path below, record Source and Licence in{' '}
              <code className="text-foreground font-mono">docs/IMAGES.md</code> (see <code className="text-foreground font-mono">docs/PHOTO_GUIDE.md</code>), and verify with{' '}
              <code className="text-foreground font-mono">npm run check:images</code>.
            </p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Badge variant="success">
            <Camera className="mr-1 size-3" aria-hidden />
            {photoCount} {t('staff.catalog.photoStatusPhoto', { defaultValue: 'Photo' })}
          </Badge>
          <Badge variant="secondary">
            <ImageIcon className="mr-1 size-3" aria-hidden />
            {missingCount}{' '}
            {t('staff.catalog.photoStatusIllustration', { defaultValue: 'Illustration only' })}
          </Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-52 flex-1">
          <Search
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2"
            aria-hidden
          />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('staff.catalog.imagesSearchPlaceholder', {
              defaultValue: 'Search vegetable or slug...',
            })}
            className="pl-9"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(
            [
              { id: 'all', label: `All (${rows.length})` },
              { id: 'illustration', label: `Illustration only (${missingCount})` },
              { id: 'photo', label: `Photo (${photoCount})` },
            ] as const
          ).map((option) => (
            <Button
              key={option.id}
              type="button"
              size="sm"
              variant={filter === option.id ? 'default' : 'outline'}
              onClick={() => setFilter(option.id)}
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={<ImageIcon className="size-8" aria-hidden />}
          title={t('shop.noSearchMatch', { defaultValue: 'No matching vegetables found' })}
          actionLabel={t('shop.clearFilters', { defaultValue: 'Clear filters' })}
          onAction={() => {
            setSearch('')
            setFilter('all')
          }}
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
          {filtered.map((item) => {
            const displayLabel = name({
              nameEn: item.nameEn,
              nameMr: item.nameMr ?? undefined,
              nameHi: item.nameHi ?? undefined,
            })
            const subLabel = subtitle({
              nameEn: item.nameEn,
              nameMr: item.nameMr ?? undefined,
              nameHi: item.nameHi ?? undefined,
            })

            return (
              <Card key={item.slug} className="flex flex-col gap-2.5 p-3">
                <VegetableImage
                  nameEn={item.nameEn}
                  nameMr={item.nameMr}
                  nameHi={item.nameHi}
                  imageUrl={item.imageUrl}
                  category={item.categoryName}
                  alt={displayLabel}
                  size="card"
                  onStatusChange={(s) => handleStatusChange(item.slug, s)}
                />
                <div className="space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h2 className="font-display truncate text-sm font-bold">{displayLabel}</h2>
                      {subLabel && (
                        <p className="text-muted-foreground truncate text-xs">{subLabel}</p>
                      )}
                    </div>
                    <Badge
                      variant={item.status === 'photo' ? 'success' : 'secondary'}
                      className="shrink-0"
                    >
                      {item.status === 'photo'
                        ? t('staff.catalog.photoStatusPhoto', { defaultValue: 'Photo' })
                        : t('staff.catalog.photoStatusIllustration', {
                            defaultValue: 'Illustration only',
                          })}
                    </Badge>
                  </div>
                  <div className="bg-muted/60 border-border space-y-0.5 rounded-lg border px-2 py-1.5 text-[11px]">
                    <p className="text-muted-foreground">
                      Slug:{' '}
                      <code className="text-foreground font-mono font-semibold">{item.slug}</code>
                    </p>
                    <p className="text-muted-foreground truncate" title={item.filePath}>
                      File:{' '}
                      <code className="text-foreground font-mono">{item.filePath}</code>
                    </p>
                  </div>
                </div>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
