import { NavLink, useLocation } from 'react-router-dom';
import { Compass, PlusCircle, Briefcase, MessageCircle, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';

export function BottomNav() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { to: '/', icon: Compass, label: t('navExplore') },
    { to: '/create', icon: PlusCircle, label: t('navPost') },
    { to: '/my-jobs', icon: Briefcase, label: t('navMyJobs') },
    { to: '/messages', icon: MessageCircle, label: t('navChat') },
    { to: '/profile', icon: User, label: t('navProfile') },
  ];

  const activeChatCount = useAppStore((s) => {
    const uid = getActiveUserId();
    return s.jobs.reduce(
      (count, j) =>
        j.status === 'in_progress' &&
        (j.client_id === uid || j.selected_worker_id === uid)
          ? count + 1
          : count,
      0
    );
  });

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-gray-100 bg-white/95 backdrop-blur-lg safe-bottom md:hidden">
      <div className="flex items-center justify-around px-2 py-2">
        {navItems.map(({ to, icon: Icon, label }) => {
          const isActive = location.pathname === to;
          const showBadge = to === '/messages' && activeChatCount > 0;
          return (
            <NavLink
              key={to}
              to={to}
              className={cn(
                'flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-xl transition-colors relative min-w-[56px]',
                isActive ? 'text-emerald-600' : 'text-gray-400 hover:text-gray-600'
              )}
            >
              <div className="relative">
                <Icon className={cn('h-5 w-5', isActive && 'stroke-[2.5]')} />
                {showBadge && (
                  <span className="absolute -top-1 -right-1.5 h-4 w-4 rounded-full bg-emerald-500 text-[10px] font-bold text-white flex items-center justify-center">
                    {activeChatCount}
                  </span>
                )}
              </div>
              <span className={cn('text-[10px] font-medium', isActive && 'font-semibold')}>{label}</span>
            </NavLink>
          );
        })}
      </div>
    </nav>
  );
}

export function DesktopNav() {
  const location = useLocation();
  const { t } = useTranslation();

  const navItems = [
    { to: '/', icon: Compass, label: t('navExplore') },
    { to: '/create', icon: PlusCircle, label: t('navPost') },
    { to: '/my-jobs', icon: Briefcase, label: t('navMyJobs') },
    { to: '/messages', icon: MessageCircle, label: t('navChat') },
    { to: '/profile', icon: User, label: t('navProfile') },
  ];

  return (
    <nav className="hidden md:flex items-center gap-1 bg-gray-50 rounded-xl p-1">
      {navItems.map(({ to, icon: Icon, label }) => {
        const isActive = location.pathname === to;
        return (
          <NavLink
            key={to}
            to={to}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive ? 'bg-white text-emerald-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        );
      })}
    </nav>
  );
}
