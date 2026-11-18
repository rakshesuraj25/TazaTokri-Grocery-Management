import { api } from '@/lib/api'
import type {
  AiStatusResponse,
  PurchaseInvoiceDraftDto,
  QuickSaleDraftDto,
} from './types'

export const aiApi = {
  getStatus: () => api.get<AiStatusResponse>('/api/ai/status'),

  extractPurchaseInvoice: (input: { file?: File | null; rawText?: string }) => {
    if (input.file) {
      const form = new FormData()
      form.append('file', input.file)
      if (input.rawText && input.rawText.trim()) {
        form.append('rawText', input.rawText.trim())
      }
      return api.post<PurchaseInvoiceDraftDto>('/api/ai/purchase-invoice/extract', form)
    }
    return api.post<PurchaseInvoiceDraftDto>('/api/ai/purchase-invoice/extract-text', {
      rawText: input.rawText ?? '',
    })
  },

  extractQuickSaleList: (input: { file?: File | null; rawText?: string }) => {
    if (input.file) {
      const form = new FormData()
      form.append('file', input.file)
      if (input.rawText && input.rawText.trim()) {
        form.append('rawText', input.rawText.trim())
      }
      return api.post<QuickSaleDraftDto>('/api/ai/quick-sale/extract', form)
    }
    return api.post<QuickSaleDraftDto>('/api/ai/quick-sale/extract-text', {
      rawText: input.rawText ?? '',
    })
  },
}
