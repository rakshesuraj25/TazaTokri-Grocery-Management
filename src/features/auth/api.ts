import { api } from '@/lib/api'
import type {
  LoginRequest,
  LoginResponse,
  MeResponse,
  RegisterRequest,
  SignupRequest,
  UserResponse,
} from './types'

export const authApi = {
  login: (body: LoginRequest) => api.post<LoginResponse>('/api/auth/login', body, { public: true }),

  signup: (body: SignupRequest) => api.post<UserResponse>('/api/auth/signup', body, { public: true }),

  /** OWNER only */
  register: (body: RegisterRequest) => api.post<UserResponse>('/api/auth/register', body),

  me: () => api.get<MeResponse>('/api/me'),
}
