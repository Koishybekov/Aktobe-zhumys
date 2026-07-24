import { create } from 'zustand';
import type { Profile, ProfileSetupInput, UserRole } from '@/types';
import type { Session } from '@supabase/supabase-js';
import { supabase, IS_MOCK_MODE } from '@/lib/supabase';
import { DEFAULT_CITY } from '@/lib/constants';
import { tStatic } from '@/lib/i18n/useTranslation';
import { useLocaleStore } from '@/store/useLocaleStore';
import {
  normalizePhone,
  isValidKzPhone,
  phoneToAuthEmail,
  phoneToAuthEmailLegacy,
  isValidPassword,
} from '@/lib/authPhone';
import { hashPassword } from '@/lib/phoneAuth';
import {
  savePhoneSession,
  loadPhoneSession,
  clearPhoneSession,
  clearAllPhoneSessions,
} from '@/lib/phoneSessionStorage';
import { subscriptionExpiresAt } from '@/lib/subscription';
import {
  loadAuthSession,
  saveAuthSession,
  clearAuthSession,
  updateSessionProfile,
  isValidAuthSession,
  authStateFromSession,
  setOnboardingCompletedLocal,
  isOnboardingCompletedLocal,
} from '@/lib/authStorage';
import {
  registerMockUser,
  verifyMockLogin,
  updateMockUserProfile,
} from '@/lib/mockAuth';
import { useAppStore } from '@/store/useAppStore';

interface AuthState {
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  pendingPhone: string;
  selectedRole: UserRole;
  offerAcceptedAt: string | null;
  profile: Profile | null;
  isSubmitting: boolean;
  isHydrating: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  initAuthListener: () => () => void;
  register: (phone: string, password: string, confirmPassword: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  completeProfileSetup: (input: ProfileSetupInput) => Promise<boolean>;
  subscribeToPro: () => Promise<void>;
  logout: () => Promise<void>;
  getUserId: () => string;
}

function locale() {
  return useLocaleStore.getState().locale;
}

function applyAuthState(
  profile: Profile,
  phone: string,
  offerAcceptedAt: string | null = profile.offer_accepted_at ?? null
) {
  const onboardingCompleted = !!profile.onboarding_completed || isOnboardingCompletedLocal();
  const profileWithOnboarding = { ...profile, onboarding_completed: onboardingCompleted };

  if (onboardingCompleted) {
    setOnboardingCompletedLocal(true);
  }

  saveAuthSession({
    userId: profile.id,
    phone,
    role: profile.role,
    isAuthenticated: true,
    offerAcceptedAt,
    onboardingCompleted,
    profile: profileWithOnboarding,
  });

  return {
    isAuthenticated: true,
    onboardingCompleted,
    pendingPhone: phone,
    selectedRole: profile.role,
    offerAcceptedAt,
    profile: profileWithOnboarding,
    error: null,
  };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', userId).maybeSingle();
  if (error) {
    console.warn('[Актобе Жұмыс] Profile fetch failed:', error.message);
    return null;
  }
  return data as Profile | null;
}

async function signInWithPhoneCredentials(normalized: string, password: string) {
  if (!supabase) throw new Error('Supabase not configured');

  const primaryEmail = phoneToAuthEmail(normalized);
  const primary = await supabase.auth.signInWithPassword({ email: primaryEmail, password });
  if (!primary.error) return primary;

  const legacyEmail = phoneToAuthEmailLegacy(normalized);
  if (legacyEmail !== primaryEmail) {
    const legacy = await supabase.auth.signInWithPassword({ email: legacyEmail, password });
    if (!legacy.error) return legacy;
  }

  return primary;
}

/** Register via anonymous Supabase session — no email / SMTP / rate limits. */
async function registerWithPhoneProfile(normalized: string, password: string): Promise<Session> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: exists, error: existsErr } = await supabase.rpc('phone_exists', {
    p_phone: normalized,
  });
  if (existsErr) throw existsErr;
  if (exists) throw new Error('USER_EXISTS');

  await supabase.auth.signOut();

  const { data: anonData, error: anonErr } = await supabase.auth.signInAnonymously();
  if (anonErr) throw anonErr;
  if (!anonData.session) throw new Error('Anonymous session failed');

  const session = anonData.session;
  const passwordHash = await hashPassword(password);

  const { error: profileErr } = await supabase.from('profiles').upsert(
    {
      id: session.user.id,
      phone: normalized,
      password_hash: passwordHash,
      full_name: '',
      role: 'both',
      city: DEFAULT_CITY,
      onboarding_completed: false,
    },
    { onConflict: 'id' }
  );
  if (profileErr) throw profileErr;

  savePhoneSession(normalized, session);
  return session;
}

/** Login with phone + password hash in profiles; restores saved Supabase session. */
async function loginWithPhoneProfile(normalized: string, password: string): Promise<Session | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const passwordHash = await hashPassword(password);
  const { data: userId, error: verifyErr } = await supabase.rpc('verify_phone_password', {
    p_phone: normalized,
    p_password_hash: passwordHash,
  });
  if (verifyErr) throw verifyErr;

  if (userId) {
    const stored = loadPhoneSession(normalized);
    if (stored && stored.userId === userId) {
      const { data, error } = await supabase.auth.setSession({
        access_token: stored.access_token,
        refresh_token: stored.refresh_token,
      });
      if (!error && data.session?.user.id === userId) {
        savePhoneSession(normalized, data.session!);
        return data.session;
      }
    }
  }

  // Legacy accounts created via email signUp (no email sent on sign-in)
  const legacy = await signInWithPhoneCredentials(normalized, password);
  if (legacy.error || !legacy.data.session) return null;

  savePhoneSession(normalized, legacy.data.session);

  if (userId && legacy.data.session.user.id === userId) {
    return legacy.data.session;
  }

  // Migrate legacy session: store password hash for phone auth next time
  if (legacy.data.session.user.id) {
    await supabase.from('profiles').upsert(
      {
        id: legacy.data.session.user.id,
        phone: normalized,
        password_hash: passwordHash,
      },
      { onConflict: 'id' }
    );
  }

  return legacy.data.session;
}

async function syncFromSupabaseSession(session: Session): Promise<Partial<AuthState>> {
  const phone =
    (session.user.user_metadata?.phone as string | undefined) ??
    session.user.phone ??
    '';

  let profile = await fetchProfile(session.user.id);

  if (!profile) {
    profile = {
      id: session.user.id,
      phone: normalizePhone(phone),
      full_name: (session.user.user_metadata?.full_name as string) ?? '',
      avatar_url: null,
      role: ((session.user.user_metadata?.role as UserRole) ?? 'both') as UserRole,
      rating: 0,
      city: DEFAULT_CITY,
      district: '',
      skills: [],
      offer_accepted_at: null,
      onboarding_completed: false,
    };
  }

  if (isOnboardingCompletedLocal()) {
    profile = { ...profile, onboarding_completed: true };
  }

  const resolvedPhone = profile.phone || normalizePhone(phone);
  if (resolvedPhone) {
    savePhoneSession(resolvedPhone, session);
  }

  return applyAuthState(profile, resolvedPhone);
}

async function tryRestoreSupabaseSession(phone: string, userId: string): Promise<Session | null> {
  if (!supabase) return null;

  const stored = loadPhoneSession(phone);
  if (!stored || stored.userId !== userId) return null;

  const { data, error } = await supabase.auth.setSession({
    access_token: stored.access_token,
    refresh_token: stored.refresh_token,
  });

  if (error || !data.session) {
    console.warn('[Актобе Жұмыс] Could not restore Supabase session from localStorage:', error?.message);
    return null;
  }

  savePhoneSession(phone, data.session);
  return data.session;
}

function finalizeOnboardingLocally(
  set: (partial: Partial<AuthState>) => void,
  completedProfile: Profile,
  phone: string,
  offerAcceptedAt: string | null
) {
  const profile = { ...completedProfile, onboarding_completed: true };
  setOnboardingCompletedLocal(true);
  const next = applyAuthState(profile, phone, offerAcceptedAt);
  set({ ...next, isSubmitting: false, error: null });
  useAppStore.getState().syncUserFromAuth();
}

function applyStoredAuthToApp(stored: ReturnType<typeof loadAuthSession>): void {
  if (!isValidAuthSession(stored)) return;
  useAppStore.getState().syncUserFromAuth();
}

export const useAuthStore = create<AuthState>((set, get) => ({
  isAuthenticated: false,
  onboardingCompleted: false,
  pendingPhone: '',
  selectedRole: 'both',
  offerAcceptedAt: null,
  profile: null,
  isSubmitting: false,
  isHydrating: true,
  error: null,

  hydrate: async () => {
    set({ isHydrating: true, error: null });

    const stored = loadAuthSession();

    try {
      // 1) Restore from localStorage first (survives F5 / refresh)
      if (isValidAuthSession(stored)) {
        if (IS_MOCK_MODE || !supabase) {
          set({ ...authStateFromSession(stored), isHydrating: false });
          applyStoredAuthToApp(stored);
          return;
        }

        const { data: { session: liveSession } } = await supabase.auth.getSession();

        if (liveSession?.user?.id === stored.userId) {
          const next = await syncFromSupabaseSession(liveSession);
          set({ ...next, isHydrating: false });
          applyStoredAuthToApp(stored);
          return;
        }

        const restored = await tryRestoreSupabaseSession(stored.phone, stored.userId);
        if (restored) {
          const next = await syncFromSupabaseSession(restored);
          set({ ...next, isHydrating: false });
          applyStoredAuthToApp(stored);
          return;
        }

        // Supabase tokens expired — keep local session so user stays in the app
        console.warn('[Актобе Жұмыс] Using persisted local auth (Supabase session unavailable)');
        set({ ...authStateFromSession(stored), isHydrating: false });
        applyStoredAuthToApp(stored);
        return;
      }

      // 2) No localStorage session — try live Supabase session only
      if (IS_MOCK_MODE || !supabase) {
        set({ isHydrating: false });
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        const next = await syncFromSupabaseSession(session);
        set({ ...next, isHydrating: false });
        applyStoredAuthToApp(loadAuthSession());
        return;
      }

      clearAuthSession();
      set({
        isAuthenticated: false,
        onboardingCompleted: false,
        profile: null,
        isHydrating: false,
      });
    } catch (err) {
      console.warn('[Актобе Жұмыс] Auth hydrate failed:', err);
      if (isValidAuthSession(stored)) {
        set({ ...authStateFromSession(stored), isHydrating: false });
        applyStoredAuthToApp(stored);
      } else {
        set({ isHydrating: false });
      }
    }
  },

  initAuthListener: () => {
    if (IS_MOCK_MODE || !supabase) return () => {};

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
        if (get().isHydrating) return;
        const persisted = loadAuthSession();
        if (isValidAuthSession(persisted)) return;

        clearAuthSession();
        set({
          isAuthenticated: false,
          onboardingCompleted: false,
          profile: null,
          pendingPhone: '',
          error: null,
        });
        return;
      }

      if (session?.user && (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION')) {
        const next = await syncFromSupabaseSession(session);
        set(next);
        applyStoredAuthToApp(loadAuthSession());
      }
    });

    return () => subscription.unsubscribe();
  },

  register: async (phone, password, confirmPassword) => {
    const loc = locale();
    const normalized = normalizePhone(phone);

    if (!isValidKzPhone(normalized)) {
      set({ error: tStatic('errPhone', loc) });
      return;
    }
    if (!isValidPassword(password)) {
      set({ error: tStatic('errPassword', loc) });
      return;
    }
    if (password !== confirmPassword) {
      set({ error: tStatic('errPasswordMatch', loc) });
      return;
    }

    set({ isSubmitting: true, error: null });

    try {
      if (IS_MOCK_MODE || !supabase) {
        try {
          const record = registerMockUser(normalized, password);
          const next = applyAuthState(record.profile, normalized);
          set({ ...next, isSubmitting: false });
        } catch {
          set({ error: tStatic('errUserExists', loc), isSubmitting: false });
        }
        return;
      }

      const session = await registerWithPhoneProfile(normalized, password);
      const next = await syncFromSupabaseSession(session);
      set({ ...next, isSubmitting: false });
    } catch (err) {
      if (err instanceof Error && err.message === 'USER_EXISTS') {
        set({ error: tStatic('errUserExists', loc), isSubmitting: false });
        return;
      }
      const message = err instanceof Error ? err.message : tStatic('error', loc);
      set({ error: message, isSubmitting: false });
    }
  },

  login: async (phone, password) => {
    const loc = locale();
    const normalized = normalizePhone(phone);

    if (!isValidKzPhone(normalized)) {
      set({ error: tStatic('errPhone', loc) });
      return;
    }
    if (!password) {
      set({ error: tStatic('errPasswordRequired', loc) });
      return;
    }

    set({ isSubmitting: true, error: null });

    try {
      if (IS_MOCK_MODE || !supabase) {
        const record = verifyMockLogin(normalized, password);
        if (!record) {
          set({ error: tStatic('errInvalidCredentials', loc), isSubmitting: false });
          return;
        }
        const next = applyAuthState(record.profile, normalized, record.profile.offer_accepted_at ?? null);
        set({ ...next, isSubmitting: false });
        return;
      }

      const session = await loginWithPhoneProfile(normalized, password);
      if (!session) {
        set({ error: tStatic('errInvalidCredentials', loc), isSubmitting: false });
        return;
      }

      const next = await syncFromSupabaseSession(session);
      set({ ...next, isSubmitting: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : tStatic('error', loc);
      set({ error: message, isSubmitting: false });
    }
  },

  completeProfileSetup: async (input) => {
    const { profile, pendingPhone, selectedRole, offerAcceptedAt } = get();
    const stored = loadAuthSession();
    const userId = profile?.id ?? stored?.userId;
    const phone = profile?.phone ?? pendingPhone ?? stored?.phone ?? '';

    set({ isSubmitting: true, error: null });

    const baseProfile: Profile = profile ?? {
      id: userId || phone.replace(/\D/g, '') || 'local-user',
      phone,
      full_name: '',
      avatar_url: null,
      role: selectedRole,
      rating: 5.0,
      city: DEFAULT_CITY,
      district: '',
      skills: [],
      offer_accepted_at: offerAcceptedAt,
      onboarding_completed: false,
    };

    const completedProfile: Profile = {
      ...baseProfile,
      full_name: input.full_name.trim() || baseProfile.full_name,
      avatar_url: input.avatar_url ?? baseProfile.avatar_url,
      city: input.city || DEFAULT_CITY,
      district: input.district || baseProfile.district || '',
      skills: input.skills,
      role: selectedRole,
      offer_accepted_at: offerAcceptedAt,
      onboarding_completed: true,
      rating: baseProfile.rating || 5.0,
    };

    try {
      if (!IS_MOCK_MODE && supabase && userId) {
        const { error } = await supabase.from('profiles').upsert(
          {
            id: userId,
            phone: phone || null,
            full_name: completedProfile.full_name,
            avatar_url: completedProfile.avatar_url,
            city: completedProfile.city,
            district: completedProfile.district,
            skills: completedProfile.skills,
            role: selectedRole,
            offer_accepted_at: offerAcceptedAt,
            onboarding_completed: true,
          },
          { onConflict: 'id' }
        );

        if (error) {
          console.error('Profile update error:', error);
        }
      } else {
        updateMockUserProfile(userId, completedProfile);
      }
    } catch (err) {
      console.error('Profile update error:', err);
    }

    finalizeOnboardingLocally(set, completedProfile, phone, offerAcceptedAt);
    return true;
  },

  subscribeToPro: async () => {
    const { profile } = get();
    if (!profile || profile.is_pro) return;

    set({ isSubmitting: true, error: null });

    const proProfile: Profile = {
      ...profile,
      is_subscribed: true,
      subscribed_until: subscriptionExpiresAt(),
      is_pro: true,
      pro_since: new Date().toISOString(),
    };

    if (!IS_MOCK_MODE && supabase) {
      await supabase.from('profiles').update({
        is_subscribed: true,
        subscribed_until: proProfile.subscribed_until,
        is_pro: true,
        pro_since: proProfile.pro_since,
      }).eq('id', profile.id);
    }

    const session = loadAuthSession();
    if (session) {
      saveAuthSession(updateSessionProfile(session, proProfile));
    }

    set({ profile: proProfile, isSubmitting: false });
  },

  logout: async () => {
    const phone = get().profile?.phone ?? get().pendingPhone;
    if (phone) clearPhoneSession(phone);
    clearAllPhoneSessions();
    clearAuthSession();
    useAppStore.getState().resetSession();

    if (!IS_MOCK_MODE && supabase) {
      await supabase.auth.signOut();
    }

    set({
      isAuthenticated: false,
      onboardingCompleted: false,
      pendingPhone: '',
      selectedRole: 'both',
      offerAcceptedAt: null,
      profile: null,
      error: null,
    });
  },

  getUserId: () => get().profile?.id ?? loadAuthSession()?.userId ?? '',
}));

export function getActiveUserId(): string {
  return useAuthStore.getState().getUserId() || loadAuthSession()?.userId || '';
}
