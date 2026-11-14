import { Body, Controller, Delete, Get, Headers, Param, Post } from '@nestjs/common';
import { TambolaService } from './tambola.service.js';
import { assertAdmin } from '../security/admin.js';

@Controller('games')
export class GamesController {
  constructor(private readonly tambola: TambolaService) {}

  @Post()
  createGame(@Body() body: { name?: unknown; intervalSeconds?: unknown; themeId?: unknown; themeLayers?: unknown; welcomeMessage?: unknown }, @Headers('x-admin-key') key?: string) {
    assertAdmin(key);
    return this.tambola.createGame(body ?? {});
  }

  @Post(':gameId/admin/appearance')
  appearance(@Param('gameId') id:string,@Headers('x-admin-key') key:string|undefined,@Body() body:{name?:unknown;themeId?:unknown;themeLayers?:unknown;welcomeMessage?:unknown;confirmLive?:unknown}) {assertAdmin(key);return this.tambola.updateAppearance(id,body??{});}

  @Get()
  listGames(@Headers('x-admin-key') key?:string) { assertAdmin(key);return this.tambola.listGames(); }
  @Delete(':gameId/admin/game')
  deleteGame(@Param('gameId') id:string,@Headers('x-admin-key') key:string|undefined,@Body() body:{confirmationCode?:unknown}) {
    assertAdmin(key);return this.tambola.deleteGame(id,body?.confirmationCode);
  }
  @Post(':gameId/admin/stop')
  stop(@Param('gameId') id:string,@Headers('x-admin-key') key?:string) {assertAdmin(key);return this.tambola.stopGame(id,'stop');}
  @Post(':gameId/admin/release-stop')
  release(@Param('gameId') id:string,@Headers('x-admin-key') key?:string) {assertAdmin(key);return this.tambola.stopGame(id,'release');}
  @Post(':gameId/admin/end')
  end(@Param('gameId') id:string,@Headers('x-admin-key') key?:string) {assertAdmin(key);return this.tambola.stopGame(id,'end');}
  @Post(':gameId/admin/timer')
  timer(@Param('gameId') id:string,@Headers('x-admin-key') key:string|undefined,@Body() body:{seconds?:unknown;intervalSeconds?:unknown}) {assertAdmin(key);return this.tambola.setTimer(id,body??{});}
  @Post(':gameId/admin/call-next')
  next(@Param('gameId') id:string,@Headers('x-admin-key') key:string|undefined,@Body() body:{expectedSequence?:unknown}) {assertAdmin(key);return this.tambola.callNextNow(id,body?.expectedSequence);}
  @Get(':gameId/admin/audit')
  audit(@Param('gameId') id:string,@Headers('x-admin-key') key?:string) {assertAdmin(key);return this.tambola.audit(id);}
  @Get(':gameId/admin/ticket-conflicts')
  conflicts(@Param('gameId') id:string,@Headers('x-admin-key') key?:string) {assertAdmin(key);return this.tambola.ticketConflicts(id);}

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
