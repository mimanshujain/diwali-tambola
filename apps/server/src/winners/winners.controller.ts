import { Body, Controller, Get, Headers, Param, Patch, Post } from '@nestjs/common';
import { WinnersService } from './winners.service.js';
@Controller('games/:gameId')
export class WinnersController {
  constructor(private readonly winners: WinnersService) {}
  @Get('categories') categories(@Param('gameId') id:string){return this.winners.categories(id);}
  @Patch('admin/categories/:categoryId') configure(@Param('gameId') gameId:string,@Param('categoryId') categoryId:string,@Headers('x-admin-key') key:string|undefined,@Body() body:Record<string,unknown>){return this.winners.configure(gameId,categoryId,key,body);}
  @Post('players/me/claims') claim(@Param('gameId') id:string,@Headers('authorization') token:string|undefined,@Body() body:{categoryId?:unknown}){return this.winners.claim(id,token,body?.categoryId);}
  @Get('admin/claims') claims(@Param('gameId') id:string,@Headers('x-admin-key') key:string|undefined){return this.winners.listClaims(id,key);}
  @Get('admin/eligible-winners') eligible(@Param('gameId') id:string,@Headers('x-admin-key') key:string|undefined){return this.winners.listEligible(id,key);}
  @Post('admin/categories/:categoryId/resolve') resolve(@Param('gameId') gameId:string,@Param('categoryId') categoryId:string,@Headers('x-admin-key') key:string|undefined){return this.winners.resolve(gameId,categoryId,key);}
}
