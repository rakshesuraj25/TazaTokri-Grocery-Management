import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Sparkles,
  Trash2,
  Upload,
} from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAiStatus, useExtractQuickSaleList } from '@/features/ai/hooks'
import type {
  QuickSaleDraftDto,
  QuickSaleDraftLineDto,
} from '@/features/ai/types'
import type { StaffCatalogItem } from '@/features/catalog/types'
import { toApiError } from '@/lib/api'
import { dec, formatInr, formatQty } from '@/lib/money'

interface AiQuickSaleAssistantDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  catalog: StaffCatalogItem[]
  onLoadIntoBill: (items: Array<{ item: StaffCatalogItem; quantity: string }>) => void
}

export function AiQuickSaleAssistantDialog({
  open,
  onOpenChange,
  catalog,
  onLoadIntoBill,
}: AiQuickSaleAssistantDialogProps) {
  const { t } = useTranslation()
  const aiStatus = useAiStatus(open)
  const extractList = useExtractQuickSaleList()

  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<QuickSaleDraftDto | null>(null)
  const [editableLines, setEditableLines] = useState<QuickSaleDraftLineDto[]>([])

  const handleExtract = () => {
    setError(null)
    if (!selectedFile && !rawText.trim()) {
      setError(
        t('ai.quickSaleInputRequired', {
          defaultValue:
            'Paste a customer grocery list or upload a handwritten list image first.',
        }),
      )
      return
    }

    extractList.mutate(
      { file: selectedFile, rawText },
      {
        onSuccess: (res) => {
          setDraft(res)
          setEditableLines(res.items)
        },
        onError: (err) => {
          setError(toApiError(err).message)
        },
      },
    )
  }

  const handleVegetableChange = (idx: number, vegIdStr: string) => {
    const vegId = Number(vegIdStr)
    const found = catalog.find((v) => Number(v.id) === vegId)
    setEditableLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line
        if (!found) {
          return {
            ...line,
            vegetableId: null,
            matchedVegetableName: null,
            baseUnit: null,
            currentUnitPrice: null,
            estimatedLineTotal: null,
            availableStock: null,
            stockSufficient: false,
            matched: false,
            confidence: 'UNMATCHED',
          }
        }
        const q = Number(line.quantity) || 1
        const p = found.pricePerUnit != null ? Number(found.pricePerUnit) : null
        const avail = Number(found.stock) || 0
        return {
          ...line,
          vegetableId: found.id,
          matchedVegetableName: found.nameEn,
          matchedNameMr: found.nameMr,
          matchedNameHi: found.nameHi,
          baseUnit: found.baseUnit,
          currentUnitPrice: found.pricePerUnit,
          estimatedLineTotal: p != null ? (q * p).toFixed(2) : null,
          availableStock: found.stock,
          stockSufficient: avail >= q,
          matched: true,
          confidence: 'MANUAL',
          warning:
            avail <= 0
              ? `${found.nameEn} is out of stock`
              : avail < q
                ? `Requested ${q} ${found.baseUnit} exceeds stock (${avail} ${found.baseUnit})`
                : null,
        }
      }),
    )
  }

  const handleQtyChange = (idx: number, nextQty: string) => {
    setEditableLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line
        const q = Number(nextQty) || 0
        const p = line.currentUnitPrice != null ? Number(line.currentUnitPrice) : null
        const avail = line.availableStock != null ? Number(line.availableStock) : 0
        return {
          ...line,
          quantity: nextQty,
          estimatedLineTotal: p != null ? (q * p).toFixed(2) : null,
          stockSufficient: avail >= q && q > 0,
        }
      }),
    )
  }

  const handleRemoveLine = (idx: number) => {
    setEditableLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleConfirmLoad = () => {
    setError(null)
    const catalogById = new Map(catalog.map((c) => [String(c.id), c]))
    const toLoad: Array<{ item: StaffCatalogItem; quantity: string }> = []
    const skipped: string[] = []

    for (const line of editableLines) {
      if (!line.vegetableId) {
        skipped.push(line.rawItemName)
        continue
      }
      const catItem = catalogById.get(String(line.vegetableId))
      if (!catItem) {
        skipped.push(line.rawItemName)
        continue
      }
      const avail = dec(catItem.stock)
      const reqQty = dec(line.quantity || 0)
      if (avail.lte(0) || reqQty.lte(0) || catItem.pricePerUnit == null) {
        skipped.push(catItem.nameEn)
        continue
      }
      const cappedQty = reqQty.gt(avail) ? avail : reqQty
      toLoad.push({
        item: catItem,
        quantity: cappedQty.toFixed(3).replace(/\.?0+$/, ''),
      })
    }

    if (toLoad.length === 0) {
      setError(
        t('ai.noSellableItemsInDraft', {
          defaultValue:
            'No matched in-stock items to add to bill. Map unmatched items or adjust quantities.',
        }),
      )
      return
    }

    onLoadIntoBill(toLoad)
    toast.success(
      t('ai.quickSaleLoadedToast', {
        defaultValue: `Added ${toLoad.length} item(s) to Quick Sale bill for final confirmation.`,
      }),
    )
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="text-primary size-5" aria-hidden />
            {t('ai.quickSaleAssistantTitle', {
              defaultValue: 'AI Customer List to Quick Sale (Draft Assistant)',
            })}
          </DialogTitle>
          <DialogDescription>
            {t('ai.quickSaleAssistantDesc', {
              defaultValue:
                'Paste a customer list in English, Marathi, or Hindi (e.g. "2 kg onion, 500 g tomato, 1 bunch kothimbir") or upload a handwritten list image. Review items before loading into the POS bill.',
            })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 text-xs">
          {aiStatus.data && (
            <div className="bg-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{aiStatus.data.message}</span>
              <Badge variant={aiStatus.data.configured ? 'default' : 'secondary'}>
                {aiStatus.data.configured ? aiStatus.data.model : 'Multilingual Parser'}
              </Badge>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-quicksale-text">
                {t('ai.typeOrPasteCustomerList', {
                  defaultValue: 'Type / Paste Customer Grocery List (EN / MR / HI)',
                })}
              </Label>
              <textarea
                id="ai-quicksale-text"
                rows={4}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={'2 kg onion\n500 g tomato\n1 bunch kothimbir\n१ किलो बटाटा'}
                className="border-input bg-background w-full rounded-lg border p-2.5 font-mono text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-quicksale-file">
                {t('ai.uploadCustomerListImage', {
                  defaultValue: 'Or Upload Handwritten / Printed List Photo',
                })}
              </Label>
              <Input
                id="ai-quicksale-file"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
              <p className="text-muted-foreground text-[11px]">
                {t('ai.supportedFormatsNote', {
                  defaultValue:
                    'Supports English, मराठी (कांदा, बटाटा, कोथिंबीर), and हिंदी (प्याज, आलू, टमाटर) item names and gram-to-kg conversion.',
                })}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button
              type="button"
              size="sm"
              loading={extractList.isPending}
              onClick={handleExtract}
            >
              {selectedFile ? (
                <Upload className="size-3.5" aria-hidden />
              ) : (
                <FileText className="size-3.5" aria-hidden />
              )}
              {t('ai.parseCustomerListBtn', {
                defaultValue: 'Extract Quick Sale Draft',
              })}
            </Button>

            {draft && (
              <span className="text-muted-foreground text-[11px]">
                Matched {draft.matchedCount} of {draft.totalExtractedCount} line(s)
              </span>
            )}
          </div>

          {error && (
            <p
              role="alert"
              className="bg-tomato-light text-tomato rounded-lg p-2.5 text-xs font-medium"
            >
              {error}
            </p>
          )}

          {draft && (
            <div
              data-testid="ai-quicksale-draft-review"
              className="border-border space-y-2.5 border-t pt-3"
            >
              {draft.warnings.length > 0 && (
                <div
                  role="alert"
                  className="bg-turmeric-light text-turmeric-foreground space-y-1 rounded-lg p-2.5 text-xs"
                >
                  {draft.warnings.map((w) => (
                    <p key={w} className="flex items-start gap-1.5 font-medium">
                      <AlertTriangle className="mt-0.5 size-3.5 shrink-0" aria-hidden />
                      <span>{w}</span>
                    </p>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                {editableLines.map((line, idx) => (
                  <div
                    key={`${line.rawLineText}-${idx}`}
                    className={`rounded-lg border p-2.5 ${
                      !line.matched
                        ? 'border-turmeric bg-turmeric-light/20'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_1.3fr_100px_100px_auto] sm:items-center">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">
                          Customer Line
                        </span>
                        <span className="font-semibold">{line.rawLineText}</span>
                      </div>

                      <select
                        aria-label={`Select vegetable for ${line.rawLineText}`}
                        value={line.vegetableId ?? 0}
                        onChange={(e) => handleVegetableChange(idx, e.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-2 text-xs"
                      >
                        <option value={0}>-- Select Catalog Vegetable --</option>
                        {catalog.map((v) => (
                          <option key={String(v.id)} value={v.id}>
                            {v.nameEn} ({v.baseUnit} • Stock: {formatQty(v.stock)})
                          </option>
                        ))}
                      </select>

                      <Input
                        type="number"
                        step="0.1"
                        min="0.001"
                        value={String(line.quantity)}
                        onChange={(e) => handleQtyChange(idx, e.target.value)}
                        aria-label={`Quantity for ${line.rawLineText}`}
                        className="h-9 text-xs"
                      />

                      <div className="text-right">
                        <span className="text-muted-foreground block text-[10px]">
                          Est. Line
                        </span>
                        <span className="font-bold">
                          {line.estimatedLineTotal != null
                            ? formatInr(line.estimatedLineTotal)
                            : '—'}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        aria-label={`Remove ${line.rawLineText}`}
                        className="text-muted-foreground hover:text-destructive inline-flex items-center justify-center p-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    {line.warning && (
                      <p className="text-warning mt-1 flex items-center gap-1 text-[11px] font-medium">
                        <AlertTriangle className="size-3" aria-hidden />
                        {line.warning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {t('common.cancel')}
          </Button>
          {draft && editableLines.length > 0 && (
            <Button type="button" onClick={handleConfirmLoad}>
              <CheckCircle2 className="size-4" aria-hidden />
              {t('ai.addConfirmedToQuickSaleBtn', {
                defaultValue: 'Load Confirmed Items into Quick Sale Bill',
              })}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
