import { Module } from '@nestjs/common';
import { DatabaseModule } from '../database/database.module.js';
import { LiveService } from './live.service.js';

@Module({
  imports: [DatabaseModule],
  providers: [LiveService],
  exports: [LiveService],
})
export class LiveModule {}
