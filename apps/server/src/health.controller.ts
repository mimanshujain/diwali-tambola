import {
  Controller,
  Get,
  ServiceUnavailableException,
} from '@nestjs/common';
import { DatabaseService } from './database/database.service.js';

@Controller('health')
export class HealthController {
  constructor(private readonly database: DatabaseService) {}

  @Get('live')
  live(): { status: string; service: string } {
    return {
      status: 'ok',
      service: 'diwali-tambola-api',
    };
  }

  @Get('ready')
  async ready(): Promise<{
    status: string;
    service: string;
    dependencies: { database: string };
  }> {
    try {
      await this.database.ping();
      return {
        status: 'ok',
        service: 'diwali-tambola-api',
        dependencies: { database: 'connected' },
      };
    } catch {
      throw new ServiceUnavailableException({
        status: 'error',
        service: 'diwali-tambola-api',
        dependencies: { database: 'unavailable' },
      });
    }
  }
}
