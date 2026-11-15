import { eligibleAtSequence, requiredNumbers, RULE_LABELS, type Grid, type RuleType } from '../winners/domain/rules.js';

// A legal Tambola ticket. Each column uses its own decade and is sorted vertically.
export const practiceTicket: Grid = [
  [4, null, 22, null, 42, 53, null, 71, null],
  [null, 16, 26, 34, null, null, 63, null, 83],
  [9, null, null, 37, 47, null, null, 77, 89],
];
export const practiceCalls = [65, 22, 34, 42, 77, 89];
export const earlyFiveAt = eligibleAtSequence(practiceTicket, 'EARLY_FIVE', practiceCalls);

export const prizeHelp: Record<RuleType, string> = {
  EARLY_FIVE: 'Match any five numbers anywhere on your ticket.',
  EARLY_SEVEN: 'Match any seven numbers anywhere on your ticket.',
  EARLY_TEN: 'Match any ten numbers anywhere on your ticket.',
  FOUR_CORNERS: 'Match the first and last numbers in both the top and bottom rows.',
  TOP_LINE: 'Match every number in the top row.',
  MIDDLE_LINE: 'Match every number in the middle row.',
  BOTTOM_LINE: 'Match every number in the bottom row.',
  TWO_LINES: 'Match every number in any two rows.',
  ALL_ODD: 'Match every odd number on your ticket. Your ticket must have an odd number.',
  ALL_EVEN: 'Match every even number on your ticket. Your ticket must have an even number.',
  FULL_HOUSE: 'Match all 15 numbers on your ticket.',
  SECOND_FULL_HOUSE: 'Match all 15 numbers. The prize opens after the first Full House is awarded, and first-house winners are ineligible.',
};

const starterRules = ['EARLY_FIVE', 'TOP_LINE', 'FULL_HOUSE'] as const;
export const starterPrizes = starterRules.map(rule => ({
  label: RULE_LABELS[rule],
  help: prizeHelp[rule],
  numbers: rule === 'EARLY_FIVE' ? practiceCalls.slice(1) : requiredNumbers(practiceTicket, rule),
}));
export const playerSteps = [
  'Enter a name your host will recognize and review your ticket.',
  'Once the host approves you, confirm your ticket. Approved drafts also lock in when the game starts.',
  'Watch your ticket light up as its numbers are called. Check Prizes to see which patterns can win.',
] as const;

export function renderTicket(numbers: readonly number[], label: string, preview = false): string {
  const called = new Set(numbers);
  const cells = practiceTicket.flat().map(number => {
    if (number === null) return '<span class="learn-cell blank" aria-hidden="true"></span>';
    const matched = called.has(number);
    return '<span class="learn-cell'+(matched?' matched':'')+'" data-number="'+number+'">'+number
      +(matched?'<span class="sr-only"> matched</span>':'')+'</span>';
  }).join('');
  return '<div class="learn-ticket"'+(preview?' aria-hidden="true"':' role="group" aria-label="'+label+'"')+'>'+cells+'</div>';
}

export function playerQuickGuide(): string {
  return '<details class="panel section-disclosure player-guide"><summary>How to play Tambola</summary>'
    +'<div class="section-body"><ol>'+playerSteps.map(step=>'<li>'+step+'</li>').join('')+'</ol>'
    +'<p>Tambola checks your ticket as numbers are called. Tap <strong>Claim</strong> to alert the host. The host confirms the prize.</p>'
    +'<a href="/how-to-play" target="_blank" rel="noopener">See winning tickets</a></div></details>';
}
