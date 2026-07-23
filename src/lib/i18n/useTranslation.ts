import { useLocaleStore } from '@/store/useLocaleStore';
import {
  translations,
  getCategoryLabel,
  getStatusLabel,
  type TranslationKey,
  type Locale,
} from './translations';

export function useTranslation() {
  const locale = useLocaleStore((s) => s.locale);
  const setLocale = useLocaleStore((s) => s.setLocale);

  const t = (key: TranslationKey): string => translations[locale][key];

  return {
    t,
    locale,
    setLocale,
    category: (id: string) => getCategoryLabel(id, locale),
    status: (id: string) => getStatusLabel(id, locale),
  };
}

export function tStatic(key: TranslationKey, locale: Locale): string {
  return translations[locale][key];
}
