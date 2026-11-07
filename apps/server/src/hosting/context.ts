import { AsyncLocalStorage } from 'node:async_hooks';
import { UnauthorizedException } from '@nestjs/common';

export interface HostIdentity { id: string; email: string; name: string; }
export const hostContext = new AsyncLocalStorage<HostIdentity>();
export const cloudMode = (): boolean => process.env.HOSTING_MODE === 'cloud';
export function hostId(): string | null {
  if (!cloudMode()) return null;
  const host = hostContext.getStore();
  if (!host) throw new UnauthorizedException('Sign in to your host account');
  return host.id;
}

export function cloudOrigin(): string {
  const url = new URL(process.env.PUBLIC_APP_ORIGIN ?? '');
  if (url.protocol !== 'https:' || url.username || url.password || url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_APP_ORIGIN must be an HTTPS origin');
  }
  return url.origin;
}

export function allowedEmails(): Set<string> {
  return new Set((process.env.HOST_ALLOWED_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean));
}

export function validateHosting(): void {
  if (!['lan', 'cloud'].includes(process.env.HOSTING_MODE ?? 'lan')) throw new Error('Invalid HOSTING_MODE');
  if (!cloudMode()) return;
  cloudOrigin();
  for (const key of ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'HOST_ALLOWED_EMAILS']) {
    if (!process.env[key]?.trim()) throw new Error(`${key} is required in cloud mode`);
  }
  if (!allowedEmails().size || ![...allowedEmails()].every(email => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new Error('Invalid HOST_ALLOWED_EMAILS');
}
