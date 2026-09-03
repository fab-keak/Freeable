import 'server-only';

export function isAdminEmail(email: string) {
  const adminEmails = (process.env.ADMIN_EMAILS || '')
    .split(',')
    .map((candidate) => candidate.trim().toLowerCase())
    .filter(Boolean);

  return adminEmails.includes(email.trim().toLowerCase());
}
