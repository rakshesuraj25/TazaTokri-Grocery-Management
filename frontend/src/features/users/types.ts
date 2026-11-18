import type { Role } from '@/features/auth/types'

export interface CustomerAddress {
  id: number | string
  label: string
  line1: string
  line2?: string | null
  landmark?: string | null
  pincode: string
  defaultAddress: boolean
  deliveryInstructions?: string | null
  latitude?: string | number | null
  longitude?: string | number | null
}

export interface CreateAddressRequest {
  label: string
  line1: string
  line2?: string
  landmark?: string
  /** 6-digit Indian pincode */
  pincode: string
  deliveryInstructions?: string
  latitude?: number | null
  longitude?: number | null
}

export interface StaffUser {
  id: number | string
  fullName: string
  phone: string
  email?: string | null
  roles: Role[]
}
