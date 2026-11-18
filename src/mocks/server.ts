import { setupServer } from 'msw/node'
import { devHandlers } from './handlers'

/** Node MSW server for Vitest. Tests add per-test handlers via server.use(). */
export const server = setupServer(...devHandlers)
