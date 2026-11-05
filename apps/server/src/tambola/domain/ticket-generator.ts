import { randomInt } from 'node:crypto';

export type TicketCell = number | null;
export type TicketGrid = TicketCell[][];

export const TAMBOLA_COLUMN_RANGES: ReadonlyArray<readonly [number, number]> = [
  [1, 9],
  [10, 19],
  [20, 29],
  [30, 39],
  [40, 49],
  [50, 59],
  [60, 69],
  [70, 79],
  [80, 90],
];

function secureShuffle<T>(values: readonly T[]): T[] {
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = randomInt(index + 1);
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }
  return shuffled;
}

/**
 * Generates a standard Indian Tambola ticket:
 * - 3 rows x 9 columns
 * - exactly 5 numbers in each row (15 total)
 * - every column has 1-3 numbers
 * - numbers increase top-to-bottom within each column
 * - each column uses its standard 1-9, 10-19, ..., 80-90 range
 */
export function generateTambolaTicket(): TicketGrid {
  const columns = Array.from({ length: 9 }, (_, index) => index);
  const firstRowColumns = secureShuffle(columns).slice(0, 5);
  const secondRowColumns = secureShuffle(columns).slice(0, 5);
  const coveredByFirstTwo = new Set([...firstRowColumns, ...secondRowColumns]);
  const uncovered = columns.filter((column) => !coveredByFirstTwo.has(column));
  const extrasNeeded = 5 - uncovered.length;
  const extras = secureShuffle([...coveredByFirstTwo]).slice(0, extrasNeeded);
  const thirdRowColumns = [...uncovered, ...extras];

  const occupiedRowsByColumn: number[][] = Array.from({ length: 9 }, () => []);
  [firstRowColumns, secondRowColumns, thirdRowColumns].forEach((rowColumns, rowIndex) => {
    rowColumns.forEach((columnIndex) => occupiedRowsByColumn[columnIndex].push(rowIndex));
  });

  const grid: TicketGrid = Array.from({ length: 3 }, () => Array<TicketCell>(9).fill(null));

  occupiedRowsByColumn.forEach((rowIndexes, columnIndex) => {
    const [minimum, maximum] = TAMBOLA_COLUMN_RANGES[columnIndex];
    const availableNumbers = Array.from(
      { length: maximum - minimum + 1 },
      (_, index) => minimum + index,
    );
    const chosenNumbers = secureShuffle(availableNumbers)
      .slice(0, rowIndexes.length)
      .sort((left, right) => left - right);

    rowIndexes.sort((left, right) => left - right).forEach((rowIndex, numberIndex) => {
      grid[rowIndex][columnIndex] = chosenNumbers[numberIndex];
    });
  });

  assertValidTicketGrid(grid);
  return grid;
}

/** Throws when a grid violates any standard Tambola ticket invariant. */
export function assertValidTicketGrid(grid: TicketGrid): void {
  if (grid.length !== 3 || grid.some((row) => row.length !== 9)) {
    throw new Error('A Tambola ticket must contain exactly 3 rows and 9 columns.');
  }

  const flattened = grid.flat();
  const numbers = flattened.filter((value): value is number => value !== null);
  if (numbers.length !== 15 || new Set(numbers).size !== 15) {
    throw new Error('A Tambola ticket must contain 15 unique numbers.');
  }

  for (const row of grid) {
    if (row.filter((value) => value !== null).length !== 5) {
      throw new Error('Each Tambola ticket row must contain exactly 5 numbers.');
    }
  }

  for (let columnIndex = 0; columnIndex < 9; columnIndex += 1) {
    const columnNumbers = grid
      .map((row) => row[columnIndex])
      .filter((value): value is number => value !== null);
    const [minimum, maximum] = TAMBOLA_COLUMN_RANGES[columnIndex];

    if (columnNumbers.length < 1 || columnNumbers.length > 3) {
      throw new Error('Each Tambola ticket column must contain between 1 and 3 numbers.');
    }
    if (columnNumbers.some((value) => value < minimum || value > maximum)) {
      throw new Error(`Ticket column ${columnIndex + 1} contains a number outside its range.`);
    }
    if (columnNumbers.some((value, index) => index > 0 && value <= columnNumbers[index - 1])) {
      throw new Error(`Ticket column ${columnIndex + 1} must increase from top to bottom.`);
    }
  }
}
