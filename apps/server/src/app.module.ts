import { Module } from '@nestjs/common';
import { DatabaseModule } from './database/database.module.js';
import { HealthController } from './health.controller.js';
import { TambolaModule } from './tambola/tambola.module.js';
import { PlayersModule } from './players/players.module.js';
import { WinnersModule } from './winners/winners.module.js';
import { PowersModule } from './powers/powers.module.js';
import { DisplayModule } from './display/display.module.js';

@Module({
  imports: [DatabaseModule, TambolaModule, PlayersModule, WinnersModule, PowersModule, DisplayModule],
  controllers: [HealthController],
})
export class AppModule {}