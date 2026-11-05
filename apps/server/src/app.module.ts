import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { TambolaModule } from './tambola/tambola.module.js';
import { PlayersModule } from './players/players.module.js';

@Module({
  imports: [DatabaseModule, TambolaModule, PlayersModule],
  controllers: [HealthController],
})
export class AppModule {}
