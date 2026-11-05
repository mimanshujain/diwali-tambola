import { randomInt } from 'node:crypto';

/** Cryptographically shuffled sequence using unbiased Fisher-Yates. */
export function shuffledPool(): number[] {
  const values = Array.from({ length: 90 }, (_, i) => i + 1);
  for (let i = values.length - 1; i > 0; i--) {
    const j = randomInt(i + 1);
    [values[i], values[j]] = [values[j], values[i]];
  }
  return values;
}

export function miniTicket(size: number): number[] {
  if (!Number.isInteger(size) || size < 1 || size > 15) throw new RangeError('ticket size must be 1–15');
  return shuffledPool().slice(0, size).sort((a, b) => a - b);
}

/** Winning is decided on a draw, not on client request arrival time. */
export function completedParticipants(
  entries: ReadonlyArray<{ playerId: string; numbers: readonly number[] }>,
  called: ReadonlySet<number>,
): string[] {
  return entries.filter(e => e.numbers.length > 0 && e.numbers.every(n => called.has(n))).map(e => e.playerId);
}

