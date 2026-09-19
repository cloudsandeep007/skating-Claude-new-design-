/** How a sign-in link is built and shared. The link points at this app's
 * own /welcome page with the one-time token; the page verifies it with
 * Supabase directly, so the link works on any origin (localhost, Vercel)
 * without the auth redirect allow-list. */

export type SignInTokenType = 'invite' | 'recovery'

export interface SignInToken {
  tokenHash: string
  tokenType: SignInTokenType
}

export function buildWelcomeLink(origin: string, token: SignInToken): string {
  const params = new URLSearchParams({ t: token.tokenHash, type: token.tokenType })
  return `${origin.replace(/\/$/, '')}/welcome?${params.toString()}`
}

/** Digits only, with India's country code assumed for a bare 10-digit
 * number — what wa.me expects. Null when there aren't enough digits. */
export function whatsappNumber(phone: string | null | undefined): string | null {
  if (!phone) return null
  let digits = phone.replace(/\D/g, '')
  if (digits.startsWith('0')) digits = digits.slice(1)
  if (digits.length === 10) digits = `91${digits}`
  return digits.length >= 11 && digits.length <= 15 ? digits : null
}

export function inviteMessage(academyName: string, personName: string, link: string): string {
  const first = personName.trim().split(/\s+/)[0] || 'there'
  return `Hi ${first}, here is your sign-in link for the ${academyName} app. Open it once to set your password:\n${link}`
}

export function whatsappShareUrl(phone: string | null | undefined, text: string): string {
  const number = whatsappNumber(phone)
  const encoded = encodeURIComponent(text)
  return number ? `https://wa.me/${number}?text=${encoded}` : `https://wa.me/?text=${encoded}`
}
