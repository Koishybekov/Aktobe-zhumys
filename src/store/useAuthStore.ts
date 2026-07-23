import { create } from 'zustand';
import type { AuthStep, Profile, ProfileSetupInput, UserRole } from '@/types';
import { supabase, IS_MOCK_MODE } from '@/lib/supabase';
import { DEFAULT_CITY } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import { tStatic } from '@/lib/i18n/useTranslation';
import { useLocaleStore } from '@/store/useLocaleStore';
import {
  loadAuthSession,
  saveAuthSession,
  clearAuthSession,
  createEmptyProfile,
} from '@/lib/authStorage';

interface AuthState {
  authStep: AuthStep;
  isAuthenticated: boolean;
  onboardingCompleted: boolean;
  pendingPhone: string;
  draftFullName: string;
  draftAvatar: string | null;
  selectedRole: UserRole;
  offerAccepted: boolean;
  offerAcceptedAt: string | null;
  profile: Profile | null;
  isSubmitting: boolean;
  error: string | null;

  hydrate: () => void;
  setAuthStep: (step: AuthStep) => void;
  setSelectedRole: (role: UserRole) => void;
  setOfferAccepted: (accepted: boolean) => void;
  setDraftFullName: (name: string) => void;
  setDraftAvatar: (url: string | null) => void;
  setDraftPhone: (phone: string) => void;
  submitProfileDraft: () => void;
  acceptTermsAndSendOtp: () => Promise<void>;
  verifyOtp: (code: string) => Promise<void>;
  completeProfileSetup: (input: ProfileSetupInput) => Promise<void>;
  subscribeToPro: () => Promise<void>;
  logout: () => void;
  getUserId: () => string;
}

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('8') && digits.length === 11) return '+7' + digits.slice(1);
  if (digits.startsWith('7') && digits.length === 11) return '+' + digits;
  if (digits.length === 10) return '+7' + digits;
  return phone.trim();
}

function isValidKzPhone(phone: string): boolean {
  const digits = phone.replace(/\D/g, '');
  return (digits.startsWith('7') && digits.length === 11) || (digits.startsWith('8') && digits.length === 11);
}

function locale() {
  return useLocaleStore.getState().locale;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  authStep: 'language',
  isAuthenticated: false,
  onboardingCompleted: false,
  pendingPhone: '',
  draftFullName: '',
  draftAvatar: null,
  selectedRole: 'worker',
  offerAccepted: false,
  offerAcceptedAt: null,
  profile: null,
  isSubmitting: false,
  error: null,

  hydrate: () => {
    const session = loadAuthSession();
    if (!session?.isAuthenticated) {
      set({
        authStep: 'language',
        isAuthenticated: false,
        onboardingCompleted: false,
        profile: null,
      });
      return;
    }

    set({
      isAuthenticated: true,
      onboardingCompleted: session.onboardingCompleted,
      pendingPhone: session.phone,
      selectedRole: session.role,
      offerAccepted: !!session.offerAcceptedAt,
      offerAcceptedAt: session.offerAcceptedAt,
      profile: session.profile,
      draftFullName: session.profile?.full_name ?? '',
      draftAvatar: session.profile?.avatar_url ?? null,
      authStep: session.onboardingCompleted ? 'complete' : 'complete',
    });
  },

  setAuthStep: (step) => set({ authStep: step, error: null }),
  setSelectedRole: (role) => set({ selectedRole: role }),
  setOfferAccepted: (accepted) =>
    set({
      offerAccepted: accepted,
      offerAcceptedAt: accepted ? new Date().toISOString() : null,
    }),
  setDraftFullName: (name) => set({ draftFullName: name }),
  setDraftAvatar: (url) => set({ draftAvatar: url }),
  setDraftPhone: (phone) => set({ pendingPhone: phone }),

  submitProfileDraft: () => {
    const { draftFullName, pendingPhone } = get();
    const loc = locale();

    if (!draftFullName.trim() || draftFullName.trim().length < 2) {
      set({ error: tStatic('errName', loc) });
      return;
    }
    const normalized = normalizePhone(pendingPhone);
    if (!isValidKzPhone(normalized)) {
      set({ error: tStatic('errPhone', loc) });
      return;
    }

    set({ pendingPhone: normalized, error: null, authStep: 'terms' });
  },

  acceptTermsAndSendOtp: async () => {
    const loc = locale();
    if (!get().offerAccepted) {
      set({ error: tStatic('errTerms', loc) });
      return;
    }

    set({ isSubmitting: true, error: null });
    await delay(600);
    set({ isSubmitting: false, authStep: 'otp' });
  },

  verifyOtp: async (code) => {
    const loc = locale();
    const trimmed = code.replace(/\D/g, '');
    if (trimmed.length < 4) {
      set({ error: tStatic('errCode', loc) });
      return;
    }

    set({ isSubmitting: true, error: null });
    await delay(800);

    const { pendingPhone, selectedRole, offerAcceptedAt, draftFullName, draftAvatar } = get();
    const userId = generateId();
    const profile = createEmptyProfile(userId, pendingPhone, selectedRole);
    profile.full_name = draftFullName.trim();
    profile.avatar_url = draftAvatar;
    profile.offer_accepted_at = offerAcceptedAt;
    profile.city = DEFAULT_CITY;

    const session = {
      userId,
      phone: pendingPhone,
      role: selectedRole,
      isAuthenticated: true,
      offerAcceptedAt,
      onboardingCompleted: false,
      profile,
    };

    saveAuthSession(session);

    if (!IS_MOCK_MODE && supabase) {
      try {
        await supabase.from('profiles').upsert({
          id: userId,
          phone: pendingPhone,
          full_name: profile.full_name,
          avatar_url: profile.avatar_url,
          role: selectedRole,
          offer_accepted_at: offerAcceptedAt,
          onboarding_completed: false,
          city: DEFAULT_CITY,
          skills: [],
        });
      } catch (err) {
        console.warn('[Актобе Жұмыс] Profile upsert failed, saved locally.', err);
      }
    }

    set({
      isAuthenticated: true,
      onboardingCompleted: false,
      profile,
      authStep: 'complete',
      isSubmitting: false,
    });
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
      offer_accepted_at: offerAcceptedAt,
      onboarding_completed: true,
      rating: profile.rating || 5.0,
    };

    const session = {
      userId: profile.id,
      phone: pendingPhone,
      role: selectedRole,
      isAuthenticated: true,
      offerAcceptedAt,
      onboardingCompleted: true,
      profile: completedProfile,
    };

    saveAuthSession(session);

    if (!IS_MOCK_MODE && supabase) {
      try {
        await supabase.from('profiles').upsert({
          id: profile.id,
          phone: pendingPhone,
          full_name: completedProfile.full_name,
          avatar_url: completedProfile.avatar_url,
          role: selectedRole,
          city: completedProfile.city,
          district: completedProfile.district,
          skills: completedProfile.skills,
          offer_accepted_at: offerAcceptedAt,
          onboarding_completed: true,
        });
      } catch (err) {
        console.warn('[Актобе Жұмыс] Profile setup sync failed.', err);
      }
    } else {
      await delay(400);
    }

    set({
      profile: completedProfile,
      onboardingCompleted: true,
      authStep: 'complete',
      isSubmitting: false,
    });
  },

  subscribeToPro: async () => {
    const { profile } = get();
    if (!profile || profile.is_pro) return;

    set({ isSubmitting: true, error: null });
    await delay(800);

    const proProfile: Profile = {
      ...profile,
      is_pro: true,
      pro_since: new Date().toISOString(),
    };

    const session = loadAuthSession();
    if (session) {
      saveAuthSession({
        ...session,
        profile: proProfile,
      });
    }

    set({
      profile: proProfile,
      isSubmitting: false,
    });
  },

  logout: () => {
    clearAuthSession();
    set({
      authStep: 'language',
      isAuthenticated: false,
      onboardingCompleted: false,
      pendingPhone: '',
      draftFullName: '',
      draftAvatar: null,
      selectedRole: 'worker',
      offerAccepted: false,
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
