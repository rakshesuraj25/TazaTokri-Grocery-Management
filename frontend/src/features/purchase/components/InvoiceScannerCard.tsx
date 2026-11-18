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
import { Card } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAiStatus, useExtractPurchaseInvoice } from '@/features/ai/hooks'
import type {
  PurchaseInvoiceDraftDto,
  PurchaseInvoiceDraftLineDto,
} from '@/features/ai/types'
import type { VegetableResponse } from '@/features/catalog/types'
import { toApiError } from '@/lib/api'
import { formatInr } from '@/lib/money'

export interface VerifiedPurchaseDraftPayload {
  matchedSupplierId: number | null
  supplierName: string | null
  purchaseDate: string | null
  transportCost: string
  note: string
  items: Array<{
    vegetableId: number
    quantity: string
    ratePerUnit: string
  }>
}

interface InvoiceScannerCardProps {
  vegetables: VegetableResponse[]
  onApplyToForm: (payload: VerifiedPurchaseDraftPayload) => void
}

export function InvoiceScannerCard({
  vegetables,
  onApplyToForm,
}: InvoiceScannerCardProps) {
  const { t } = useTranslation()
  const aiStatus = useAiStatus()
  const extractInvoice = useExtractPurchaseInvoice()

  const [expanded, setExpanded] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [rawText, setRawText] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [draft, setDraft] = useState<PurchaseInvoiceDraftDto | null>(null)
  const [editableLines, setEditableLines] = useState<PurchaseInvoiceDraftLineDto[]>([])

  const handleExtract = () => {
    setError(null)
    if (!selectedFile && !rawText.trim()) {
      setError(
        t('ai.invoiceInputRequired', {
          defaultValue: 'Upload an invoice photo/PDF or paste invoice text first.',
        }),
      )
      return
    }

    extractInvoice.mutate(
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

  const handleLineVegetableChange = (idx: number, vegIdStr: string) => {
    const vegId = Number(vegIdStr)
    const found = vegetables.find((v) => Number(v.id) === vegId)
    setEditableLines((prev) =>
      prev.map((line, i) =>
        i === idx
          ? {
              ...line,
              vegetableId: found ? found.id : null,
              matchedVegetableName: found ? found.nameEn : null,
              baseUnit: found ? found.baseUnit : null,
              matched: Boolean(found),
              confidence: found ? 'MANUAL' : 'UNMATCHED',
            }
          : line,
      ),
    )
  }

  const handleLineFieldChange = (
    idx: number,
    field: 'quantity' | 'ratePerUnit',
    val: string,
  ) => {
    setEditableLines((prev) =>
      prev.map((line, i) => {
        if (i !== idx) return line
        const next = { ...line, [field]: val }
        const q = Number(next.quantity) || 0
        const r = Number(next.ratePerUnit) || 0
        next.calculatedLineTotal = (q * r).toFixed(2)
        return next
      }),
    )
  }

  const handleRemoveLine = (idx: number) => {
    setEditableLines((prev) => prev.filter((_, i) => i !== idx))
  }

  const handleApplyDraft = () => {
    if (!draft) return
    const unmatched = editableLines.filter((l) => !l.vegetableId || Number(l.vegetableId) <= 0)
    if (unmatched.length > 0) {
      setError(
        t('ai.resolveUnmatchedBeforeApply', {
          defaultValue:
            'Please map or remove all unmatched items before loading into the purchase form.',
        }),
      )
      return
    }
    if (editableLines.length === 0) {
      setError(
        t('ai.noLinesToApply', {
          defaultValue: 'No line items remaining in draft.',
        }),
      )
      return
    }

    const noteParts: string[] = ['AI Invoice Draft Verified']
    if (draft.invoiceNumber) noteParts.push(`Inv #${draft.invoiceNumber}`)
    if (draft.supplierName && !draft.matchedSupplierId) {
      noteParts.push(`Supplier: ${draft.supplierName}`)
    }

    onApplyToForm({
      matchedSupplierId: draft.matchedSupplierId ? Number(draft.matchedSupplierId) : null,
      supplierName: draft.supplierName,
      purchaseDate: draft.invoiceDate,
      transportCost: String(draft.transportCost ?? '0'),
      note: noteParts.join(' • '),
      items: editableLines.map((l) => ({
        vegetableId: Number(l.vegetableId),
        quantity: String(l.quantity),
        ratePerUnit: String(l.ratePerUnit),
      })),
    })

    toast.success(
      t('ai.draftLoadedIntoForm', {
        defaultValue: 'Draft loaded into form. Review and click Save to record purchase.',
      }),
    )
  }

  return (
    <Card
      data-testid="ai-invoice-scanner-card"
      className="border-primary/30 bg-surface-subtle/60 space-y-3 rounded-2xl border p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="text-primary size-5" aria-hidden />
          <div>
            <h2 className="font-display text-sm font-bold">
              {t('ai.invoiceScannerTitle', {
                defaultValue: 'AI Purchase Invoice Assistant (Draft Only)',
              })}
            </h2>
            <p className="text-muted-foreground text-xs">
              {t('ai.invoiceScannerSubtitle', {
                defaultValue:
                  'Scan a supplier bill photo/PDF or paste invoice lines. Never auto-saves without your confirmation.',
              })}
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant={expanded ? 'secondary' : 'outline'}
          size="sm"
          onClick={() => setExpanded((v) => !v)}
          className="rounded-full text-xs"
        >
          {expanded
            ? t('common.close', { defaultValue: 'Close' })
            : t('ai.openInvoiceScanner', { defaultValue: 'Scan / Paste Invoice' })}
        </Button>
      </div>

      {expanded && (
        <div className="bg-card space-y-3 rounded-xl border p-3.5 text-xs">
          {aiStatus.data && (
            <div className="bg-surface-subtle flex flex-wrap items-center justify-between gap-2 rounded-lg px-3 py-2">
              <span className="text-muted-foreground">{aiStatus.data.message}</span>
              <Badge variant={aiStatus.data.configured ? 'default' : 'secondary'}>
                {aiStatus.data.configured ? aiStatus.data.model : 'Local Text Parser'}
              </Badge>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="ai-invoice-file">
                {t('ai.uploadInvoiceFile', {
                  defaultValue: 'Upload Invoice Photo or PDF (Max 5 MB)',
                })}
              </Label>
              <Input
                id="ai-invoice-file"
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={(e) => setSelectedFile(e.target.files?.[0] ?? null)}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="ai-invoice-text">
                {t('ai.pasteInvoiceText', {
                  defaultValue: 'Or Paste Supplier Bill Lines',
                })}
              </Label>
              <textarea
                id="ai-invoice-text"
                rows={3}
                value={rawText}
                onChange={(e) => setRawText(e.target.value)}
                placeholder={
                  'Supplier: Shri Ganesh Traders\nTransport: 150\nTotal: 2200\nOnion | 50 kg | 25 | 1250\nTomato | 25 kg | 32 | 800'
                }
                className="border-input bg-background w-full rounded-lg border p-2 font-mono text-xs"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <Button
              type="button"
              size="sm"
              loading={extractInvoice.isPending}
              onClick={handleExtract}
            >
              {selectedFile ? (
                <Upload className="size-3.5" aria-hidden />
              ) : (
                <FileText className="size-3.5" aria-hidden />
              )}
              {t('ai.extractDraftBtn', { defaultValue: 'Extract Purchase Draft' })}
            </Button>

            {draft && (
              <span className="text-muted-foreground text-[11px]">
                Source: <strong className="font-mono">{draft.extractionSource}</strong>
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
              data-testid="ai-invoice-draft-review"
              className="border-border space-y-3 border-t pt-3"
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

              <div className="bg-surface-subtle grid grid-cols-2 gap-2 rounded-lg p-2.5 sm:grid-cols-4">
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    {t('staff.purchase.supplier')}
                  </span>
                  <span className="font-semibold">
                    {draft.supplierName ?? '—'}{' '}
                    {draft.matchedSupplierId ? (
                      <Badge variant="default" className="ml-1 text-[10px]">
                        Matched
                      </Badge>
                    ) : null}
                  </span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    {t('staff.purchase.purchaseDate')}
                  </span>
                  <span className="font-semibold">{draft.invoiceDate ?? '—'}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    {t('staff.purchase.transportCost')}
                  </span>
                  <span className="font-semibold">{formatInr(draft.transportCost)}</span>
                </div>
                <div>
                  <span className="text-muted-foreground block text-[10px]">
                    {t('ai.calcVsInvoiceTotal', {
                      defaultValue: 'Calculated / Invoice Total',
                    })}
                  </span>
                  <span
                    className={`font-bold ${
                      draft.totalMismatch ? 'text-destructive' : 'text-primary'
                    }`}
                  >
                    {formatInr(draft.calculatedGrandTotal)}
                    {draft.invoiceGrandTotal != null
                      ? ` / ${formatInr(draft.invoiceGrandTotal)}`
                      : ''}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                {editableLines.map((line, idx) => (
                  <div
                    key={`${line.rawItemName}-${idx}`}
                    className={`rounded-lg border p-2.5 ${
                      !line.matched
                        ? 'border-turmeric bg-turmeric-light/20'
                        : 'border-border bg-card'
                    }`}
                  >
                    <div className="grid gap-2 sm:grid-cols-[1fr_1.2fr_100px_100px_auto] sm:items-center">
                      <div>
                        <span className="text-muted-foreground block text-[10px]">
                          Extracted Text
                        </span>
                        <span className="font-semibold">{line.rawItemName}</span>
                        <Badge
                          variant={line.matched ? 'secondary' : 'warning'}
                          className="ml-1.5 text-[10px]"
                        >
                          {line.confidence}
                        </Badge>
                      </div>

                      <select
                        aria-label={`Map vegetable for ${line.rawItemName}`}
                        value={line.vegetableId ?? 0}
                        onChange={(e) => handleLineVegetableChange(idx, e.target.value)}
                        className="border-input bg-background h-9 rounded-md border px-2 text-xs"
                      >
                        <option value={0}>-- Select Catalog Vegetable --</option>
                        {vegetables.map((v) => (
                          <option key={String(v.id)} value={v.id}>
                            {v.nameEn} ({v.baseUnit})
                          </option>
                        ))}
                      </select>

                      <Input
                        type="number"
                        step="0.1"
                        min="0.001"
                        value={String(line.quantity)}
                        onChange={(e) =>
                          handleLineFieldChange(idx, 'quantity', e.target.value)
                        }
                        aria-label={`Quantity for ${line.rawItemName}`}
                        className="h-9 text-xs"
                      />

                      <Input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={String(line.ratePerUnit)}
                        onChange={(e) =>
                          handleLineFieldChange(idx, 'ratePerUnit', e.target.value)
                        }
                        aria-label={`Rate for ${line.rawItemName}`}
                        className="h-9 text-xs"
                      />

                      <button
                        type="button"
                        onClick={() => handleRemoveLine(idx)}
                        aria-label={`Remove ${line.rawItemName}`}
                        className="text-muted-foreground hover:text-destructive inline-flex items-center justify-center p-1"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                    {line.note && (
                      <p className="text-muted-foreground mt-1 text-[11px]">
                        {line.note}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="flex justify-end">
                <Button type="button" size="sm" onClick={handleApplyDraft}>
                  <CheckCircle2 className="size-4" aria-hidden />
                  {t('ai.loadDraftIntoPurchaseForm', {
                    defaultValue: 'Load Verified Draft into Purchase Form',
                  })}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
