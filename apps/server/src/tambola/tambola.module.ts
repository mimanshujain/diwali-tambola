import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { GameSchedulerService } from './game-scheduler.service.js';
import { GamesController } from './games.controller.js';
import { TambolaService } from './tambola.service.js';

@Module({
  imports: [DatabaseModule],
  controllers: [GamesController],
  providers: [TambolaService, GameSchedulerService],
  exports: [TambolaService],
})
export class TambolaModule {}
