import type { Profile } from '@/types';

export const SUBSCRIPTION_DAYS = 30;

/** Active subscription — requires admin-activated `is_subscribed`. */
export function hasActiveSubscription(
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>
): boolean {
  if (profile.is_subscribed !== true) return false;
  if (!profile.subscribed_until) return true;
  return new Date(profile.subscribed_until).getTime() > Date.now();
}

/** Badge / display — subscribed or legacy PRO flag */
export function hasProBadge(profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>): boolean {
  return hasActiveSubscription(profile) || profile.is_pro === true;
}

export function subscriptionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SUBSCRIPTION_DAYS);
  return d.toISOString();
}

export function buildSubscriptionActivation(profile: Profile): Partial<Profile> {
  const now = new Date().toISOString();
  return {
    is_subscribed: true,
    subscribed_until: subscriptionExpiresAt(),
    is_pro: true,
    pro_since: profile.pro_since ?? now,
  };
}

export function formatSubscriptionExpiry(until: string | null | undefined, locale: 'kk' | 'ru'): string {
  if (!until) return locale === 'kk' ? 'белсенді' : 'активна';
  try {
    return new Date(until).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU');
  } catch {
    return until;
  }
}
