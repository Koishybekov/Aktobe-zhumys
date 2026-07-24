import type { AuthSession, Profile, UserRole } from '@/types';
import { DEFAULT_CITY } from '@/lib/constants';

const AUTH_KEY = 'easyjob_auth_session';
export const ONBOARDING_COMPLETED_KEY = 'onboarding_completed';

export function isOnboardingCompletedLocal(): boolean {
  return localStorage.getItem(ONBOARDING_COMPLETED_KEY) === 'true';
}

export function setOnboardingCompletedLocal(completed: boolean): void {
  if (completed) {
    localStorage.setItem(ONBOARDING_COMPLETED_KEY, 'true');
  } else {
    localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
  }
}

export function clearOnboardingCompletedLocal(): void {
  localStorage.removeItem(ONBOARDING_COMPLETED_KEY);
}

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
  clearOnboardingCompletedLocal();
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

export function isValidAuthSession(session: AuthSession | null): session is AuthSession {
  return Boolean(
    session?.isAuthenticated &&
      session.userId &&
      session.phone &&
      session.profile?.id
  );
}

export function authStateFromSession(session: AuthSession) {
  const onboardingCompleted =
    session.onboardingCompleted ||
    isOnboardingCompletedLocal() ||
    !!session.profile?.onboarding_completed;

  const profile = session.profile
    ? { ...session.profile, onboarding_completed: onboardingCompleted }
    : session.profile;

  return {
    isAuthenticated: true as const,
    onboardingCompleted,
    pendingPhone: session.phone,
    selectedRole: session.role,
    offerAcceptedAt: session.offerAcceptedAt,
    profile,
    error: null as string | null,
  };
}

export function updateSessionProfile(session: AuthSession, profile: Profile): AuthSession {
  return {
    ...session,
    profile,
    onboardingCompleted: profile.onboarding_completed ?? false,
  };
}
