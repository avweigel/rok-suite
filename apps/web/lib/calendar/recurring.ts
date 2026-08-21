// Interval-based recurrence shared by the timed calendars.
//
// Both AoO (every 14 days) and Ancient Ruins (every 39 hours) are "anchor
// instant + fixed offset" series. A 39-hour cadence in particular can't be
// expressed as a weekday rule — it walks around the clock, landing at a
// different time of day on each pass — so everything here works in absolute
// milliseconds rather than calendar fields.

export interface IntervalSeries {
  /** First occurrence — exact UTC instant. */
  anchorUtc: string;
  /** Gap between occurrences, in milliseconds. */
  stepMs: number;
  /** Occurrence length, in milliseconds. */
  durationMs: number;
  /** Optional exclusive end of the series. Unset = open-ended. */
  untilUtc?: string;
}

export interface IntervalOccurrence {
  startIso: string;
  endIso: string;
}

/** Every occurrence of `series` overlapping `[from, to]`.
 *
 *  Never emits before the anchor, so a window opening earlier than the
 *  series began doesn't invent history. */
export function expandInterval(series: IntervalSeries, from: Date, to: Date): IntervalOccurrence[] {
  const out: IntervalOccurrence[] = [];
  const anchor = new Date(series.anchorUtc).getTime();
  const until = series.untilUtc ? new Date(series.untilUtc).getTime() : Infinity;
  const step = series.stepMs;
  if (!Number.isFinite(step) || step <= 0) return out;

  const limit = Math.min(to.getTime(), until);

  // Jump straight to the first occurrence that could overlap `from` instead
  // of stepping from the anchor — a window years later would otherwise cost
  // a loop iteration per step.
  const elapsed = from.getTime() - anchor;
  const skipped = elapsed > 0 ? Math.floor(elapsed / step) : 0;
  let cur = anchor + skipped * step;

  while (cur <= limit) {
    const end = cur + series.durationMs;
    if (end > from.getTime()) {
      out.push({ startIso: new Date(cur).toISOString(), endIso: new Date(end).toISOString() });
    }
    cur += step;
  }
  return out;
}

export const MS_PER_HOUR = 3_600_000;
export const MS_PER_DAY = 86_400_000;
