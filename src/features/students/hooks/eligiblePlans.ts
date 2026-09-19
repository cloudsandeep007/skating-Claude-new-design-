/** Which fee plans a skater in `batchId` may be put on: academy-wide plans
 * (no batch) and plans scoped to that batch. A plan scoped to another batch
 * would bill at the wrong rate (and, for per-class plans, count the wrong
 * schedule), so it is not offered at all. */
export function eligibleFeePlans<T extends { batchId: string | null }>(
  plans: T[],
  batchId: string,
): T[] {
  return plans.filter((p) => p.batchId === null || p.batchId === '' || p.batchId === batchId)
}

/** True when the plan the form currently holds is no longer allowed for the
 * batch — the caller clears it. */
export function planNoLongerFits(
  plans: { id: string; batchId: string | null }[],
  planId: string,
  batchId: string,
): boolean {
  if (!planId) return false
  const plan = plans.find((p) => p.id === planId)
  if (!plan) return false
  return !!plan.batchId && plan.batchId !== batchId
}
