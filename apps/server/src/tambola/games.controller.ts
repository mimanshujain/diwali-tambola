import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { TambolaService } from './tambola.service.js';
import { assertAdmin } from '../security/admin.js';

@Controller('games')
export class GamesController {
  constructor(private readonly tambola: TambolaService) {}

  @Post()
  createGame(@Body() body: { name?: unknown; intervalSeconds?: unknown }, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.createGame(body ?? {});
  }

  @Get(':gameId')
  getGame(@Param('gameId') gameId: string) {
    return this.tambola.getGame(gameId);
  }

  @Post(':gameId/start')
  startGame(@Param('gameId') gameId: string, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.startGame(gameId);
  }

  @Post(':gameId/pause')
  pauseGame(@Param('gameId') gameId: string, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.pauseGame(gameId);
  }

  @Post(':gameId/resume')
  resumeGame(@Param('gameId') gameId: string, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.resumeGame(gameId);
  }

  @Get(':gameId/calls')
  listCalls(@Param('gameId') gameId: string) {
    return this.tambola.listCalls(gameId);
  }

  @Post(':gameId/calls/manual')
  callManualNumber(@Param('gameId') gameId: string, @Body() body: { number?: unknown }, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.callManualNumber(gameId, body?.number);
  }

  @Post(':gameId/tickets')
  generateTicket(@Param('gameId') gameId: string, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.generateTicket(gameId);
  }
}