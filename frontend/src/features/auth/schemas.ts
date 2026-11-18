import { z } from 'zod'

/** Contract: phone ^[6-9][0-9]{9}$, password 8-64 chars. Messages are i18n keys. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^[6-9][0-9]{9}$/, 'auth.invalidPhone')

export const passwordSchema = z.string().min(8, 'auth.passwordLength').max(64, 'auth.passwordLength')

export const loginSchema = z.object({
  phone: phoneSchema,
  password: passwordSchema,
})
export type LoginForm = z.infer<typeof loginSchema>

export const signupSchema = z
  .object({
    fullName: z.string().trim().min(2, 'auth.nameRequired').max(100, 'auth.nameRequired'),
    phone: phoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'auth.passwordMismatch',
  })
export type SignupForm = z.infer<typeof signupSchema>
