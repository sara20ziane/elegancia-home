/**
 * Which page numbers to show: the first, the last, the current and its
 * neighbours, with `null` marking a gap.
 *
 * Exported and pure so the arithmetic is unit-tested rather than clicked through.
 * The off-by-one here is the classic one, and a pager that skips page 2 is the
 * kind of thing nobody notices until they need page 2.
 */
export function pageWindow(page: number, pageCount: number, span = 1): (number | null)[] {
  // Short enough to show in full, so show it in full. Windowing a five-page
  // catalogue into "1 2 … 5" hides two pages for no gain.
  const FULL_LIMIT = 7;
  if (pageCount <= FULL_LIMIT) {
    return Array.from({ length: Math.max(pageCount, 1) }, (_, index) => index + 1);
  }

  const wanted = new Set<number>([1, pageCount]);
  for (let offset = -span; offset <= span; offset++) {
    const candidate = page + offset;
    if (candidate >= 1 && candidate <= pageCount) wanted.add(candidate);
  }

  const sorted = [...wanted].sort((a, b) => a - b);
  const result: (number | null)[] = [];
  let previous = 0;
  for (const value of sorted) {
    // A gap of exactly one is shown as the number, not as an ellipsis.
    if (previous && value - previous === 2) result.push(previous + 1);
    else if (previous && value - previous > 2) result.push(null);
    result.push(value);
    previous = value;
  }
  return result;
}
