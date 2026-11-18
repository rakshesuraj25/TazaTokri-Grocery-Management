import { describe, expect, it } from 'vitest'
import { defaultRole, normalizeRoles, postLoginPath } from '@/features/auth/roles'

describe('auth role normalization & routing', () => {
  it('parses array, comma-separated, bracketed, and Spring ROLE_ prefixed strings defensively', () => {
    expect(normalizeRoles(['OWNER', 'DELIVERY'])).toEqual(['OWNER', 'DELIVERY'])
    expect(normalizeRoles(['ROLE_OWNER', 'ROLE_DELIVERY'])).toEqual(['OWNER', 'DELIVERY'])
    expect(normalizeRoles('[ROLE_STAFF, ROLE_DELIVERY]')).toEqual(['STAFF', 'DELIVERY'])
    expect(normalizeRoles('CUSTOMER')).toEqual(['CUSTOMER'])
    expect(normalizeRoles('ROLE_CUSTOMER')).toEqual(['CUSTOMER'])
    expect(normalizeRoles(null)).toEqual([])
  })

  it('picks default role by priority OWNER > STAFF > DELIVERY > CUSTOMER', () => {
    expect(defaultRole(['DELIVERY', 'OWNER'])).toBe('OWNER')
    expect(defaultRole(['CUSTOMER', 'STAFF'])).toBe('STAFF')
  })

  it('routes to role home or safe allowed next path', () => {
    expect(postLoginPath(['OWNER'])).toBe('/staff/dashboard')
    expect(postLoginPath(['STAFF'])).toBe('/staff/sale')
    expect(postLoginPath(['DELIVERY'])).toBe('/delivery')
    expect(postLoginPath(['CUSTOMER'])).toBe('/shop')
    expect(postLoginPath(['CUSTOMER'], '/staff/sale')).toBe('/shop')
    expect(postLoginPath(['STAFF'], '/staff/stock')).toBe('/staff/stock')
  })
})
