import { z } from 'zod'

import type { Enums, Tables } from '@/shared/types'

export type Profile = Tables<'profiles'>
export type AppRole = Enums<'app_role'>

/** Where each role lands after login, and where a wrong-role visit gets sent back to. */
export const ROLE_HOME_PATH: Record<AppRole, string> = {
  super_admin: '/dev',
  academy_admin: '/admin',
  coach: '/coach',
  parent: '/parent',
}

export const LoginSchema = z.object({
  email: z.email('Enter a valid email address'),
  password: z.string().min(1, 'Enter your password'),
})
export type Login = z.infer<typeof LoginSchema>

export const ForgotPasswordSchema = z.object({
  email: z.email('Enter a valid email address'),
})
export type ForgotPassword = z.infer<typeof ForgotPasswordSchema>

export const ResetPasswordSchema = z
  .object({
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ResetPassword = z.infer<typeof ResetPasswordSchema>
