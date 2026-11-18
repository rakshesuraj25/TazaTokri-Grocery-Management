export type ReceiptPaperWidth = '58mm' | '80mm' | 'A4'

export interface StoreReceiptConfig {
  storeName: string
  storeAddress: string
  contactPhone: string
  preferredWidth: ReceiptPaperWidth
  footerMessage: string
}

export const DEFAULT_RECEIPT_CONFIG: Readonly<StoreReceiptConfig> = {
  storeName: 'TazaTokri',
  storeAddress: 'Shop 4, Market Yard Road, Pune - 411037',
  contactPhone: '+91 99999 99999',
  preferredWidth: '80mm',
  footerMessage: 'Thank you for shopping fresh at TazaTokri!',
}

const RECEIPT_CONFIG_STORAGE_KEY = 'tazatokri-receipt-config'

export function getReceiptConfig(): StoreReceiptConfig {
  try {
    if (typeof window === 'undefined' || !window.localStorage) {
      return { ...DEFAULT_RECEIPT_CONFIG }
    }
    const raw = window.localStorage.getItem(RECEIPT_CONFIG_STORAGE_KEY)
    if (!raw) return { ...DEFAULT_RECEIPT_CONFIG }
    const parsed = JSON.parse(raw) as Partial<StoreReceiptConfig>
    const width: ReceiptPaperWidth =
      parsed.preferredWidth === '58mm' ||
      parsed.preferredWidth === '80mm' ||
      parsed.preferredWidth === 'A4'
        ? parsed.preferredWidth
        : DEFAULT_RECEIPT_CONFIG.preferredWidth

    return {
      storeName: parsed.storeName?.trim() || DEFAULT_RECEIPT_CONFIG.storeName,
      storeAddress:
        parsed.storeAddress !== undefined
          ? parsed.storeAddress.trim()
          : DEFAULT_RECEIPT_CONFIG.storeAddress,
      contactPhone:
        parsed.contactPhone !== undefined
          ? parsed.contactPhone.trim()
          : DEFAULT_RECEIPT_CONFIG.contactPhone,
      preferredWidth: width,
      footerMessage:
        parsed.footerMessage?.trim() || DEFAULT_RECEIPT_CONFIG.footerMessage,
    }
  } catch {
    return { ...DEFAULT_RECEIPT_CONFIG }
  }
}

export function saveReceiptConfig(next: Partial<StoreReceiptConfig>): StoreReceiptConfig {
  const current = getReceiptConfig()
  const updated: StoreReceiptConfig = {
    storeName: next.storeName?.trim() || current.storeName,
    storeAddress:
      next.storeAddress !== undefined ? next.storeAddress.trim() : current.storeAddress,
    contactPhone:
      next.contactPhone !== undefined ? next.contactPhone.trim() : current.contactPhone,
    preferredWidth: next.preferredWidth ?? current.preferredWidth,
    footerMessage: next.footerMessage?.trim() || current.footerMessage,
  }
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(RECEIPT_CONFIG_STORAGE_KEY, JSON.stringify(updated))
    }
  } catch {
    // ignore storage errors
  }
  return updated
}

export function resetReceiptConfig(): StoreReceiptConfig {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.removeItem(RECEIPT_CONFIG_STORAGE_KEY)
    }
  } catch {
    // ignore storage errors
  }
  return { ...DEFAULT_RECEIPT_CONFIG }
}
