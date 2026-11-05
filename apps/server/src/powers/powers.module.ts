import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { TambolaModule } from '../tambola/tambola.module.js';
import { PowersController } from './powers.controller.js';
import { PowersService } from './powers.service.js';
@Module({imports:[DatabaseModule,TambolaModule],controllers:[PowersController],providers:[PowersService]})
export class PowersModule {}
