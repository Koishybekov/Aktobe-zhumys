import type { AuthSession, Profile, UserRole } from '@/types';
import { DEFAULT_CITY } from '@/lib/constants';

const AUTH_KEY = 'easyjob_auth_session';

export function loadAuthSession(): AuthSession | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function saveAuthSession(session: AuthSession): void {
  localStorage.setItem(AUTH_KEY, JSON.stringify(session));
}

export function clearAuthSession(): void {
  localStorage.removeItem(AUTH_KEY);
}

export function createEmptyProfile(userId: string, phone: string, role: UserRole): Profile {
  return {
    id: userId,
    phone,
    full_name: '',
    avatar_url: null,
    role,
    rating: 0,
    city: DEFAULT_CITY,
    district: '',
    skills: [],
    offer_accepted_at: null,
    onboarding_completed: false,
  };
}

export function updateSessionProfile(session: AuthSession, profile: Profile): AuthSession {
  return {
    ...session,
    profile,
    onboardingCompleted: profile.onboarding_completed ?? false,
  };
}
