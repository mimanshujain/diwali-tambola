import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { PlayersController } from './players.controller.js';
import { PlayersService } from './players.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [PlayersController],
  providers: [PlayersService],
})
export class PlayersModule {}
