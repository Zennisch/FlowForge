import type { User } from '@/types/auth.types';

function base64UrlDecode(input: string): string {
  const normalized = input.replace(/-/g, '+').replace(/_/g, '/');
  const padded = normalized.padEnd(normalized.length + ((4 - (normalized.length % 4)) % 4), '=');
  return atob(padded);
}

export function extractUserFromAccessToken(token: string): User | null {
  const parts = token.split('.');
  if (parts.length < 2) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(parts[1])) as Record<string, unknown>;

    const id = payload.sub ?? payload.id ?? payload.userId ?? payload.uid;
    const email = payload.email ?? payload.preferred_username ?? payload.upn;

    if (typeof id !== 'string' || typeof email !== 'string' || !email.includes('@')) {
      return null;
    }

    return {
      id,
      email,
    };
  } catch {
    return null;
  }
}
