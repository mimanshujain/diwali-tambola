import { UnauthorizedException } from '@nestjs/common';
import { createHash, timingSafeEqual } from 'node:crypto';
export function assertAdmin(key?: string): void {
  const configured = process.env.ADMIN_TOKEN;
  if (!configured || !key) throw new UnauthorizedException('Admin key required');
  const a = createHash('sha256').update(key).digest();
  const b = createHash('sha256').update(configured).digest();
  if (!timingSafeEqual(a, b)) throw new UnauthorizedException('Invalid admin key');
}
