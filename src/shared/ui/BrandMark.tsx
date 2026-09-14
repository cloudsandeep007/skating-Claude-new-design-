import prsaLogo from '@/assets/prsa-logo.png'

/** The PRSA logo, centered above the auth cards (sign in, forgot/reset
 * password) — the one place a full, larger lockup makes sense. */
export function BrandMark() {
  return (
    <div className="text-center">
      <img src={prsaLogo} alt="PRSA" className="mx-auto h-auto w-[200px]" />
      <div className="mt-1 text-[11px] font-semibold uppercase tracking-[.12em] text-neutral-600">
        Academy management
      </div>
    </div>
  )
}
