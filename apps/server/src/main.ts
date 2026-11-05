import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import { Server } from 'socket.io';
import { LiveService } from './live/live.service.js';
import type { IncomingMessage } from 'node:http';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log'],
  });

  app.enableShutdownHooks();
  const io = new Server(app.getHttpServer(), {
    path: '/socket.io', serveClient: true,
    transports: ['websocket', 'polling'],
    maxHttpBufferSize: 8_192,
    pingInterval: 25_000, pingTimeout: 20_000,
    allowRequest: (request: IncomingMessage, callback: (error: string | null | undefined, allow: boolean) => void) => {
      // Cross-origin pages may not subscribe to game events.
      const origin = request.headers.origin;
      try {
        if (origin && new URL(origin).host !== request.headers.host) {
          callback('Origin not allowed', false); return;
        }
        callback(null, true);
      } catch {
        callback('Malformed Origin', false);
      }
    },
  });
  app.get(LiveService).attach(io);

  const port = Number(process.env.PORT ?? 3000);
  await app.listen(port, '0.0.0.0');
  console.log(`Diwali Tambola API listening on port ${port}`);
}

bootstrap().catch((error: unknown) => {
  console.error('Failed to start Diwali Tambola API', error);
  process.exit(1);
});
