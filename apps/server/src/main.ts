import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Diwali Tambola API listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start Diwali Tambola API', error);
  process.exit(1);
});
