import { Outlet, useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { BottomNav, DesktopNav } from './BottomNav';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { Button } from '@/components/ui/button';
import { useToast } from '@/components/ui/use-toast';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { useAuthStore } from '@/store/useAuthStore';
import { useAppStore } from '@/store/useAppStore';
import { APP_NAME } from '@/lib/constants';

export function AppLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { toast } = useToast();
  const logout = useAuthStore((s) => s.logout);
  const profile = useAuthStore((s) => s.profile);

  const handleLogout = async () => {
    useAppStore.getState().resetSession();
    await logout();
    navigate('/auth', { replace: true });
    toast({ title: t('signedOut'), variant: 'default' });
  };

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
            <Button
              variant="ghost"
              size="sm"
              className="hidden sm:inline-flex text-gray-600 hover:text-red-600"
              onClick={() => void handleLogout()}
              title={t('signOut')}
            >
              <LogOut className="h-4 w-4" />
              <span className="sr-only">{t('signOut')}</span>
            </Button>
          </div>
        </div>
        {profile?.phone && (
          <div className="mx-auto max-w-3xl px-4 pb-2 -mt-1">
            <p className="text-[10px] text-gray-400 truncate">{profile.phone}</p>
          </div>
        )}
      </header>

      <main className="mx-auto max-w-3xl px-4 pb-24 md:pb-8 pt-4">
        <Outlet />
      </main>

      <BottomNav />
    </div>
  );
}
