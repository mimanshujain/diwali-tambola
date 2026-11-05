import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { Client } from 'pg';
import { Server } from 'socket.io';
import { DatabaseService } from '../database/database.service.js';

const CHANGE_CHANNEL = 'tambola_game_changed';
const GAME_ID_RE = /^[a-f\d]{8}-[a-f\d]{4}-[1-8][a-f\d]{3}-[89ab][a-f\d]{3}-[a-f\d]{12}$/i;
const roomFor = (id: string): string => `game:${id}`;

/**
 * Socket.IO transports public invalidation messages only; clients fetch
 * authoritative state from their existing public or authenticated APIs.
 * No admin tokens or player identities ever travel through these events.
 */
@Injectable()
export class LiveService implements OnModuleInit, OnModuleDestroy {
  private io: Server | null = null;
  private listener: Client | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private stopped = false;

  constructor(private readonly database: DatabaseService) {}

  attach(io: Server): void {
    this.io = io;
    io.on('connection', (socket) => {
      socket.on('game:join', async (payload: unknown) => {
        const rawId = typeof payload === 'object' && payload !== null &&
          'gameId' in payload ? (payload as {gameId: unknown}).gameId : undefined;
        if (typeof rawId !== 'string' || !GAME_ID_RE.test(rawId)) {
          socket.emit('game:error', {message: 'Invalid game ID'});
          return;
        }
        const gameId = rawId.toLowerCase();
        try {
          const existing = await this.database.query(
            'SELECT 1 FROM games WHERE id = $1', [gameId],
          );
          if (!existing.rowCount) {
            socket.emit('game:error', {message: 'Game not found'});
            return;
          }
          if (!socket.connected) return;
          // A socket can subscribe to only one game, bounding room usage.
          for (const room of socket.rooms) {
            if (room.startsWith('game:')) await socket.leave(room);
          }
          await socket.join(roomFor(gameId));
          socket.emit('game:joined', {gameId});
        } catch (error) {
          console.error('Failed to join Tambola live game', error);
          socket.emit('game:error', {message: 'Unable to join game'});
        }
      });
    });
  }

  async onModuleInit(): Promise<void> {
    // Ensure migration 006 is committed before subscribing to notifications.
    await this.database.ping();
    await this.connectListener();
  }

  private async connectListener(): Promise<void> {
    if (this.stopped || this.listener) return;
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) return;
    const client = new Client({connectionString, connectionTimeoutMillis: 5_000});
    // Attach disconnect handlers before connect so an early socket error cannot
    // become an unhandled EventEmitter error in the API process.
    client.on('error', (error: Error) => this.disconnected(client, error));
    client.on('end', () => this.disconnected(client, new Error('Listener connection closed')));
    try {
      await client.connect();
      await client.query(`LISTEN ${CHANGE_CHANNEL}`);
      if (this.stopped) {
        await client.end();
        return;
      }
      this.listener = client;
      client.on('notification', (message) => {
        if (message.channel !== CHANGE_CHANNEL || !message.payload ||
            !GAME_ID_RE.test(message.payload)) return;
        const gameId = message.payload.toLowerCase();
        this.io?.to(roomFor(gameId)).emit('game:changed', {gameId});
      });
      console.log('Live game notifications subscribed.');
    } catch (error) {
      console.warn('Live notifications unavailable; polling fallback remains active', error);
      try { await client.end(); } catch { /* already disconnected */ }
      this.scheduleReconnect();
    }
  }

  private disconnected(client: Client, error: Error): void {
    if (this.listener !== client) return;
    this.listener = null;
    client.removeAllListeners('notification');
    client.removeAllListeners('error');
    client.removeAllListeners('end');
    void client.end().catch(() => undefined);
    if (!this.stopped) {
      console.warn('Live notification listener disconnected; reconnecting', error.message);
      this.scheduleReconnect();
    }
  }

  private scheduleReconnect(): void {
    if (this.stopped || this.reconnectTimer) return;
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.connectListener();
    }, 5_000);
    this.reconnectTimer.unref();
  }

  async onModuleDestroy(): Promise<void> {
    this.stopped = true;
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    this.reconnectTimer = null;
    const client = this.listener;
    this.listener = null;
    if (client) {
      client.removeAllListeners('notification');
      client.removeAllListeners('error');
      client.removeAllListeners('end');
      try { await client.end(); } catch { /* connection already closed */ }
    }
    this.io?.close();
    this.io = null;
  }
}
