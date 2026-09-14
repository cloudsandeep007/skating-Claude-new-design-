import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/shared/ui/select'

import { useCurrentChild } from '../hooks/useSelectedChild'

/** Big tappable child switcher when there's more than one; a plain heading otherwise. */
export function ChildSelector({ subtitle }: { subtitle?: string }) {
  const { children, child, setChildId } = useCurrentChild()
  if (!child) return null

  return (
    <div>
      {subtitle && (
        <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          {subtitle}
        </div>
      )}
      {children.length > 1 ? (
        <Select value={child.id} onValueChange={setChildId}>
          <SelectTrigger className="mt-1 h-12 w-full text-lg font-extrabold tracking-tight">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {children.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.fullName}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <h1 className="text-2xl font-extrabold tracking-tight">{child.fullName}</h1>
      )}
    </div>
  )
}
