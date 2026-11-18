import { api } from '@/lib/api'
import { authApi } from '@/features/auth/api'
import type { RegisterRequest } from '@/features/auth/types'
import type { CreateAddressRequest, CustomerAddress } from './types'

export const usersApi = {
  listAddresses: () => api.get<CustomerAddress[]>('/api/customer/addresses'),
  createAddress: (body: CreateAddressRequest) =>
    api.post<CustomerAddress>('/api/customer/addresses', body),

  /** OWNER only — registers a new staff/delivery/owner/customer user */
  registerUser: (body: RegisterRequest) => authApi.register(body),
}
