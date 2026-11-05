import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { WinnersController } from './winners.controller.js';
import { WinnersService } from './winners.service.js';
@Module({imports:[DatabaseModule],controllers:[WinnersController],providers:[WinnersService]})
export class WinnersModule {}
