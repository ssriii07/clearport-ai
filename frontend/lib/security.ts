import type { NextRequest } from 'next/server';

/**
 * Explicit canonical app origin avoids Next.js internal URL normalization
 * treating 127.0.0.1 and localhost as different origins.
 * Set CLEARPORT_APP_ORIGIN to the exact HTTPS URL when deploying.
 */
export function isTrustedOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true; // preserve API-client support; browsers send Origin for POST
  const expected = process.env.CLEARPORT_APP_ORIGIN ||
    (process.env.NODE_ENV === 'production' ? '' : 'http://127.0.0.1:3000');
  return Boolean(expected) && origin === expected;
}
