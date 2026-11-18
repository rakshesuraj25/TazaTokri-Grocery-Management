import { ShoppingBasket, PackageCheck, AlertCircle, Sun, Moon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Logo, LogoMark } from '@/components/Logo'
import { LanguageSwitcher } from '@/components/LanguageSwitcher'
import { StatusBadge } from '@/components/StatusBadge'
import { StockMeter } from '@/components/StockMeter'
import { PriceTag } from '@/components/PriceTag'
import { SectionHeader } from '@/components/SectionHeader'
import { Stat } from '@/components/Stat'
import { EmptyState, ErrorState } from '@/components/EmptyState'
import { PageHeader } from '@/components/PageHeader'
import { WeaveDivider } from '@/components/WeaveDivider'
import {
  CardSkeleton,
  ListSkeleton,
  ProductGridSkeleton,
  StatGridSkeleton,
  TableSkeleton,
} from '@/components/Skeletons'
import { VegetablePlaceholder } from '@/components/VegetablePlaceholder'
import { VegetableImage } from '@/components/VegetableImage'

const PALETTE = [
  { name: 'Primary (Deep Green)', cls: 'bg-primary text-primary-foreground', hex: '#245C3B / #4CAF7A' },
  { name: 'Sage & Secondary Green', cls: 'bg-secondary text-secondary-foreground', hex: '#EAF2E7 · #36764D' },
  { name: 'Cream Canvas & Main Text', cls: 'bg-background text-foreground border-b border-border', hex: '#FAF8F2 · #202820' },
  { name: 'Turmeric (Everyday)', cls: 'bg-turmeric-light text-turmeric-foreground', hex: '#E9A21A · #FDF1D1' },
  { name: 'Soil (Roots & Tubers)', cls: 'bg-soil-light text-soil-foreground', hex: '#866344 · #F4EBE2' },
  { name: 'Tomato (Alert)', cls: 'bg-tomato-light text-tomato', hex: '#D95C45 · #FDECE9' },
  { name: 'Brinjal (Accent)', cls: 'bg-brinjal-light text-brinjal-foreground', hex: '#5B3A6B · #F3ECF6' },
  { name: 'Warm Beige & Muted', cls: 'bg-muted text-muted-foreground', hex: '#E9E1D4 · #68736A' },
]

const CATEGORY_SAMPLES = [
  { title: 'Leafy Greens', category: 'Leafy Greens', veg: 'Spinach (Palak)', count: 8 },
  { title: 'Everyday Vegetables', category: 'Everyday Vegetables', veg: 'Tomato', count: 18 },
  { title: 'Roots & Tubers', category: 'Roots & Tubers', veg: 'Potato', count: 10 },
  { title: 'Seasonal / Other', category: 'Exotic Herbs', veg: 'Mint', count: 3 },
]

function StyleGuideSpecimen({ themeLabel, testId }: { themeLabel: string; testId: string }) {
  return (
    <div data-testid={testId} className="space-y-6">
      <div className="border-border flex flex-wrap items-center justify-between gap-2 border-b pb-3">
        <div className="flex items-center gap-2">
          {themeLabel === 'Dark' ? (
            <Moon className="text-primary size-4" aria-hidden />
          ) : (
            <Sun className="text-turmeric size-4" aria-hidden />
          )}
          <span className="font-display text-sm font-extrabold uppercase tracking-wider">
            {themeLabel} Theme Specimen
          </span>
        </div>
        <LanguageSwitcher />
      </div>

      {/* 1. Brand Logo & Wordmark */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">1. Brand Mark &amp; Bilingual Wordmark</h2>
        <Card>
          <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
            <Logo size="lg" showDevanagari />
            <div className="flex items-center gap-3">
              <LogoMark size="sm" />
              <LogoMark size="md" />
              <LogoMark size="lg" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 2. Palette & Category Colours */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">2. Palette &amp; Category Surfaces</h2>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {PALETTE.map((token) => (
            <div key={token.name} className="border-border bg-card overflow-hidden rounded-xl border">
              <div className={`${token.cls} px-3 py-4 text-xs font-bold`}>{token.name}</div>
              <div className="px-3 py-1.5 font-mono text-[11px] opacity-80">{token.hex}</div>
            </div>
          ))}
        </div>
      </section>

      {/* 3. Typography & Devanagari */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">3. Typography &amp; Devanagari</h2>
        <Card>
          <CardContent className="space-y-2 p-4">
            <p className="font-display text-xl font-extrabold">TazaTokri Fresh Basket — Display</p>
            <p lang="mr" className="text-base font-semibold">
              ताजा भाजीपाला, तुमच्या दारात — मराठी देवनागरी मजकूर
            </p>
            <p lang="hi" className="text-muted-foreground text-sm">
              ताज़ा सब्ज़ियाँ, सीधे आपके घर — हिंदी देवनागरी टेक्स्ट
            </p>
            <p className="money-num text-sm font-semibold">Tabular Figures: ₹1,245.50 · 2.50 kg</p>
          </CardContent>
        </Card>
      </section>

      {/* 4. Buttons & Form Controls */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">4. Buttons &amp; Controls</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap gap-2">
              <Button size="sm">Primary</Button>
              <Button size="sm" variant="secondary">Secondary</Button>
              <Button size="sm" variant="outline">Outline</Button>
              <Button size="sm" variant="ghost">Ghost</Button>
              <Button size="sm" variant="destructive">Destructive</Button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <Input placeholder="Search vegetables..." aria-label="Search showcase" />
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Switch defaultChecked id={`${testId}-sw`} />
                  <label htmlFor={`${testId}-sw`} className="text-xs font-medium">Available</label>
                </div>
                <Progress value={68} className="w-28" />
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 5. StatusBadge (Stock, Price, Order) */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">5. StatusBadge (Stock · Price · Order)</h2>
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="stock" status="IN_STOCK" />
              <StatusBadge kind="stock" status="LOW_STOCK" />
              <StatusBadge kind="stock" status="OUT_OF_STOCK" />
              <StatusBadge kind="price" status="SET" />
              <StatusBadge kind="price" status="NOT_SET" />
              <StatusBadge kind="price" status="STALE" />
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              <StatusBadge kind="order" status="PENDING_PAYMENT" />
              <StatusBadge kind="order" status="PLACED" />
              <StatusBadge kind="order" status="CONFIRMED" />
              <StatusBadge kind="order" status="PACKED" />
              <StatusBadge kind="order" status="OUT_FOR_DELIVERY" />
              <StatusBadge kind="order" status="DELIVERED" />
              <StatusBadge kind="order" status="CANCELLED" />
            </div>
          </CardContent>
        </Card>
      </section>

      {/* 6. StockMeter & PriceTag */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">6. StockMeter &amp; PriceTag</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">StockMeter</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <StockMeter quantity="18" max={25} unitLabel="kg" />
              <StockMeter quantity="3" max={25} unitLabel="kg" />
              <StockMeter quantity="0" max={25} unitLabel="kg" />
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">PriceTag</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2.5">
              <PriceTag price="45.00" unitLabel="kg" size="lg" />
              <PriceTag price="120" unitLabel="bunch" estimated size="md" />
              <PriceTag price={null} size="sm" />
            </CardContent>
          </Card>
        </div>
      </section>

      {/* 7. PageHeader, SectionHeader & Category VegetablePlaceholder */}
      <section className="space-y-3">
        <PageHeader title="7. PageHeader &amp; WeaveDivider" count={4} weave />
        <WeaveDivider variant="subtle" />
        <div className="space-y-3">
          {CATEGORY_SAMPLES.map((cat) => (
            <div key={cat.category} className="bg-card border-border space-y-2.5 rounded-xl border p-3.5">
              <SectionHeader
                title={cat.title}
                category={cat.category}
                count={cat.count}
                subtitle={`Category tone swatch (${cat.veg})`}
              />
              <div className="flex items-center gap-3">
                <div className="border-border size-16 overflow-hidden rounded-xl border">
                  <VegetablePlaceholder category={cat.category} label={cat.veg} size="md" />
                </div>
                <VegetableImage
                  nameEn={cat.veg}
                  category={cat.category}
                  imageUrl=""
                  size="md"
                />
                <div className="min-w-0">
                  <p className="font-display truncate text-sm font-bold">{cat.veg}</p>
                  <p className="text-muted-foreground text-xs">{cat.category}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* 8. Stat Tiles */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">8. Stat</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          <Stat
            label="Orders Packed"
            value="24"
            hint="4 pending"
            tone="positive"
            icon={<PackageCheck className="size-5" />}
          />
          <Stat
            label="Low Stock Items"
            value="3"
            hint="Needs purchase"
            tone="warning"
            icon={<AlertCircle className="size-5" />}
          />
          <Stat
            label="Daily Sales"
            value="₹8,420"
            hint="46 bills"
            tone="neutral"
            icon={<ShoppingBasket className="size-5" />}
          />
        </div>
      </section>

      {/* 9. EmptyState & ErrorState */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">9. EmptyState &amp; ErrorState</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Card>
            <EmptyState
              title="No orders yet"
              description="Browse today's harvest and add fresh vegetables to your tokri."
              actionLabel="Browse Shop"
              onAction={() => undefined}
            />
          </Card>
          <Card>
            <ErrorState
              title="Could not load catalog"
              message="Check your connection and try again."
              onRetry={() => undefined}
            />
          </Card>
        </div>
      </section>

      {/* 10. Skeletons */}
      <section className="space-y-2.5">
        <h2 className="font-display text-base font-bold">10. Skeletons</h2>
        <div className="space-y-3">
          <StatGridSkeleton count={3} />
          <ProductGridSkeleton count={2} />
          <ListSkeleton rows={2} />
          <TableSkeleton rows={2} cols={4} />
          <CardSkeleton className="max-w-xs" />
        </div>
      </section>
    </div>
  )
}

export default function StyleGuidePage() {
  return (
    <div className="bg-background text-foreground min-h-screen">
      <div className="mx-auto max-w-[1440px] space-y-6 px-4 py-6 sm:px-6">
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <Logo size="md" showDevanagari />
            <h1 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
              TazaTokri Design System — Light &amp; Dark Showcase
            </h1>
            <p className="text-muted-foreground text-sm">
              Phase 1 brand identity, category palette, SVG placeholders, status badges, and responsive primitives.
            </p>
          </div>
          <LanguageSwitcher />
        </header>

        <div className="grid gap-6 xl:grid-cols-2">
          <div className="bg-background text-foreground border-border rounded-2xl border p-4 shadow-xs sm:p-6">
            <StyleGuideSpecimen themeLabel="Light" testId="styleguide-light" />
          </div>

          <div className="dark bg-background text-foreground border-border rounded-2xl border p-4 shadow-xs sm:p-6">
            <StyleGuideSpecimen themeLabel="Dark" testId="styleguide-dark" />
          </div>
        </div>
      </div>
    </div>
  )
}
