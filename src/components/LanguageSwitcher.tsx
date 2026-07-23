import { cn } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { Locale } from '@/lib/i18n/translations';

interface LanguageSwitcherProps {
  className?: string;
  size?: 'sm' | 'md';
}

export function LanguageSwitcher({ className, size = 'md' }: LanguageSwitcherProps) {
  const { locale, setLocale, t } = useTranslation();

  const options: { id: Locale; label: string }[] = [
    { id: 'kk', label: 'KK' },
    { id: 'ru', label: 'RU' },
  ];

  return (
    <div
      className={cn(
        'inline-flex rounded-xl bg-gray-100 p-0.5',
        size === 'sm' ? 'text-xs' : 'text-sm',
        className
      )}
      role="group"
      aria-label={t('chooseLanguage')}
    >
      {options.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          onClick={() => setLocale(id)}
          className={cn(
            'rounded-lg font-semibold transition-all',
            size === 'sm' ? 'px-2.5 py-1' : 'px-3.5 py-1.5',
            locale === id
              ? 'bg-white text-emerald-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  );
}
