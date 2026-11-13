import { Body, Controller, Get, Header, Headers, Param, Post, Query, Res } from '@nestjs/common';
import { assertAdmin } from '../security/admin.js';
import { CommentaryService } from './commentary.service.js';
@Controller('games/:gameId/commentary')
export class CommentaryController {
 constructor(private readonly service:CommentaryService){}
 @Get() @Header('Cache-Control','no-store')
 poll(@Param('gameId') id:string,@Query('after') after?:string){return this.service.poll(id,after);}
 @Get(':seq/audio') @Header('Cache-Control','private, max-age=300')
 async audio(@Param('gameId') id:string,@Param('seq') seq:string,@Res() res:{setHeader:(name:string,value:string)=>void;send:(value:Buffer)=>void}){const bytes=await this.service.audio(id,seq);res.setHeader('Content-Type','audio/mpeg');res.send(bytes);}
 @Get('admin/settings')
 settings(@Param('gameId') id:string,@Headers('x-admin-key') key?:string){assertAdmin(key);return this.service.settings(id);}
 @Post('admin/settings')
 update(@Param('gameId') id:string,@Body() body:Record<string,unknown>,@Headers('x-admin-key') key?:string){assertAdmin(key);return this.service.update(id,body??{});}
}
