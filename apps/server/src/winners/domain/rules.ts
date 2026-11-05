export type Grid = (number | null)[][];
export type RuleType = 'EARLY_FIVE' | 'FOUR_CORNERS' | 'TOP_LINE' | 'MIDDLE_LINE' | 'BOTTOM_LINE' | 'FULL_HOUSE' | 'SECOND_FULL_HOUSE';

/** Traditional corners: the first and last occupied cells in top and bottom rows. */
export function requiredNumbers(grid: Grid, rule: RuleType): number[] {
  if (grid.length !== 3 || grid.some(row => row.length !== 9)) throw new Error('Invalid ticket grid');
  const row = (index: number) => grid[index].filter((n): n is number => Number.isInteger(n));
  switch (rule) {
    case 'FOUR_CORNERS': return [row(0)[0],row(0).at(-1),row(2)[0],row(2).at(-1)].filter((n): n is number => n !== undefined);
    case 'TOP_LINE': return row(0);
    case 'MIDDLE_LINE': return row(1);
    case 'BOTTOM_LINE': return row(2);
    case 'FULL_HOUSE':
    case 'SECOND_FULL_HOUSE': return grid.flat().filter((n): n is number => n !== null);
    case 'EARLY_FIVE': return [];
  }
}
export function isEligible(grid: Grid, rule: RuleType, called: ReadonlySet<number>): boolean {
  if (rule === 'EARLY_FIVE') return grid.flat().filter((n): n is number => n !== null && called.has(n)).length >= 5;
  const required = requiredNumbers(grid, rule);
  const expected = rule === 'FOUR_CORNERS' ? 4 : ['FULL_HOUSE','SECOND_FULL_HOUSE'].includes(rule) ? 15 : 5;
  return required.length === expected && required.every(n => called.has(n));
}
/** A claim is tied by the earliest draw sequence that made the category true, not by phone latency. */
export function eligibleAtSequence(grid: Grid, rule: RuleType, draw: number[]): number | null {
  const called = new Set<number>();
  for (let i = 0; i < draw.length; i++) {
    called.add(draw[i]);
    if (isEligible(grid, rule, called)) return i + 1;
  }
  return null;
}
