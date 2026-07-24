import type { Profile } from '@/types';

export const SUBSCRIPTION_DAYS = 30;

/** Explicit PRO fields + full row from Supabase `profiles`. */
export const PROFILE_SELECT = '*, is_pro, pro_expires_at';

export type ProProfileFields = Pick<
  Profile,
  'is_pro' | 'pro_expires_at' | 'is_subscribed' | 'subscribed_until'
>;

/** Strict PRO check: is_pro === true AND pro_expires_at > now. */
export function computeIsPro(
  profile: Pick<Profile, 'is_pro' | 'pro_expires_at'> | null | undefined
): boolean {
  if (!profile?.is_pro) return false;
  if (!profile.pro_expires_at) return false;
  const expiresAt = new Date(profile.pro_expires_at);
  return !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date();
}

function parseExpiry(value: string | null | undefined): number | null {
  if (!value) return null;
  try {
    const ts = new Date(value).getTime();
    return Number.isNaN(ts) ? null : ts;
  } catch {
    return null;
  }
}

/** Resolve expiry from pro_expires_at, falling back to subscribed_until. */
export function getProExpiry(profile: ProProfileFields): string | null {
  return profile.pro_expires_at ?? profile.subscribed_until ?? null;
}

/**
 * Active PRO: is_pro === true AND (pro_expires_at is null OR pro_expires_at > now).
 * Also accepts legacy is_subscribed + subscribed_until when is_pro is not set.
 */
export function hasActivePro(profile: ProProfileFields): boolean {
  if (computeIsPro(profile)) return true;

  if (profile.is_subscribed === true) {
    if (!profile.subscribed_until) return true;
    const ts = parseExpiry(profile.subscribed_until);
    return ts === null ? true : ts > Date.now();
  }

  return false;
}

/** Paywall bypass — same as active PRO (expired users fall back to free limits). */
export function hasActiveSubscription(profile: ProProfileFields): boolean {
  return hasActivePro(profile);
}

/** Visual PRO badge — only when subscription is currently active. */
export function hasProBadge(profile: ProProfileFields): boolean {
  return computeIsPro(profile) || hasActivePro(profile);
}

export function subscriptionExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + SUBSCRIPTION_DAYS);
  return d.toISOString();
}

export function buildSubscriptionActivation(profile: Profile): Partial<Profile> {
  const now = new Date().toISOString();
  const expires = subscriptionExpiresAt();
  return {
    is_subscribed: true,
    subscribed_until: expires,
    pro_expires_at: expires,
    is_pro: true,
    pro_since: profile.pro_since ?? now,
  };
}

export function formatSubscriptionExpiry(
  until: string | null | undefined,
  locale: 'kk' | 'ru'
): string {
  const value = until ?? '';
  if (!value) return locale === 'kk' ? 'белсенді' : 'активна';
  try {
    return new Date(value).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU');
  } catch {
    return value;
  }
}

/** Normalize profile row from Supabase (fill pro_expires_at from subscribed_until). */
export function normalizeProfileProFields(profile: Profile): Profile {
  const pro_expires_at = profile.pro_expires_at ?? profile.subscribed_until ?? null;
  return { ...profile, pro_expires_at };
}
