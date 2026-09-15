import { useEffect } from 'react'
import { zodResolver } from '@hookform/resolvers/zod'
import { LogOut } from 'lucide-react'
import { useForm } from 'react-hook-form'
import { Link } from 'react-router-dom'
import { toast } from 'sonner'

import { useAuth } from '@/features/auth'
import { Button } from '@/shared/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/shared/ui/card'
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/shared/ui/form'
import { Input } from '@/shared/ui/input'

import { useChangePassword, useUpdateMyProfile } from '../api/myProfile'
import { useCurrentChild } from '../hooks/useSelectedChild'
import {
  ChangePasswordSchema,
  ProfileFormSchema,
  type ChangePassword,
  type ProfileForm,
} from '../types'

export function ParentProfilePage() {
  const { profile, signOut } = useAuth()
  const { children } = useCurrentChild()
  const updateProfile = useUpdateMyProfile()
  const changePassword = useChangePassword()

  const profileForm = useForm<ProfileForm>({
    resolver: zodResolver(ProfileFormSchema),
    defaultValues: { fullName: '', phone: '' },
  })
  const passwordForm = useForm<ChangePassword>({
    resolver: zodResolver(ChangePasswordSchema),
    defaultValues: { password: '', confirmPassword: '' },
  })

  useEffect(() => {
    if (profile) profileForm.reset({ fullName: profile.full_name, phone: profile.phone ?? '' })
  }, [profile, profileForm])

  async function saveProfile(values: ProfileForm) {
    if (!profile) return
    try {
      await updateProfile.mutateAsync({ profileId: profile.id, form: values })
      toast.success('Details saved.')
    } catch {
      toast.error('Could not save your details.')
    }
  }

  async function savePassword(values: ChangePassword) {
    try {
      await changePassword.mutateAsync(values.password)
      passwordForm.reset()
      toast.success('Password changed.')
    } catch {
      toast.error('Could not change your password.')
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="font-display text-2xl font-extrabold tracking-tight">Profile</h1>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your details</CardTitle>
          <CardDescription>{profile?.email}</CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...profileForm}>
            <form
              onSubmit={(event) => {
                void profileForm.handleSubmit(saveProfile)(event)
              }}
              className="space-y-4"
            >
              <FormField
                control={profileForm.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={profileForm.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Phone</FormLabel>
                    <FormControl>
                      <Input type="tel" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={updateProfile.isPending}>
                {updateProfile.isPending ? 'Saving…' : 'Save'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Your skaters</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {children.map((c) => (
              <li key={c.id} className="py-2 font-bold">
                <Link to="/parent/child" className="underline-offset-4 hover:underline">
                  {c.fullName}
                </Link>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Change password</CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...passwordForm}>
            <form
              onSubmit={(event) => {
                void passwordForm.handleSubmit(savePassword)(event)
              }}
              className="space-y-4"
            >
              <FormField
                control={passwordForm.control}
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
                control={passwordForm.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm</FormLabel>
                    <FormControl>
                      <Input type="password" autoComplete="new-password" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                variant="outline"
                className="w-full"
                disabled={changePassword.isPending}
              >
                {changePassword.isPending ? 'Changing…' : 'Change password'}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Button
        variant="outline"
        className="w-full"
        onClick={() => {
          void signOut()
        }}
      >
        <LogOut className="h-4 w-4" />
        Sign out
      </Button>
    </div>
  )
}
