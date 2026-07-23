import { normalizePhone } from '@/lib/authPhone';

/** Admin phone for payments, WhatsApp receipts, and admin panel access */
export const ADMIN_PHONE = '+77762916969';
export const ADMIN_PHONE_DIGITS = '77762916969';

export function isAdminPhone(phone: string | undefined | null): boolean {
  if (!phone) return false;
  const digits = normalizePhone(phone).replace(/\D/g, '');
  return digits === ADMIN_PHONE_DIGITS;
}

/** Bilingual KK + RU WhatsApp receipt message for subscription payment */
export function buildPaymentReceiptMessage(userPhone: string): string {
  const phone = normalizePhone(userPhone);
  return (
    `Сәлеметсіз бе! Мен подпискаға төлем жасадым.\n` +
    `Менің телефон нөмірім: ${phone}\n` +
    `Өтініш, аккаунтымды белсендіріп (активация) беріңізші.\n\n` +
    `Здравствуйте! Я оплатил(а) подписку.\n` +
    `Мой номер телефона: ${phone}\n` +
    `Пожалуйста, активируйте мой аккаунт.`
  );
}
