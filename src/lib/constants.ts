export const APP_NAME = 'Актобе Жұмыс';
/** Default city stored in jobs table */
export const DEFAULT_JOB_CITY = 'Aktobe';
export const DEFAULT_CITY = DEFAULT_JOB_CITY;

export const AKTOBE_DISTRICTS = [
  { id: 'all', labelKk: 'Барлық аудан', labelRu: 'Все районы' },
  { id: 'Батыс-2', labelKk: 'Батыс-2', labelRu: 'Батыс-2' },
  { id: '11-12 мкр', labelKk: '11-12 мкр', labelRu: '11-12 мкр' },
  { id: 'Нұр Ақтөбе', labelKk: 'Нұр Ақтөбе', labelRu: 'Нұр Ақтөбе' },
  { id: 'Шанхай', labelKk: 'Шанхай', labelRu: 'Шанхай' },
  { id: 'Ескі қала', labelKk: 'Ескі қала (Старый город)', labelRu: 'Ескі қала (Старый город)' },
  { id: 'Промзона', labelKk: 'Промзона', labelRu: 'Промзона' },
  { id: 'Жилгородок', labelKk: 'Жилгородок', labelRu: 'Жилгородок' },
] as const;

export const CITIES = [DEFAULT_CITY] as const;

export const CATEGORIES = [
  { id: 'all' },
  { id: 'Delivery' },
  { id: 'Construction' },
  { id: 'Cleaning' },
  { id: 'IT' },
  { id: 'Handyman' },
  { id: 'Moving' },
  { id: 'Tutoring' },
  { id: 'Other' },
] as const;

export const CATEGORY_COLORS: Record<string, string> = {
  Delivery: 'bg-blue-100 text-blue-700',
  Construction: 'bg-orange-100 text-orange-700',
  Cleaning: 'bg-teal-100 text-teal-700',
  IT: 'bg-indigo-100 text-indigo-700',
  Handyman: 'bg-amber-100 text-amber-700',
  Moving: 'bg-purple-100 text-purple-700',
  Tutoring: 'bg-pink-100 text-pink-700',
  Other: 'bg-gray-100 text-gray-700',
};

export const WORKER_SKILL_CATEGORIES = [
  { id: 'Delivery' },
  { id: 'Handyman' },
  { id: 'Moving' },
  { id: 'Cleaning' },
  { id: 'Construction' },
  { id: 'IT' },
  { id: 'Tutoring' },
] as const;

export const DEFAULT_USER_ID = 'user-001';
export const CURRENT_USER_ID = DEFAULT_USER_ID;

/** Admin WhatsApp / payment contact (digits only) */
export const ADMIN_WHATSAPP =
  (import.meta.env.VITE_ADMIN_WHATSAPP ?? '77762916969').replace(/\D/g, '');

/** Kaspi Gold number shown for subscription payment */
export const KASPI_PAYMENT_PHONE =
  import.meta.env.VITE_KASPI_PHONE ?? '+7 776 291 6969';

export const SUBSCRIPTION_PRICE = 590;

export function getDistrictLabel(id: string, locale: 'kk' | 'ru'): string {
  const d = AKTOBE_DISTRICTS.find((x) => x.id === id);
  if (!d) return id;
  return locale === 'kk' ? d.labelKk : d.labelRu;
}
