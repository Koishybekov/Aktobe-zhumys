import { Outlet } from 'react-router-dom';
import { BottomNav, DesktopNav } from './BottomNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { APP_NAME } from '@/lib/constants';

export function AppLayout() {
  const { t } = useTranslation();

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-30 border-b border-gray-100 bg-white/95 backdrop-blur-lg">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-600 text-white text-xs font-bold">
              АЖ
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-bold text-gray-900 leading-tight truncate">{APP_NAME}</h1>
              <p className="text-[10px] text-emerald-600 font-medium -mt-0.5 truncate">{t('appTagline')}</p>
            </div>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <LanguageSwitcher size="sm" />
            <DesktopNav />
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 md:pb-8 pt-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
