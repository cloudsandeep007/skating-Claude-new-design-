import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

import { useRequestPasswordReset } from '../api/requestPasswordReset'
import { ForgotPasswordSchema, type ForgotPassword } from '../types'

export function ForgotPasswordPage() {
  const requestReset = useRequestPasswordReset()
  const form = useForm<ForgotPassword>({
    resolver: zodResolver(ForgotPasswordSchema),
    defaultValues: { email: '' },
  })

  async function onSubmit(values: ForgotPassword) {
    try {
      await requestReset.mutateAsync(values)
      toast.success('If that email has an account, a reset link is on its way.')
    } catch {
      toast.error('Something went wrong. Please try again.')
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
          <CardTitle>Forgot password</CardTitle>
          <CardDescription>We'll email you a link to reset it.</CardDescription>
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
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" autoComplete="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={requestReset.isPending}>
                {requestReset.isPending ? 'Sending…' : 'Send reset link'}
              </Button>
            </form>
          </Form>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            <Link to="/login" className="underline underline-offset-4">
              Back to sign in
            </Link>
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
