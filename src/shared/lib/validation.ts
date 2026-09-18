import { z } from 'zod'

/** A name or title: trimmed, never blank. Whitespace-only input is
 * refused rather than saved as an empty-looking record. */
export function requiredText(message: string) {
  return z.string().trim().min(1, message)
}

/** An Indian or international phone number: digits with optional +, spaces,
 * dashes or brackets, 7–15 digits in all. Loose enough for "+91 98450
 * 00011" and "080-2345 6789", strict enough to refuse "abc". */
export const phoneSchema = z
  .string()
  .trim()
  .min(1, 'Phone is required')
  .refine(
    (v) =>
      /^\+?[\d\s()-]+$/.test(v) &&
      v.replace(/\D/g, '').length >= 7 &&
      v.replace(/\D/g, '').length <= 15,
    {
      message: 'Enter a valid phone number',
    },
  )

/** Same rule, optional (blank allowed). */
export const optionalPhoneSchema = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === '' ||
      (/^\+?[\d\s()-]+$/.test(v) &&
        v.replace(/\D/g, '').length >= 7 &&
        v.replace(/\D/g, '').length <= 15),
    {
      message: 'Enter a valid phone number',
    },
  )
  .optional()
