import { supabase, IS_MOCK_MODE } from '@/lib/supabase';
import { normalizePhone, phoneDigitsOnly, phoneToAuthEmail, phoneToAuthEmailLegacy } from '@/lib/authPhone';
import { PROFILE_SELECT, normalizeProfileProFields } from '@/lib/subscription';
import type { Profile } from '@/types';

function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const da = phoneDigitsOnly(normalizePhone(a));
  const db = phoneDigitsOnly(normalizePhone(b));
  return da.length > 0 && da === db;
}

/** Find profile by phone — resolves to the user's UUID row in `profiles`. */
export async function findProfileByPhone(phone: string): Promise<Profile | null> {
  const normalized = normalizePhone(phone);
  const digits = phoneDigitsOnly(normalized);

  if (!digits) return null;
  if (IS_MOCK_MODE || !supabase) return null;

  const attempts = [normalized, `+${digits}`, digits];
  for (const candidate of attempts) {
    const { data, error } = await supabase
      .from('profiles')
      .select(PROFILE_SELECT)
      .eq('phone', candidate)
      .maybeSingle();
    if (!error && data) {
      return normalizeProfileProFields(data as Profile);
    }
  }

  const { data: rows, error: listErr } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .not('phone', 'is', null);

  if (listErr) {
    console.warn('[Актобе Жұмыс] Profile phone lookup failed:', listErr.message);
    return null;
  }

  const match = (rows ?? []).find((row) => phonesMatch((row as Profile).phone, normalized));
  return match ? normalizeProfileProFields(match as Profile) : null;
}

export function findProfileByPhoneInList(phone: string, profiles: Profile[]): Profile | null {
  const normalized = normalizePhone(phone);
  return profiles.find((p) => phonesMatch(p.phone, normalized)) ?? null;
}

/** Parse synthetic auth email back to normalized phone, if possible. */
export function phoneFromAuthEmail(email: string): string | null {
  const trimmed = email.trim().toLowerCase();
  const userMatch = trimmed.match(/^user_(\d+)@example\.com$/);
  if (userMatch) {
    const digits = userMatch[1];
    return normalizePhone(digits.length === 11 ? `+${digits}` : digits);
  }
  const legacyMatch = trimmed.match(/^(\d+)@phone\.aktobe-zhumys\.kz$/);
  if (legacyMatch) {
    return normalizePhone(legacyMatch[1]);
  }
  return null;
}

function findProfileByAuthEmailInList(email: string, profiles: Profile[]): Profile | null {
  const fromEmail = phoneFromAuthEmail(email);
  if (fromEmail) return findProfileByPhoneInList(fromEmail, profiles);

  const normalizedEmail = email.trim().toLowerCase();
  for (const profile of profiles) {
    if (!profile.phone) continue;
    const primary = phoneToAuthEmail(profile.phone).toLowerCase();
    const legacy = phoneToAuthEmailLegacy(profile.phone).toLowerCase();
    if (primary === normalizedEmail || legacy === normalizedEmail) return profile;
  }
  return null;
}

/** Find profile by phone number or Supabase auth email (user_XXX@example.com). */
export async function findProfileByIdentifier(identifier: string): Promise<Profile | null> {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    const phone = phoneFromAuthEmail(trimmed);
    if (phone) return findProfileByPhone(phone);
    return null;
  }

  return findProfileByPhone(trimmed);
}

export function findProfileByIdentifierInList(identifier: string, profiles: Profile[]): Profile | null {
  const trimmed = identifier.trim();
  if (!trimmed) return null;

  if (trimmed.includes('@')) {
    return findProfileByAuthEmailInList(trimmed, profiles);
  }

  return findProfileByPhoneInList(trimmed, profiles);
}
