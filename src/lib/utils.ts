import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow } from 'date-fns';
import { ru } from 'date-fns/locale';
import { kk } from 'date-fns/locale/kk';
import { useLocaleStore } from '@/store/useLocaleStore';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPrice(price: number): string {
  return new Intl.NumberFormat('kk-KZ', {
    style: 'decimal',
    maximumFractionDigits: 0,
  }).format(price) + ' ₸';
}

export function formatRelativeTime(dateString: string): string {
  try {
    const locale = useLocaleStore.getState().locale;
    const dateFnsLocale = locale === 'kk' ? kk : ru;
    return formatDistanceToNow(new Date(dateString), { addSuffix: true, locale: dateFnsLocale });
  } catch {
    const locale = useLocaleStore.getState().locale;
    return locale === 'kk' ? 'жақында' : 'недавно';
  }
}

export function generateId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);
}

export function renderStars(rating: number): string {
  const full = Math.floor(rating);
  const half = rating % 1 >= 0.5 ? 1 : 0;
  const empty = 5 - full - half;
  return '★'.repeat(full) + (half ? '½' : '') + '☆'.repeat(empty);
}
