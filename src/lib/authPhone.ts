/** Normalize Kazakhstan phone numbers to +7XXXXXXXXXX */
export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return phone.trim();
}

export function isValidKzPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return (digits.startsWith('7') && digits.length === 11) || (digits.startsWith('8') && digits.length === 11);
}

/** Synthetic email for Supabase Auth (phone-as-identity without SMS provider). */
export function phoneToAuthEmail(phone: string): string {
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return `${digits}@phone.aktobe-zhumys.kz`;
}

export function isValidPassword(password: string): boolean {
  return password.length >= 6;
}
