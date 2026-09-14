import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

import { useUpdatePassword } from '../api/updatePassword'
import { useAuth } from '../hooks/useAuth'
import { ResetPasswordSchema, ROLE_HOME_PATH, type ResetPassword } from '../types'

/** Reached from the link in a password reset email. Supabase parses the
 * recovery token from the URL into a session automatically (detectSessionInUrl). */
export function ResetPasswordPage() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const updatePassword = useUpdatePassword()
  const form = useForm<ResetPassword>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPassword) {
    try {
      await updatePassword.mutateAsync(values.password)
      toast.success('Password updated.')
      void navigate(profile ? ROLE_HOME_PATH[profile.role] : '/login', { replace: true })
    } catch {
      toast.error('That reset link may have expired. Request a new one from the login page.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <div className="text-center">
        <div className="text-2xl font-extrabold tracking-tight">
          Skating Academy<span className="text-brand-600">.</span>
        </div>
        <div className="mt-1 text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-600">
          Academy management
        </div>
      </div>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>Set a new password</CardTitle>
          <CardDescription>Choose a password with at least 8 characters.</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={(event) => {
                void form.handleSubmit(onSubmit)(event)
              }}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm password</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updatePassword.isPending}>
                {updatePassword.isPending ? 'Updating…' : 'Update password'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  )
}
