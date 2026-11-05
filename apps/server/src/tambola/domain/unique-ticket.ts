import { ConflictException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { generateTambolaTicket } from './ticket-generator.js';

/** Caller holds the game row lock. The DB trigger also enforces uniqueness. */
export async function uniqueTicket(client: PoolClient, gameId: string) {
  for (let attempt = 0; attempt < 32; attempt++) {
    const grid = generateTambolaTicket();
    const numbers = grid.flat().filter((n): n is number => n !== null).sort((a, b) => a - b);
    const duplicate = await client.query(
      "SELECT 1 FROM tickets WHERE game_id=$1 AND numbers=$2::smallint[] AND status<>'REVOKED' LIMIT 1",
      [gameId, numbers],
    );
    if (!duplicate.rowCount) return { grid, numbers };
  }
  throw new ConflictException('Could not generate a unique ticket. Please retry.');
}
