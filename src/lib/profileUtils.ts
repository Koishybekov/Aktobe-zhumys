import { DEFAULT_CITY } from '@/lib/constants';
import type { Profile } from '@/types';

/** Normalize profile for UI — never throws on null/undefined fields. */
export function resolveDisplayProfile(
  authProfile: Profile | null | undefined,
  storeUser: Profile | null | undefined
): Profile {
  const source =
    authProfile?.id ? authProfile : storeUser?.id ? storeUser : authProfile ?? storeUser;

  const ratingRaw = source?.rating;
  const rating =
    typeof ratingRaw === 'number' && !Number.isNaN(ratingRaw)
      ? ratingRaw
      : Number(ratingRaw) || 0;

  return {
    id: source?.id ?? '',
    phone: source?.phone ?? '',
    full_name: source?.full_name?.trim() ?? '',
    avatar_url: source?.avatar_url ?? null,
    role: source?.role ?? 'both',
    rating,
    city: source?.city ?? DEFAULT_CITY,
    district: source?.district ?? '',
    skills: Array.isArray(source?.skills) ? source.skills : [],
    offer_accepted_at: source?.offer_accepted_at ?? null,
    onboarding_completed: source?.onboarding_completed ?? false,
    is_pro: source?.is_pro ?? false,
    is_subscribed: source?.is_subscribed ?? false,
    subscribed_until: source?.subscribed_until ?? null,
    pro_since: source?.pro_since ?? null,
  };
}

export function hasDisplayProfile(profile: Profile): boolean {
  return Boolean(profile.id || profile.phone);
}

export function formatProfileRating(rating: number | null | undefined): string {
  const value = typeof rating === 'number' && !Number.isNaN(rating) ? rating : Number(rating) || 0;
  return value.toFixed(1);
}

export function formatOfferDate(value: string | null | undefined, locale: 'kk' | 'ru'): string {
  if (!value) return '';
  try {
    return new Date(value).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU');
  } catch {
    return '';
  }
}
