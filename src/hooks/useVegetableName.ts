import { useCallback } from 'react'
import { useTranslation } from 'react-i18next'
import { vegetableSlug } from '@/features/catalog/vegetableImages'

export interface LocalizedNames {
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
}

const SLUG_TRANSLATIONS: Record<string, { mr: string; hi: string }> = {
  amaranth: { mr: 'माठ', hi: 'चौलाई' },
  beetroot: { mr: 'बीट', hi: 'चुकंदर' },
  'bitter-gourd': { mr: 'कारले', hi: 'करेला' },
  'bottle-gourd': { mr: 'दुधी भोपळा', hi: 'लौकी' },
  brinjal: { mr: 'वांगी', hi: 'बैंगन' },
  cabbage: { mr: 'कोबी', hi: 'पत्ता गोभी' },
  capsicum: { mr: 'ढोबळी मिरची', hi: 'शिमला मिर्च' },
  carrot: { mr: 'गाजर', hi: 'गाजर' },
  cauliflower: { mr: 'फुलकोबी', hi: 'फूलगोभी' },
  'cluster-beans': { mr: 'गवार', hi: 'ग्वार फली' },
  cucumber: { mr: 'काकडी', hi: 'खीरा' },
  'curry-leaves': { mr: 'कढीपत्ता', hi: 'करी पत्ता' },
  'dill-leaves': { mr: 'शेपू', hi: 'सोया साग' },
  drumstick: { mr: 'शेवगा', hi: 'सहजन' },
  fenugreek: { mr: 'मेथी', hi: 'मेथी' },
  'french-beans': { mr: 'फरसबी', hi: 'फ्रेंच बीन्स' },
  'fresh-coriander': { mr: 'कोथिंबीर', hi: 'धनिया' },
  garlic: { mr: 'लसूण', hi: 'लहसुन' },
  ginger: { mr: 'आले', hi: 'अदरक' },
  'green-chilli': { mr: 'हिरवी मिरची', hi: 'हरी मिर्च' },
  'green-peas': { mr: 'हिरवे मटार', hi: 'हरी मटर' },
  lemon: { mr: 'लिंबू', hi: 'नींबू' },
  mint: { mr: 'पुदिना', hi: 'पुदीना' },
  okra: { mr: 'भेंडी', hi: 'भिंडी' },
  onion: { mr: 'कांदा', hi: 'प्याज' },
  potato: { mr: 'बटाटा', hi: 'आलू' },
  pumpkin: { mr: 'भोपळा', hi: 'कद्दू' },
  radish: { mr: 'मुळा', hi: 'मूली' },
  'raw-banana': { mr: 'कच्ची केळी', hi: 'कच्चा केला' },
  'ridge-gourd': { mr: 'दोडका', hi: 'तुरई' },
  spinach: { mr: 'पालक', hi: 'पालक' },
  'spring-onion': { mr: 'पातीचा कांदा', hi: 'हरा प्याज' },
  'sweet-corn': { mr: 'स्वीट कॉर्न', hi: 'स्वीट कॉर्न' },
  'sweet-potato': { mr: 'रताळे', hi: 'शकरकंद' },
  tomato: { mr: 'टोमॅटो', hi: 'टमाटर' },
  yam: { mr: 'सुरण', hi: 'जिमीकंद' },
}

/** Pure helper: pick the name for a language, falling back to catalog translations then English. */
export function pickName(item: LocalizedNames, lang: string): string {
  const code = lang.slice(0, 2)
  if (code === 'mr') {
    if (item.nameMr?.trim()) return item.nameMr
    const fallback = SLUG_TRANSLATIONS[vegetableSlug(item.nameEn)]?.mr
    if (fallback) return fallback
  }
  if (code === 'hi') {
    if (item.nameHi?.trim()) return item.nameHi
    const fallback = SLUG_TRANSLATIONS[vegetableSlug(item.nameEn)]?.hi
    if (fallback) return fallback
  }
  return item.nameEn
}

/**
 * Returns a function that localises API names (nameEn/nameMr/nameHi)
 * to the current UI language, plus whether an English subtitle is useful.
 */
export function useVegetableName() {
  const { i18n } = useTranslation()
  const lang = i18n.resolvedLanguage ?? i18n.language ?? 'en'

  const name = useCallback((item: LocalizedNames) => pickName(item, lang), [lang])
  const subtitle = useCallback(
    (item: LocalizedNames) => {
      const local = pickName(item, lang)
      return local !== item.nameEn ? item.nameEn : null
    },
    [lang],
  )

  return { name, subtitle, lang }
}
