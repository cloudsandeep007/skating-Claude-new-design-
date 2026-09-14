/** Where a level sits on the overall ladder, as a percentage — level 1 of 9
 * is ~0%, level 9 of 9 is 100%. Used for the parent's progression bar. */
export function ladderPct(sequence: number, totalLevels: number): number {
  if (totalLevels <= 1) return 100
  return Math.round(((sequence - 1) / (totalLevels - 1)) * 100)
}
