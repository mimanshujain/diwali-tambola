import { Body, Controller, Get, Headers, Param, Post } from '@nestjs/common';
import { PowersService } from './powers.service.js';
@Controller('games/:gameId')
export class PowersController {
  constructor(private readonly powers:PowersService){}
  @Get('players/me/power') mine(@Param('gameId') id:string,@Headers('authorization') token?:string){return this.powers.mine(id,token);}
  @Post('players/me/power/request') request(@Param('gameId') id:string,@Headers('authorization') token:string|undefined,@Body() body:{number?:unknown}){return this.powers.request(id,token,body?.number);}
  @Get('admin/power-requests') pending(@Param('gameId') id:string,@Headers('x-admin-key') key?:string){return this.powers.pending(id,key);}
  @Post('admin/power-requests/:requestId/approve') approve(@Param('gameId') id:string,@Param('requestId') reqId:string,@Headers('x-admin-key') key?:string){return this.powers.decide(id,reqId,'approve',key);}
  @Post('admin/power-requests/:requestId/reject') reject(@Param('gameId') id:string,@Param('requestId') reqId:string,@Headers('x-admin-key') key?:string){return this.powers.decide(id,reqId,'reject',key);}
}
