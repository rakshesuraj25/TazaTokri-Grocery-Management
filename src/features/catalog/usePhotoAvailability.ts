import { useEffect, useMemo, useState } from 'react'
import { resolveVegetableImage, vegetableSlug } from './vegetableImages'

export type PhotoAvailability = 'checking' | 'photo' | 'illustration'

export interface PhotoProbeTarget {
  nameEn: string
  imageUrl?: string | null
}

/**
 * Probes self-hosted / resolved vegetable image URLs via the browser Image loader
 * without invoking fetch, returning availability keyed by vegetable slug.
 */
export function usePhotoAvailability(targets: readonly PhotoProbeTarget[]) {
  const probeList = useMemo(() => {
    const unique = new Map<string, string>()
    for (const target of targets) {
      const slug = vegetableSlug(target.nameEn)
      if (!slug || unique.has(slug)) continue
      unique.set(slug, resolveVegetableImage(target.nameEn, target.imageUrl))
    }
    return Array.from(unique.entries()).map(([slug, url]) => ({ slug, url }))
  }, [targets])

  const signature = useMemo(
    () => probeList.map((entry) => `${entry.slug}:${entry.url}`).join('|'),
    [probeList],
  )

  const [statuses, setStatuses] = useState<Record<string, PhotoAvailability>>({})

  useEffect(() => {
    if (probeList.length === 0) {
      setStatuses({})
      return
    }

    let cancelled = false
    const nextInitial: Record<string, PhotoAvailability> = {}
    for (const entry of probeList) {
      nextInitial[entry.slug] = entry.url ? 'checking' : 'illustration'
    }
    setStatuses(nextInitial)

    for (const entry of probeList) {
      if (!entry.url) continue
      const img = new window.Image()
      const settle = (value: PhotoAvailability) => {
        if (cancelled) return
        setStatuses((prev) => (prev[entry.slug] === value ? prev : { ...prev, [entry.slug]: value }))
      }
      img.onload = () => {
        settle(img.naturalWidth > 0 ? 'photo' : 'illustration')
      }
      img.onerror = () => settle('illustration')
      img.src = entry.url
    }

    return () => {
      cancelled = true
    }
  }, [signature, probeList])

  return statuses
}
