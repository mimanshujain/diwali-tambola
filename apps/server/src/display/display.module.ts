import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TambolaModule } from '../tambola/tambola.module.js';
import { DisplayController } from './display.controller.js';
import { DisplayService } from './display.service.js';
@Module({imports:[DatabaseModule,TambolaModule],controllers:[DisplayController],providers:[DisplayService]})
export class DisplayModule {}
