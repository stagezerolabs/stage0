const DAYS_PER_UNIT = { days: 1, weeks: 7, months: 30 } as const;

export type AuctionDurationUnit = keyof typeof DAYS_PER_UNIT;

/** Months are fixed 30-day periods, not calendar months. */
export function auctionDurationSeconds(value: string, unit: AuctionDurationUnit): number | null {
  if (!/^\d+$/.test(value.trim())) return null;
  const seconds = Number(value) * DAYS_PER_UNIT[unit] * 86_400;
  return Number.isSafeInteger(seconds) && seconds > 0 ? seconds : null;
}
