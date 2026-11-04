/** A player's reported lead (frames ahead of their rival, for rollback time sync): a small whole number, or nothing. */
export const leadOf = (a: unknown): number | undefined =>
  typeof a === 'number' && Number.isFinite(a) ? Math.max(-120, Math.min(120, Math.round(a))) : undefined;
