import type { AppUser } from './auth';

function adminEmails() {
  return new Set((process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map(value => value.trim().toLowerCase())
    .filter(Boolean));
}

export function isPlatformAdmin(user: AppUser | null) {
  return Boolean(user?.email && adminEmails().has(user.email.toLowerCase()));
}
