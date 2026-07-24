/** Client-side password hash (no plain text stored in Supabase). */
const PASSWORD_SALT = 'aktobe-zhumys-phone-v1';

export async function hashPassword(password: string): Promise<string> {
  const data = new TextEncoder().encode(PASSWORD_SALT + password);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export async function verifyPassword(password: string, passwordHash: string): Promise<boolean> {
  const hash = await hashPassword(password);
  return hash === passwordHash;
}
