import { cloudMode, cloudOrigin } from '../hosting/context.js';
/**
 * The guest-facing hostname is a deployment setting, never derived from an
 * untrusted Host / X-Forwarded-Host header.
 */
export function publicGuestOrigin(): string | null {
  if (cloudMode()) return cloudOrigin();
  const configured = process.env.PUBLIC_GUEST_ORIGIN?.trim();
  if (!configured) return null;
  const url = new URL(configured);
  if (url.protocol !== 'https:' || !url.hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) {
    throw new Error('PUBLIC_GUEST_ORIGIN must be an HTTPS origin, e.g. https://play.example.com');
  }
  return url.origin;
}
