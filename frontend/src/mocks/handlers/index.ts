import { staffCatalogHandler } from './staffCatalog'

/**
 * Optional MSW handlers enabled ONLY when `VITE_USE_MOCKS=true` (or in unit tests).
 * No silent fallbacks to demo data in normal operation.
 */
export const devHandlers = [staffCatalogHandler]
