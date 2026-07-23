import { create } from 'zustand';
import type { Locale } from '@/lib/i18n/translations';

const LOCALE_KEY = 'aktobe_zhumys_locale';

interface LocaleState {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  hydrate: () => void;
}

export const useLocaleStore = create<LocaleState>((set) => ({
  locale: 'kk',

  setLocale: (locale) => {
    localStorage.setItem(LOCALE_KEY, locale);
    document.documentElement.lang = locale === 'kk' ? 'kk' : 'ru';
    set({ locale });
  },

  hydrate: () => {
    const saved = localStorage.getItem(LOCALE_KEY) as Locale | null;
    const locale = saved === 'ru' || saved === 'kk' ? saved : 'kk';
    document.documentElement.lang = locale === 'kk' ? 'kk' : 'ru';
    set({ locale });
  },
}));
