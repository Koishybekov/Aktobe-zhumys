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
import { buildSubscriptionActivation, hasActivePro, computeIsPro, PROFILE_SELECT, normalizeProfileProFields } from '@/lib/subscription';
import {
  loadAuthSession,
  saveAuthSession,
  clearAuthSession,
  updateSessionProfile,
  isValidAuthSession,
  authStateFromSession,
  setOnboardingCompletedLocal,
  isOnboardingCompletedLocal,
  forceCompleteOnboardingRedirect,
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
  isPro: boolean;
  isSubmitting: boolean;
  isHydrating: boolean;
  error: string | null;

  hydrate: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  initAuthListener: () => () => void;
  register: (phone: string, password: string, confirmPassword: string, fullName: string) => Promise<void>;
  login: (phone: string, password: string) => Promise<void>;
  completeProfileSetup: (input: ProfileSetupInput) => Promise<boolean>;
  subscribeToPro: () => Promise<void>;
  logout: () => Promise<void>;
  getUserId: () => string;
}

function locale() {
  return useLocaleStore.getState().locale;
}

function sessionStateWithPro(stored: NonNullable<ReturnType<typeof loadAuthSession>>) {
  const state = authStateFromSession(stored);
  return { ...state, isPro: computeIsPro(state.profile) };
}

function applyAuthState(
  profile: Profile,
  phone: string,
  offerAcceptedAt: string | null = profile.offer_accepted_at ?? null
) {
  const onboardingCompleted = !!profile.onboarding_completed || isOnboardingCompletedLocal();
  const profileWithOnboarding = normalizeProfileProFields({
    ...profile,
    onboarding_completed: onboardingCompleted,
  });

  if (onboardingCompleted) {
    setOnboardingCompletedLocal(true);
  }

  saveAuthSession({
    userId: profileWithOnboarding.id,
    phone,
    role: profileWithOnboarding.role,
    isAuthenticated: true,
    offerAcceptedAt,
    onboardingCompleted,
    profile: profileWithOnboarding,
  });

  return {
    isAuthenticated: true,
    onboardingCompleted,
    pendingPhone: phone,
    selectedRole: profileWithOnboarding.role,
    offerAcceptedAt,
    profile: profileWithOnboarding,
    isPro: computeIsPro(profileWithOnboarding),
    error: null,
  };
}

async function fetchProfile(userId: string): Promise<Profile | null> {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select(PROFILE_SELECT)
    .eq('id', userId)
    .maybeSingle();
  if (error) {
    console.warn('[Актобе Жұмыс] Profile fetch failed:', error.message);
    return null;
  }
  return data ? normalizeProfileProFields(data as Profile) : null;
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

/** Register with Supabase Auth (phone → synthetic email + password). */
async function registerWithPhoneProfile(
  normalized: string,
  password: string,
  fullName: string
): Promise<Session> {
  if (!supabase) throw new Error('Supabase not configured');

  const { data: exists, error: existsErr } = await supabase.rpc('phone_exists', {
    p_phone: normalized,
  });
  if (existsErr) throw existsErr;
  if (exists) throw new Error('USER_EXISTS');

  const email = phoneToAuthEmail(normalized);

  const { data: signUpData, error: signUpErr } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        phone: normalized,
        full_name: fullName.trim(),
        role: 'both',
        city: DEFAULT_CITY,
      },
    },
  });

  if (signUpErr) {
    const msg = signUpErr.message.toLowerCase();
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      throw new Error('USER_EXISTS');
    }
    throw signUpErr;
  }

  let session = signUpData.session;

  if (!session) {
    const { data: signInData, error: signInErr } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    if (signInErr || !signInData.session) {
      throw signInErr ?? new Error('Registration succeeded but session unavailable');
    }
    session = signInData.session;
  }

  const userId = session.user.id;
  const passwordHash = await hashPassword(password);

  const { error: profileErr } = await supabase.from('profiles').upsert(
    {
      id: userId,
      phone: normalized,
      password_hash: passwordHash,
      full_name: fullName.trim(),
      role: 'both',
      city: DEFAULT_CITY,
      onboarding_completed: false,
    },
    { onConflict: 'id' }
  );
  if (profileErr) {
    console.error('Profile link error after signUp:', profileErr);
  }

  savePhoneSession(normalized, session);
  return session;
}

/** Ensure profiles row exists and matches auth.users id. */
async function linkProfileToAuthUser(
  userId: string,
  phone: string,
  fullName?: string
): Promise<void> {
  if (!supabase) return;

  const existing = await fetchProfile(userId);
  const { error } = await supabase.from('profiles').upsert(
    {
      id: userId,
      phone: phone || existing?.phone || '',
      full_name: fullName?.trim() || existing?.full_name || '',
      role: existing?.role ?? 'both',
      city: existing?.city ?? DEFAULT_CITY,
      onboarding_completed: existing?.onboarding_completed ?? false,
    },
    { onConflict: 'id' }
  );
  if (error) {
    console.warn('[Актобе Жұмыс] Profile link failed:', error.message);
  }
}

/** Login with phone + password via Supabase Auth email credentials. */
async function loginWithPhoneProfile(normalized: string, password: string): Promise<Session | null> {
  if (!supabase) throw new Error('Supabase not configured');

  const stored = loadPhoneSession(normalized);
  if (stored) {
    const { data, error } = await supabase.auth.setSession({
      access_token: stored.access_token,
      refresh_token: stored.refresh_token,
    });
    if (!error && data.session) {
      savePhoneSession(normalized, data.session);
      await linkProfileToAuthUser(
        data.session.user.id,
        normalized,
        data.session.user.user_metadata?.full_name as string | undefined
      );
      return data.session;
    }
  }

  const authResult = await signInWithPhoneCredentials(normalized, password);
  if (authResult.error || !authResult.data.session) return null;

  const session = authResult.data.session;
  savePhoneSession(normalized, session);

  await linkProfileToAuthUser(
    session.user.id,
    normalized,
    session.user.user_metadata?.full_name as string | undefined
  );

  const passwordHash = await hashPassword(password);
  await supabase.from('profiles').upsert(
    {
      id: session.user.id,
      phone: normalized,
      password_hash: passwordHash,
    },
    { onConflict: 'id' }
  );

  return session;
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

/** Best-effort Supabase save — schema gaps must never block onboarding. */
async function saveProfileSetupToSupabase(
  userId: string,
  phone: string,
  completedProfile: Profile,
  selectedRole: UserRole
): Promise<void> {
  if (IS_MOCK_MODE || !supabase || !userId) return;

  try {
    // Minimal payload: omit optional columns that may be missing in older schemas
    // (e.g. offer_accepted_at, avatar_url, skills, onboarding_completed).
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        phone: phone || null,
        full_name: completedProfile.full_name,
        city: completedProfile.city,
        district: completedProfile.district,
        role: selectedRole,
      },
      { onConflict: 'id' }
    );

    if (error) {
      console.error('Profile update error:', error);
    }
  } catch (err) {
    console.error('Profile update error:', err);
  }
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
  isPro: false,
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
          set({ ...sessionStateWithPro(stored), isHydrating: false });
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
        set({ ...sessionStateWithPro(stored), isHydrating: false });
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
        set({ ...sessionStateWithPro(stored), isHydrating: false });
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

  refreshProfile: async () => {
    const uid = get().profile?.id ?? loadAuthSession()?.userId;
    if (!uid) return;

    if (IS_MOCK_MODE || !supabase) {
      const current = get().profile;
      if (current) {
        const normalized = normalizeProfileProFields(current);
        set({ profile: normalized, isPro: computeIsPro(normalized) });
        useAppStore.getState().syncUserFromAuth();
      }
      return;
    }

    const fresh = await fetchProfile(uid);
    if (!fresh) return;

    const phone = fresh.phone ?? get().pendingPhone ?? loadAuthSession()?.phone ?? '';
    const patch = applyAuthState(fresh, phone, fresh.offer_accepted_at ?? get().offerAcceptedAt);
    set(patch);
    useAppStore.getState().syncUserFromAuth();
  },

  register: async (phone, password, confirmPassword, fullName) => {
    const loc = locale();
    const normalized = normalizePhone(phone);
    const name = fullName.trim();

    if (!isValidKzPhone(normalized)) {
      set({ error: tStatic('errPhone', loc) });
      return;
    }
    if (!name || name.length < 2) {
      set({ error: tStatic('errFullName', loc) });
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
          const record = registerMockUser(normalized, password, name);
          const next = applyAuthState(record.profile, normalized);
          set({ ...next, isSubmitting: false });
          await get().refreshProfile();
        } catch {
          set({ error: tStatic('errUserExists', loc), isSubmitting: false });
        }
        return;
      }

      const session = await registerWithPhoneProfile(normalized, password, name);
      const next = await syncFromSupabaseSession(session);
      set({ ...next, isSubmitting: false });
      await get().refreshProfile();
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
        await get().refreshProfile();
        return;
      }

      const session = await loginWithPhoneProfile(normalized, password);
      if (!session) {
        set({ error: tStatic('errInvalidCredentials', loc), isSubmitting: false });
        return;
      }

      const next = await syncFromSupabaseSession(session);
      set({ ...next, isSubmitting: false });
      await get().refreshProfile();
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
      if (IS_MOCK_MODE || !supabase) {
        if (userId) updateMockUserProfile(userId, completedProfile);
      } else if (userId) {
        await saveProfileSetupToSupabase(userId, phone, completedProfile, selectedRole);
      }
    } catch (err) {
      console.error('Profile update error:', err);
    }

    finalizeOnboardingLocally(set, completedProfile, phone, offerAcceptedAt);
    forceCompleteOnboardingRedirect();
    return true;
  },

  subscribeToPro: async () => {
    const { profile } = get();
    if (!profile || hasActivePro(profile)) return;

    set({ isSubmitting: true, error: null });

    const activation = buildSubscriptionActivation(profile);
    const proProfile: Profile = { ...profile, ...activation };

    if (!IS_MOCK_MODE && supabase) {
      await supabase.from('profiles').update(activation).eq('id', profile.id);
    }

    const session = loadAuthSession();
    if (session) {
      saveAuthSession(updateSessionProfile(session, proProfile));
    }

    set({ profile: proProfile, isSubmitting: false });
    useAppStore.getState().syncUserFromAuth();
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
      isPro: false,
      error: null,
    });
  },

  getUserId: () => get().profile?.id ?? loadAuthSession()?.userId ?? '',
}));

export function getActiveUserId(): string {
  return useAuthStore.getState().getUserId() || loadAuthSession()?.userId || '';
}
