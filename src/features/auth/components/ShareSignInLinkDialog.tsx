import { Check, Copy, MessageCircle } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Input } from '@/shared/ui/input'

import type { InviteOutcome } from '../api/signInLink'
import { useAcademy } from '../api/getAcademy'
import { useAuth } from '../hooks/useAuth'
import { buildWelcomeLink, inviteMessage, whatsappShareUrl } from '../hooks/inviteLink'

export interface ShareSignInLinkTarget {
  outcome: InviteOutcome
  personName: string
  phone: string | null
  email: string | null
}

interface Props {
  target: ShareSignInLinkTarget | null
  onClose: () => void
}

/** After an account is created (or a new link requested): the one-time
 * sign-in link, ready to copy or send on WhatsApp, and whether an email
 * went out too. The link opens /welcome, where the person sets a password. */
export function ShareSignInLinkDialog({ target, onClose }: Props) {
  const { profile } = useAuth()
  const { data: academy } = useAcademy(profile?.academy_id)
  const [copied, setCopied] = useState(false)

  const link = target?.outcome.token
    ? buildWelcomeLink(window.location.origin, target.outcome.token)
    : null
  const message =
    target && link ? inviteMessage(academy?.name ?? 'academy', target.personName, link) : ''

  async function copy() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => { setCopied(false); }, 2000)
    } catch {
      toast.error('Could not copy — select the link and copy it by hand.')
    }
  }

  return (
    <Dialog
      open={target !== null}
      onOpenChange={(open) => {
        if (!open) onClose()
      }}
    >
      <DialogContent>
        {target && (
          <>
            <DialogHeader>
              <DialogTitle>Sign-in link for {target.personName}</DialogTitle>
              <DialogDescription>
                {target.outcome.emailed
                  ? `An email has gone to ${target.email ?? 'them'} too. `
                  : target.outcome.emailError
                    ? 'The email could not be sent right now, so share this link instead. '
                    : ''}
                The link works once: they open it, set a password, and they are in. It expires in 24
                hours — request a new one from their profile if needed.
              </DialogDescription>
            </DialogHeader>

            {link ? (
              <>
                <div className="flex gap-2">
                  <Input readOnly value={link} onFocus={(e) => { e.currentTarget.select(); }} />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      void copy()
                    }}
                    aria-label="Copy link"
                  >
                    {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  </Button>
                </div>
                <Button asChild className="w-full">
                  <a
                    href={whatsappShareUrl(target.phone, message)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Send on WhatsApp{target.phone ? ` to ${target.phone}` : ''}
                  </a>
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                This person already had an account, so no new link was made. They can sign in with
                their existing password, or use “Forgot password” on the login page.
              </p>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>
                Done
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
