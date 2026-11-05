import { Controller, Get, Header, Headers, Param, Redirect } from '@nestjs/common';
import QRCode from 'qrcode';
import { DisplayService } from './display.service.js';
import { adminPage, homeAdminPage, tvPage } from './pages.js';
import { PARTY_CLIENT_JS } from '../party/party-client.js';
import { LIVE_CLIENT_JS } from '../live/live-client.js';
@Controller()
export class DisplayController {
  constructor(private readonly display:DisplayService){}
  @Get('live/client.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  clientScript(): string { return LIVE_CLIENT_JS; }
  @Get('party/client.js')
  @Header('Content-Type', 'application/javascript; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  partyClient(): string { return PARTY_CLIENT_JS; }
  @Get('g/:code')
  @Redirect(undefined, 302)
  async joinByCode(@Param('code') code: string): Promise<{url:string}> {
    const id = await this.display.resolveJoinCode(code);
    return {url: '/join/'+encodeURIComponent(id)};
  }
  @Get('tv/:gameId') @Header('Content-Type','text/html; charset=utf-8')
  tv(@Param('gameId') gameId:string):string {return tvPage(gameId);}
  @Get('admin') @Header('Content-Type','text/html; charset=utf-8')
  adminHome():string {return homeAdminPage();}
  @Get('admin/:gameId') @Header('Content-Type','text/html; charset=utf-8')
  admin(@Param('gameId') gameId:string):string {return adminPage(gameId);}
  @Get('tv/:gameId/qr.svg') @Header('Content-Type','image/svg+xml; charset=utf-8')
  @Header('Cache-Control','no-store')
  async qr(@Param('gameId') id:string,@Headers('host') rawHost?:string):Promise<string>{
    // Don't allow an untrusted Host header to put an external phishing URL in the TV QR.
    const host=rawHost??'';
    if(!/^(?:[\da-zA-Z.-]+)(?::\d{1,5})?$/.test(host))throw new Error('Invalid request host');
    const snapshot = await this.display.snapshot(id); // validates UUID and game existence
    const game = snapshot.game as {joinCode:string};
    return QRCode.toString('http://'+host+'/g/'+encodeURIComponent(game.joinCode),
      {type:'svg',margin:2,width:280,errorCorrectionLevel:'M'});
  }
  @Get('games/:gameId/display') snapshot(@Param('gameId') id:string){return this.display.snapshot(id);}
  @Get('games/:gameId/admin/players/:playerId/ticket')
  ticket(@Param('gameId') id:string,@Param('playerId') playerId:string,@Headers('x-admin-key') key?:string){return this.display.adminTicket(id,playerId,key);}
}
