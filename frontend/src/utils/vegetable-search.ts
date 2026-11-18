import { VEGETABLE_SYNONYMS } from '@/data/vegetable-synonyms'
import { vegetableSlug } from '@/features/catalog/vegetableImages'

export interface SearchableVegetable {
  id?: string | number
  nameEn: string
  nameMr?: string | null
  nameHi?: string | null
  category?: string | null
}

/**
 * Normalizes text for multilingual search:
 * - Applies Unicode NFC normalization
 * - Replaces punctuation, parentheses, brackets, and hyphens with spaces
 * - Collapses multiple spaces and trims
 * - Lowercases Latin characters while preserving Devanagari script
 */
export function normalizeSearchText(input: string): string {
  if (!input) return ''
  return input
    .normalize('NFC')
    .replace(/[()[\]{}\-_.,/\\|+'"`~!@#$%^&*=?:;<>]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase()
}

/**
 * Normalizes Devanagari script variations so common Marathi/Hindi spelling differences match:
 * - Strips nukta (\u093C)
 * - Unifies chandrabindu (ँ) with anusvara (ं)
 * - Unifies short/long i-matra (ि / ी) and u-matra (ु / ू)
 * - Unifies ण and न for Hindi/Marathi cross-script search (e.g. लसूण / लहसुन)
 */
export function normalizeDevanagari(input: string): string {
  return input
    .normalize('NFC')
    .replace(/\u093C/g, '')
    .replace(/\u0901/g, '\u0902')
    .replace(/\u0940/g, '\u093F')
    .replace(/\u0942/g, '\u0941')
    .replace(/\u0923/g, '\u0928')
}

/**
 * Produces a phonetic skeleton for Indian English / Roman transliteration tokens:
 * e.g. "kothimbeer" -> "kotimbir", "bhindee" -> "bindi", "vaangi" -> "vangi",
 * "pyaaz" -> "piaj", "baingan" -> "bengan", "doodhi" -> "dudi".
 */
export function toPhoneticKey(token: string): string {
  const clean = token.trim().toLowerCase()
  if (!clean || !/^[a-z0-9]+$/.test(clean)) return clean

  return clean
    .replace(/ee/g, 'i')
    .replace(/oo/g, 'u')
    .replace(/aa/g, 'a')
    .replace(/ai/g, 'e')
    .replace(/au|ou/g, 'o')
    .replace(/ph/g, 'f')
    .replace(/chh/g, 'ch')
    .replace(/sh/g, 's')
    .replace(/([bcdfgjklmnpqrstvwxz])h/g, '$1')
    .replace(/w/g, 'v')
    .replace(/z/g, 'j')
    .replace(/y$/g, 'i')
    .replace(/(.)\1+/g, '$1')
}

/**
 * Bounded Levenshtein distance <= 1 check for typo tolerance on tokens >= 4 chars.
 */
function isWithinEditDistanceOne(a: string, b: string): boolean {
  if (a === b) return true
  const lenA = a.length
  const lenB = b.length
  if (Math.abs(lenA - lenB) > 1) return false

  let i = 0
  let j = 0
  let edits = 0

  while (i < lenA && j < lenB) {
    if (a[i] === b[j]) {
      i += 1
      j += 1
    } else {
      edits += 1
      if (edits > 1) return false
      if (lenA > lenB) {
        i += 1
      } else if (lenB > lenA) {
        j += 1
      } else {
        i += 1
        j += 1
      }
    }
  }

  if (i < lenA || j < lenB) edits += 1
  return edits <= 1
}

/**
 * Returns all normalized candidate strings & tokens for a vegetable item.
 */
export function getVegetableSearchCandidates(veg: SearchableVegetable): string[] {
  const slug = vegetableSlug(veg.nameEn)
  const dictSynonyms = VEGETABLE_SYNONYMS[slug] ?? []

  const rawList = [
    veg.nameEn,
    veg.nameMr ?? '',
    veg.nameHi ?? '',
    slug.replace(/-/g, ' '),
    ...dictSynonyms,
  ]

  const out = new Set<string>()
  for (const item of rawList) {
    const norm = normalizeSearchText(item)
    if (norm) {
      out.add(norm)
      // Also add concatenated form without spaces (e.g. "kadi patta" -> "kadipatta")
      const compact = norm.replace(/\s+/g, '')
      if (compact) out.add(compact)
    }
  }
  return Array.from(out)
}

/**
 * Matches a single query against a vegetable using:
 * 1. Direct normalized substring match (English, Marathi, Hindi, transliterations)
 * 2. Devanagari normalized substring match
 * 3. Token-by-token phonetic & typo-tolerant matching
 */
export function matchesVegetableSearch(
  veg: SearchableVegetable,
  query: string,
): boolean {
  const normQuery = normalizeSearchText(query)
  if (!normQuery) return true

  const candidates = getVegetableSearchCandidates(veg)
  const compactQuery = normQuery.replace(/\s+/g, '')
  const devQuery = normalizeDevanagari(normQuery)

  // 1. Direct or Devanagari normalized phrase match
  for (const candidate of candidates) {
    if (candidate.includes(normQuery) || candidate.includes(compactQuery)) {
      return true
    }
    const devCandidate = normalizeDevanagari(candidate)
    if (devCandidate.includes(devQuery)) {
      return true
    }
  }

  // 2. Multi-token phonetic & typo-tolerant match
  const queryTokens = normQuery.split(' ').filter(Boolean)
  const candidateWords = new Set<string>()
  for (const candidate of candidates) {
    for (const word of candidate.split(' ')) {
      if (word) candidateWords.add(word)
    }
  }
  const wordList = Array.from(candidateWords)
  const phoneticWordList = wordList.map((w) => ({
    word: w,
    dev: normalizeDevanagari(w),
    phonetic: toPhoneticKey(w),
  }))

  return queryTokens.every((qToken) => {
    const qDev = normalizeDevanagari(qToken)
    const qPhonetic = toPhoneticKey(qToken)

    return phoneticWordList.some(({ word, dev, phonetic }) => {
      if (word.includes(qToken) || dev.includes(qDev)) return true
      if (qPhonetic.length >= 3 && phonetic.includes(qPhonetic)) return true
      if (
        qPhonetic.length >= 4 &&
        phonetic.length >= 4 &&
        isWithinEditDistanceOne(qPhonetic, phonetic)
      ) {
        return true
      }
      if (qToken.length >= 5 && word.length >= 5 && isWithinEditDistanceOne(qToken, word)) {
        return true
      }
      return false
    })
  })
}

/**
 * Filters a list of vegetables by search query and guarantees no duplicate items
 * even when multiple synonyms match the same vegetable.
 */
export function filterVegetablesBySearch<T extends SearchableVegetable>(
  vegetables: readonly T[],
  query: string,
): T[] {
  const seen = new Set<string>()
  const results: T[] = []

  for (const veg of vegetables) {
    const key = veg.id !== undefined ? `id:${String(veg.id)}` : `slug:${vegetableSlug(veg.nameEn)}`
    if (seen.has(key)) continue
    if (matchesVegetableSearch(veg, query)) {
      seen.add(key)
      results.push(veg)
    }
  }

  return results
}
