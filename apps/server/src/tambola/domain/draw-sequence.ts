import { randomInt } from 'node:crypto';

/** Cryptographically shuffles the complete Tambola number set without replacement. */
export function createShuffledNumbers(): number[] {
  const numbers = Array.from({ length: 90 }, (_, index) => index + 1);

  // Fisher-Yates with crypto.randomInt avoids modulo bias and Math.random().
  for (let index = numbers.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [numbers[index], numbers[swapIndex]] = [numbers[swapIndex], numbers[index]];
  }

  return numbers;
}
