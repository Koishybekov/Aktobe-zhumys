/** Strip phone to digits only (no +, spaces, brackets, dashes). */
export function phoneDigitsOnly(phone: string): string {
  return phone.replace(/\D/g, '');
}

/** Normalize Kazakhstan phone numbers to +7XXXXXXXXXX */
export function normalizePhone(phone: string): string {
  const digits = phoneDigitsOnly(phone);
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return phone.trim();
}

export function isValidKzPhone(phone: string): boolean {
  const digits = phoneDigitsOnly(phone);
  return (digits.startsWith('7') && digits.length === 11) || (digits.startsWith('8') && digits.length === 11);
}

/**
 * Synthetic email for Supabase Auth (phone + password without SMS provider).
 * Uses RFC 2606 reserved domain — accepted by Supabase email validation.
 */
export function phoneToAuthEmail(phone: string): string {
  const digits = phoneDigitsOnly(normalizePhone(phone));
  return `user_${digits}@example.com`;
}

/** Legacy format for accounts registered before email fix. */
export function phoneToAuthEmailLegacy(phone: string): string {
  const digits = phoneDigitsOnly(normalizePhone(phone));
  return `${digits}@phone.aktobe-zhumys.kz`;
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}
