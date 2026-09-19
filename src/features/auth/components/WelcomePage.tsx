import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'

import { BrandMark } from '@/shared/ui/BrandMark'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'
import { Skeleton } from '@/shared/ui/skeleton'

import { markProfileActive, useAcceptSignInLink } from '../api/acceptSignInLink'
import { useUpdatePassword } from '../api/updatePassword'
import type { SignInTokenType } from '../hooks/inviteLink'
import { useAuth } from '../hooks/useAuth'
import { ResetPasswordSchema, ROLE_HOME_PATH, type ResetPassword } from '../types'

type Stage = 'verifying' | 'set-password' | 'invalid'

/** Where a sign-in link lands (/welcome?t=…&type=invite|recovery). The
 * one-time token is verified here, then the person chooses a password and
 * goes straight to their home screen. No email round-trip involved. */
export function WelcomePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const { profile } = useAuth()
  const accept = useAcceptSignInLink()
  const updatePassword = useUpdatePassword()
  const [stage, setStage] = useState<Stage>('verifying')
  const started = useRef(false)

  const tokenHash = params.get('t') ?? ''
  const rawType = params.get('type')
  const tokenType: SignInTokenType = rawType === 'recovery' ? 'recovery' : 'invite'

  useEffect(() => {
    if (started.current) return
    started.current = true
    if (!tokenHash) {
      setStage('invalid')
      return
    }
    accept.mutate(
      { tokenHash, tokenType },
      {
        onSuccess: () => { setStage('set-password'); },
        onError: () => { setStage('invalid'); },
      },
    )
  }, [accept, tokenHash, tokenType])

  const form = useForm<ResetPassword>({
    resolver: zodResolver(ResetPasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  async function onSubmit(values: ResetPassword) {
    try {
      await updatePassword.mutateAsync(values.password)
      if (profile) await markProfileActive(profile.id)
      toast.success('You’re all set.')
      void navigate(profile ? ROLE_HOME_PATH[profile.role] : '/', { replace: true })
    } catch {
      toast.error('Could not save the password. Try again, or ask the academy for a new link.')
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 p-4">
      <BrandMark />
      <Card className="w-full max-w-sm">
        {stage === 'verifying' && (
          <>
            <CardHeader>
              <CardTitle>One moment…</CardTitle>
              <CardDescription>Checking your sign-in link.</CardDescription>
            </CardHeader>
            <CardContent>
              <Skeleton className="h-10 w-full" />
            </CardContent>
          </>
        )}

        {stage === 'invalid' && (
          <>
            <CardHeader>
              <CardTitle>This link has expired</CardTitle>
              <CardDescription>
                Sign-in links work once and for 24 hours. Ask the academy for a new one, or if you
                already have a password, sign in.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              <Button asChild>
                <Link to="/login">Sign in</Link>
              </Button>
              <Button asChild variant="outline">
                <Link to="/forgot-password">I forgot my password</Link>
              </Button>
            </CardContent>
          </>
        )}

        {stage === 'set-password' && (
          <>
            <CardHeader>
              <CardTitle>
                {profile?.full_name ? `Welcome, ${profile.full_name.split(' ')[0]}` : 'Welcome'}
              </CardTitle>
              <CardDescription>
                Choose a password (at least 8 characters). You’ll use it with{' '}
                {profile?.email ? <strong>{profile.email}</strong> : 'your email'} to sign in next
                time.
              </CardDescription>
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
                        <FormLabel>Password</FormLabel>
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
                    {updatePassword.isPending ? 'Saving…' : 'Save and continue'}
                  </Button>
                </form>
              </Form>
            </CardContent>
          </>
        )}
      </Card>
    </div>
  )
}
