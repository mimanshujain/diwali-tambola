import assert from 'node:assert/strict';
import test from 'node:test';
import {
  assertValidTicketGrid,
  generateTambolaTicket,
  TAMBOLA_COLUMN_RANGES,
} from './ticket-generator.js';

test('generates valid Indian Tambola tickets across repeated samples', () => {
  for (let sample = 0; sample < 500; sample += 1) {
    const ticket = generateTambolaTicket();
    assert.doesNotThrow(() => assertValidTicketGrid(ticket));

    assert.equal(ticket.length, 3);
    assert.ok(ticket.every((row) => row.length === 9));
    assert.ok(ticket.every((row) => row.filter((value) => value !== null).length === 5));
    assert.equal(ticket.flat().filter((value) => value !== null).length, 15);

    for (let column = 0; column < 9; column += 1) {
      const values = ticket
        .map((row) => row[column])
        .filter((value): value is number => value !== null);
      const [minimum, maximum] = TAMBOLA_COLUMN_RANGES[column];
      assert.ok(values.length >= 1 && values.length <= 3);
      assert.ok(values.every((value) => value >= minimum && value <= maximum));
      assert.ok(values.every((value, index) => index === 0 || value > values[index - 1]));
    }
  }
});
