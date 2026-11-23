import { api } from '@/lib/api'
import type {
  ChangePasswordRequest,
  ChangePasswordResponse,
  ForgotPasswordRequest,
  ForgotPasswordResponse,
  LoginRequest,
  LoginResponse,
  MeResponse,
  PhoneUpdateResponse,
  RegisterRequest,
  ResetPasswordRequest,
  SignupRequest,
  UserResponse,
  VerificationChallengeResponse,
} from './types'

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>('/api/auth/login', body, { public: true }),

  signup: (body: SignupRequest) => api.post<UserResponse>('/api/auth/signup', body, { public: true }),

  /** OWNER only */
  register: (body: RegisterRequest) => api.post<UserResponse>('/api/auth/register', body),

  changePassword: (body: ChangePasswordRequest) =>
    api.post<ChangePasswordResponse>('/api/auth/change-password', body),

  forgotPassword: (body: ForgotPasswordRequest) =>
    api.post<ForgotPasswordResponse>('/api/auth/forgot-password', body, { public: true }),

  resetPassword: (body: ResetPasswordRequest) =>
    api.post<{ message: string }>('/api/auth/reset-password', body, { public: true }),

  me: () => api.get<MeResponse>('/api/me'),
}

export const accountApi = {
  getProfile: () => api.get<UserResponse>('/api/account/profile'),

  requestPhoneVerification: (body: { newPhone: string; currentPassword: string }) =>
    api.post<VerificationChallengeResponse>('/api/account/phone/request-verification', body),

  confirmPhoneChange: (body: { newPhone: string; otp: string; challengeToken: string }) =>
    api.post<PhoneUpdateResponse>('/api/account/phone/confirm', body),

  requestEmailVerification: (body: { newEmail: string; currentPassword: string }) =>
    api.post<VerificationChallengeResponse>('/api/account/email/request-verification', body),

  confirmEmailChange: (body: { newEmail: string; otp: string; challengeToken: string }) =>
    api.post<{ message: string; user: UserResponse }>('/api/account/email/confirm', body),

  deleteAccount: (body: { currentPassword: string; confirmation: string }) =>
    api.post<{ message: string }>('/api/account/delete', body),
}
