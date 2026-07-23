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
  isValidPassword,
} from '@/lib/authPhone';
import { subscriptionExpiresAt } from '@/lib/subscription';
import {
  loadAuthSession,
  saveAuthSession,
  clearAuthSession,
  updateSessionProfile,
} from '@/lib/authStorage';
import {
  registerMockUser,
  verifyMockLogin,
  updateMockUserProfile,
} from '@/lib/mockAuth';

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
  completeProfileSetup: (input: ProfileSetupInput) => Promise<void>;
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
  const onboardingCompleted = !!profile.onboarding_completed;
  saveAuthSession({
    userId: profile.id,
    phone,
    role: profile.role,
    isAuthenticated: true,
    offerAcceptedAt,
    onboardingCompleted,
    profile,
  });

  return {
    isAuthenticated: true,
    onboardingCompleted,
    pendingPhone: phone,
    selectedRole: profile.role,
    offerAcceptedAt,
    profile,
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

  return applyAuthState(profile, profile.phone || normalizePhone(phone));
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

    try {
      if (IS_MOCK_MODE || !supabase) {
        const session = loadAuthSession();
        if (session?.isAuthenticated && session.profile) {
          set({
            isAuthenticated: true,
            onboardingCompleted: session.onboardingCompleted,
            pendingPhone: session.phone,
            selectedRole: session.role,
            offerAcceptedAt: session.offerAcceptedAt,
            profile: session.profile,
            isHydrating: false,
          });
          return;
        }
        set({ isHydrating: false });
        return;
      }

      const { data: { session }, error } = await supabase.auth.getSession();
      if (error) throw error;

      if (session?.user) {
        const next = await syncFromSupabaseSession(session);
        set({ ...next, isHydrating: false });
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
      const session = loadAuthSession();
      if (session?.isAuthenticated && session.profile) {
        set({
          isAuthenticated: true,
          onboardingCompleted: session.onboardingCompleted,
          pendingPhone: session.phone,
          selectedRole: session.role,
          offerAcceptedAt: session.offerAcceptedAt,
          profile: session.profile,
          isHydrating: false,
        });
      } else {
        set({ isHydrating: false });
      }
    }
  },

  initAuthListener: () => {
    if (IS_MOCK_MODE || !supabase) return () => {};

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_OUT') {
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

      const email = phoneToAuthEmail(normalized);
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            phone: normalized,
            full_name: '',
            role: 'both',
            city: DEFAULT_CITY,
          },
        },
      });

      if (error) {
        if (error.message.toLowerCase().includes('already')) {
          set({ error: tStatic('errUserExists', loc), isSubmitting: false });
          return;
        }
        throw error;
      }

      if (!data.session && data.user) {
        const signIn = await supabase.auth.signInWithPassword({ email, password });
        if (signIn.error) throw signIn.error;
        if (signIn.data.session) {
          const next = await syncFromSupabaseSession(signIn.data.session);
          set({ ...next, isSubmitting: false });
          return;
        }
      }

      if (data.session) {
        await new Promise((r) => setTimeout(r, 400));
        const next = await syncFromSupabaseSession(data.session);
        set({ ...next, isSubmitting: false });
        return;
      }

      set({ error: tStatic('errRegister', loc), isSubmitting: false });
    } catch (err) {
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

      const email = phoneToAuthEmail(normalized);
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        set({ error: tStatic('errInvalidCredentials', loc), isSubmitting: false });
        return;
      }

      if (data.session) {
        const next = await syncFromSupabaseSession(data.session);
        set({ ...next, isSubmitting: false });
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : tStatic('error', loc);
      set({ error: message, isSubmitting: false });
    }
  },

  completeProfileSetup: async (input) => {
    const { profile, pendingPhone, selectedRole, offerAcceptedAt } = get();
    const loc = locale();
    if (!profile) return;

    if ((selectedRole === 'worker' || selectedRole === 'both') && input.skills.length === 0) {
      set({ error: tStatic('errSkills', loc) });
      return;
    }
    if (!input.district || input.district === 'all') {
      set({ error: tStatic('errDistrict', loc) });
      return;
    }

    set({ isSubmitting: true, error: null });

    const completedProfile: Profile = {
      ...profile,
      full_name: input.full_name.trim() || profile.full_name,
      avatar_url: input.avatar_url ?? profile.avatar_url,
      city: input.city || DEFAULT_CITY,
      district: input.district,
      skills: input.skills,
      role: selectedRole,
      offer_accepted_at: offerAcceptedAt,
      onboarding_completed: true,
      rating: profile.rating || 5.0,
    };

    try {
      if (!IS_MOCK_MODE && supabase) {
        const { error } = await supabase.from('profiles').update({
          full_name: completedProfile.full_name,
          avatar_url: completedProfile.avatar_url,
          city: completedProfile.city,
          district: completedProfile.district,
          skills: completedProfile.skills,
          role: selectedRole,
          offer_accepted_at: offerAcceptedAt,
          onboarding_completed: true,
        }).eq('id', profile.id);

        if (error) throw error;
      } else {
        updateMockUserProfile(profile.id, completedProfile);
      }

      const next = applyAuthState(completedProfile, pendingPhone || profile.phone, offerAcceptedAt);
      set({ ...next, isSubmitting: false });
    } catch (err) {
      console.warn('[Актобе Жұмыс] Profile setup sync failed.', err);
      const next = applyAuthState(completedProfile, pendingPhone || profile.phone, offerAcceptedAt);
      set({ ...next, isSubmitting: false });
    }
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
    if (!IS_MOCK_MODE && supabase) {
      await supabase.auth.signOut();
    }
    clearAuthSession();
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
  return useAuthStore.getState().getUserId() || loadAuthSession()?.userId || 'user-001';
}
