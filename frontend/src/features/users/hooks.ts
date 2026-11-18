import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { deliveryKeys } from '@/features/delivery/hooks'
import type { RegisterRequest } from '@/features/auth/types'
import { usersApi } from './api'
import type { CreateAddressRequest } from './types'

export const usersKeys = {
  all: ['users'] as const,
  addresses: () => [...usersKeys.all, 'addresses'] as const,
}

export function useCustomerAddresses(enabled = true) {
  return useQuery({
    queryKey: usersKeys.addresses(),
    queryFn: () => usersApi.listAddresses(),
    enabled,
  })
}

export function useCreateAddress() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: CreateAddressRequest) => usersApi.createAddress(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: usersKeys.addresses() })
    },
  })
}

export function useRegisterUser() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (body: RegisterRequest) => usersApi.registerUser(body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: deliveryKeys.people() })
    },
  })
}
