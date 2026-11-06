export type Grid = (number | null)[][];
export const RULE_LABELS = {EARLY_FIVE:'Early Five',EARLY_SEVEN:'Early Seven',EARLY_TEN:'Early Ten',FOUR_CORNERS:'Four Corners',TOP_LINE:'Top Line',MIDDLE_LINE:'Middle Line',BOTTOM_LINE:'Bottom Line',TWO_LINES:'Any Two Lines',ALL_ODD:'All Odd Numbers',ALL_EVEN:'All Even Numbers',FULL_HOUSE:'Full House',SECOND_FULL_HOUSE:'Second Full House'} as const;
export type RuleType = keyof typeof RULE_LABELS;

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
    case 'ALL_ODD': return grid.flat().filter((n):n is number => n!==null && n%2===1);
    case 'ALL_EVEN': return grid.flat().filter((n):n is number => n!==null && n%2===0);
    case 'EARLY_FIVE': case 'EARLY_SEVEN': case 'EARLY_TEN': case 'TWO_LINES': return [];
  }
}
export function isEligible(grid: Grid, rule: RuleType, called: ReadonlySet<number>): boolean {
  if (['EARLY_FIVE','EARLY_SEVEN','EARLY_TEN'].includes(rule)) {
    const target=rule==='EARLY_FIVE'?5:rule==='EARLY_SEVEN'?7:10;
    return grid.flat().filter(n=>n!==null && called.has(n)).length>=target;
  }
  if(rule==='TWO_LINES') return grid.filter(row=>row.filter(n=>n!==null).every(n=>called.has(n))).length>=2;
  const required = requiredNumbers(grid, rule);
  if(rule==='ALL_ODD'||rule==='ALL_EVEN') return required.length>0 && required.every(n=>called.has(n));
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
