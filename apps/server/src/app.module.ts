import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { TambolaModule } from './tambola/tambola.module.js';

@Module({
  imports: [DatabaseModule, TambolaModule],
  controllers: [HealthController],
})
export class AppModule {}
