import { Body, Controller, Get, Header, Headers, Param, Post } from '@nestjs/common';
import { PlayersService } from './players.service.js';
import { renderJoinPage } from './join-page-m6.js';

@Controller()
export class PlayersController {
  constructor(private readonly players: PlayersService) {}

  @Get('join/:gameId')
  @Header('Content-Type', 'text/html; charset=utf-8')
  joinPage(): string {
    return renderJoinPage();
  }

  @Post('games/:gameId/players/register')
  register(@Param('gameId') gameId: string, @Body() body: Record<string, unknown>) {
    return this.players.register(gameId, body ?? {});
  }

  @Post('games/:gameId/players/recover')
  recover(@Param('gameId') id:string,@Body() body:Record<string,unknown>) {return this.players.recover(id,body??{});}
  @Post('games/:gameId/admin/players/:playerId/approve')
  approve(@Param('gameId') id:string,@Param('playerId') playerId:string,@Headers('x-admin-key') key?:string) {return this.players.approve(id,playerId,key);}
  @Post('games/:gameId/admin/players/:playerId/withdraw')
  withdraw(@Param('gameId') id:string,@Param('playerId') playerId:string,@Headers('x-admin-key') key?:string) {return this.players.withdraw(id,playerId,key);}
  @Post('games/:gameId/admin/players/:playerId/reset-access')
  resetAccess(@Param('gameId') id:string,@Param('playerId') playerId:string,@Headers('x-admin-key') key?:string) {return this.players.resetAccess(id,playerId,key);}

  @Get('games/:gameId/players/me')
  me(@Param('gameId') gameId: string, @Headers('authorization') authorization?: string) {
    return this.players.me(gameId, authorization);
  }

  @Post('games/:gameId/players/me/submit')
  submit(@Param('gameId') gameId: string, @Headers('authorization') authorization:string|undefined, @Body() body:{ticketId?:unknown}) {
    return this.players.submit(gameId, authorization, body?.ticketId);
  }

  @Post('games/:gameId/players/me/regenerate')
  regenerate(@Param('gameId') gameId: string, @Headers('authorization') authorization?: string) {
    return this.players.regenerate(gameId, authorization);
  }

  @Get('games/:gameId/admin/players')
  listPlayers(@Param('gameId') gameId: string, @Headers('x-admin-key') key?: string) {
    return this.players.listPlayers(gameId, key);
  }

  @Post('games/:gameId/admin/players/:playerId/reissue')
  reissue(
    @Param('gameId') gameId: string,
    @Param('playerId') playerId: string,
    @Body() body: { reason?: unknown },
    @Headers('x-admin-key') key?: string,
  ) {
    return this.players.reissue(gameId, playerId, body?.reason, key);
  }
}
