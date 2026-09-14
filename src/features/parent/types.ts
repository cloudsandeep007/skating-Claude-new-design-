import { z } from 'zod'

export const ProfileFormSchema = z.object({
  fullName: z.string().trim().min(1, 'Your name is required'),
  phone: z.string().trim().min(1, 'A phone number is required'),
})
export type ProfileForm = z.infer<typeof ProfileFormSchema>

export const ChangePasswordSchema = z
  .object({
    password: z.string().min(8, 'At least 8 characters'),
    confirmPassword: z.string(),
  })
  .refine((d) => d.password === d.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  })
export type ChangePassword = z.infer<typeof ChangePasswordSchema>
