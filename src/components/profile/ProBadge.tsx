import { Crown } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hasProBadge } from '@/lib/subscription';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { Profile } from '@/types';

interface ProBadgeProps {
  profile: Pick<Profile, 'is_pro' | 'pro_expires_at' | 'is_subscribed' | 'subscribed_until'> | null | undefined;
  size?: 'sm' | 'md';
  className?: string;
}

export function ProBadge({ profile, size = 'sm', className }: ProBadgeProps) {
  const { t } = useTranslation();

  if (!profile || !hasProBadge(profile)) return null;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full bg-gradient-to-r from-indigo-600 to-emerald-600 font-bold text-white shrink-0',
        size === 'sm' ? 'px-1.5 py-0.5 text-[10px]' : 'px-2 py-0.5 text-xs',
        className
      )}
      title={t('proBadge')}
    >
      <Crown className={size === 'sm' ? 'h-2.5 w-2.5' : 'h-3 w-3'} />
      {t('proBadge')}
    </span>
  );
}
