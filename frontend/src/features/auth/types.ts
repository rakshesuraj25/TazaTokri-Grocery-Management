export type Role = 'OWNER' | 'STAFF' | 'DELIVERY' | 'CUSTOMER'

export interface AuthUser {
  userId?: number
  fullName?: string
  phone?: string
  roles: Role[]
  expiresInMinutes?: number
  /** epoch ms when the token expires (computed at login) */
  expiresAt?: number
}

export interface LoginRequest {
  phone: string
  password: string
}

export interface SignupRequest {
  fullName: string
  phone: string
  password: string
}

export interface RegisterRequest {
  fullName: string
  phone: string
  email?: string
  password: string
  roles: Role[]
}

export interface LoginResponse {
  token: string
  tokenType: string
  expiresInMinutes: number
  userId: number
  fullName: string
  /** Should be Role[]; parse defensively with normalizeRoles() */
  roles: Role[] | string
}

export interface UserResponse {
  id: number
  fullName: string
  phone: string
  email: string | null
  roles: Role[] | string
}

export interface MeResponse {
  phone?: string
  roles: Role[] | string
  userId?: number
  fullName?: string
}

export interface ChangePasswordRequest {
  currentPassword: string
  newPassword: string
}

export interface ChangePasswordResponse {
  message: string
}
