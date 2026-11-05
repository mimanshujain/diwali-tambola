/** M5 resolution policy. Only other *eligible claimants* have priority during a
 * Lucky Strike window. After the window, the powered player wins if nobody
 * else claimed. Existing earlier eligibility always takes precedence. */
export interface Candidate {
  playerId: string;
  ticketId: string;
  sequence: number;
  claimed: boolean;
}
export function selectPriorityCandidates(
  candidates: readonly Candidate[], poweredPlayerId: string, callSequence: number,
): Candidate[] {
  const others = candidates.filter(c => c.playerId !== poweredPlayerId && c.claimed && c.sequence <= callSequence);
  if (others.length) {
    const earliest = Math.min(...others.map(c => c.sequence));
    return others.filter(c => c.sequence === earliest);
  }
  return candidates.filter(c => c.playerId === poweredPlayerId && c.sequence === callSequence);
}
export function assertChosenNumber(number: unknown): number {
  if (typeof number !== 'number' || !Number.isInteger(number) || number < 1 || number > 90) {
    throw new Error('Choose an integer from 1 to 90');
  }
  return number;
}
