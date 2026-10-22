/**
 * Zero-based index of the optimal recognition point (coloured letter).
 * Rule: length 1→1, 2–5→2, 6–9→3, 10–13→4, 14+→5 (1-based letter numbers).
 */
export function orpIndex(length: number): number {
  if (length <= 1) return 0
  if (length <= 5) return 1
  if (length <= 9) return 2
  if (length <= 13) return 3
  return 4
}
