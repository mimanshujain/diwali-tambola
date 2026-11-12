import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { HostingService } from './hosting.service.js';
import { HostingController } from './hosting.controller.js';
@Module({imports:[DatabaseModule],controllers:[HostingController],providers:[HostingService],exports:[HostingService]})
export class HostingModule {}
