import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { WinnersController } from './winners.controller.js';
import { WinnersService } from './winners.service.js';
import { SuddenDeathService } from './sudden-death.service.js';
@Module({imports:[DatabaseModule],controllers:[WinnersController],providers:[WinnersService,SuddenDeathService]})
export class WinnersModule {}
