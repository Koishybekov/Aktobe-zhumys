import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Profile,
  Job,
  JobApplication,
  Review,
  ChatMessage,
  ActiveMode,
  CreateJobInput,
  ReviewInput,
} from '@/types';
import { supabase, IS_MOCK_MODE } from '@/lib/supabase';
import { DEFAULT_CITY } from '@/lib/constants';
import { filterOpenJobs } from '@/lib/jobFilters';
import { generateId } from '@/lib/utils';
import { loadAuthSession, saveAuthSession, updateSessionProfile } from '@/lib/authStorage';
import { getActiveUserId, useAuthStore } from '@/store/useAuthStore';
import { normalizePhone } from '@/lib/authPhone';
import { buildSubscriptionActivation } from '@/lib/subscription';
import {
  canPostJob,
  getPostedJobCount,
} from '@/lib/jobPostLimit';
import { fetchJobsFromSupabase } from '@/lib/jobsApi';
import { insertJobToSupabase, JobSubmitError, resolveAuthUserId } from '@/lib/jobCreate';
import { updateMockUserProfileByPhone, findMockUserByPhone } from '@/lib/mockAuth';
import { getProfileById } from '@/data/mockData';

interface AppState {
  currentUser: Profile;
  profiles: Profile[];
  activeMode: ActiveMode;
  jobs: Job[];
  applications: JobApplication[];
  reviews: Review[];
  messages: ChatMessage[];
  selectedCity: string;
  selectedDistrict: string;
  selectedCategory: string;
  searchQuery: string;
  isLoading: boolean;
  jobsLoading: boolean;
  jobsError: string | null;
  initialized: boolean;
  initError: string | null;

  initialize: () => Promise<void>;
  fetchJobs: () => Promise<void>;
  syncUserFromAuth: () => void;
  resetSession: () => void;
  teardownRealtime: () => void;
  setActiveMode: (mode: ActiveMode) => void;
  setSelectedCity: (city: string) => void;
  setSelectedDistrict: (district: string) => void;
  setSelectedCategory: (category: string) => void;
  setSearchQuery: (query: string) => void;

  getOpenJobs: () => Job[];
  getProfile: (id: string) => Profile | undefined;
  getApplicationsForJob: (jobId: string) => JobApplication[];
  getMyClientJobs: () => Job[];
  getMyWorkerApplications: () => JobApplication[];
  hasApplied: (jobId: string) => boolean;
  getJobMessages: (jobId: string) => ChatMessage[];
  getActiveChatJobs: () => Job[];
  getActiveChatCount: () => number;

  applyToJob: (jobId: string) => Promise<void>;
  acceptWorker: (jobId: string, workerId: string) => Promise<void>;
  completeJob: (jobId: string) => Promise<void>;
  createJob: (job: CreateJobInput) => Promise<Job>;
  sendMessage: (jobId: string, content: string) => Promise<void>;
  submitReview: (input: ReviewInput) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  subscribeToPro: () => Promise<void>;
  adminActivateSubscription: (targetPhone: string) => Promise<Profile | null>;
  updateProfileById: (id: string, updates: Partial<Profile>) => Promise<void>;
}

let syncChannel: RealtimeChannel | null = null;

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function emptyProfile(): Profile {
  return {
    id: '',
    phone: '',
    full_name: '',
    avatar_url: null,
    role: 'both',
    rating: 0,
    city: DEFAULT_CITY,
  };
}

function resolveCurrentUser(): Profile {
  const authProfile = useAuthStore.getState().profile ?? loadAuthSession()?.profile;
  if (authProfile?.onboarding_completed) return authProfile;
  return emptyProfile();
}

function loadMockState() {
  const user = resolveCurrentUser();
  return {
    jobs: [] as Job[],
    applications: [] as JobApplication[],
    reviews: [] as Review[],
    messages: [] as ChatMessage[],
    profiles: user.id ? [user] : [],
    currentUser: user,
    selectedCity: user.city ?? DEFAULT_CITY,
    selectedDistrict: 'all',
    isLoading: false,
    initialized: true,
    initError: null as string | null,
  };
}

function requireSupabaseForJobs(): void {
  if (IS_MOCK_MODE || !supabase) {
    throw new Error('SUPABASE_REQUIRED');
  }
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase request timed out')), ms)
    ),
  ]);
}

function userId(): string {
  return getActiveUserId();
}

function upsertProfileList(profiles: Profile[], profile: Profile): Profile[] {
  const idx = profiles.findIndex((p) => p.id === profile.id);
  if (idx === -1) return [...profiles, profile];
  const next = [...profiles];
  next[idx] = profile;
  return next;
}

function setupRealtime(set: (fn: (state: AppState) => Partial<AppState>) => void) {
  if (IS_MOCK_MODE || !supabase) return;

  if (syncChannel) {
    supabase.removeChannel(syncChannel);
    syncChannel = null;
  }

  syncChannel = supabase
    .channel('app-sync')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'jobs' }, (payload) => {
      set((state) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as Job;
          if (state.jobs.some((j) => j.id === row.id)) return {};
          return { jobs: [row, ...state.jobs] };
        }
        if (payload.eventType === 'UPDATE') {
          const row = payload.new as Job;
          return { jobs: state.jobs.map((j) => (j.id === row.id ? row : j)) };
        }
        if (payload.eventType === 'DELETE') {
          const row = payload.old as { id: string };
          return { jobs: state.jobs.filter((j) => j.id !== row.id) };
        }
        return {};
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'job_applications' }, (payload) => {
      set((state) => {
        if (payload.eventType === 'INSERT') {
          const row = payload.new as JobApplication;
          if (state.applications.some((a) => a.id === row.id)) return {};
          return { applications: [...state.applications, row] };
        }
        if (payload.eventType === 'UPDATE') {
          const row = payload.new as JobApplication;
          return { applications: state.applications.map((a) => (a.id === row.id ? row : a)) };
        }
        if (payload.eventType === 'DELETE') {
          const row = payload.old as { id: string };
          return { applications: state.applications.filter((a) => a.id !== row.id) };
        }
        return {};
      });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'chat_messages' }, (payload) => {
      const row = payload.new as ChatMessage;
      set((state) => {
        if (state.messages.some((m) => m.id === row.id)) return {};
        return { messages: [...state.messages, row] };
      });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'reviews' }, (payload) => {
      const row = payload.new as Review;
      set((state) => {
        if (state.reviews.some((r) => r.id === row.id)) return {};
        return { reviews: [...state.reviews, row] };
      });
    })
    .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, (payload) => {
      set((state) => {
        if (payload.eventType === 'DELETE') return {};
        const row = payload.new as Profile;
        const profiles = upsertProfileList(state.profiles, row);
        const uid = userId();
        if (row.id === uid) {
          return { profiles, currentUser: row };
        }
        return { profiles };
      });
    })
    .subscribe();
}

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: emptyProfile(),
  profiles: [],
  activeMode: 'worker',
  jobs: [],
  applications: [],
  reviews: [],
  messages: [],
  selectedCity: DEFAULT_CITY,
  selectedDistrict: 'all',
  selectedCategory: 'all',
  searchQuery: '',
  isLoading: false,
  jobsLoading: false,
  jobsError: null,
  initialized: false,
  initError: null,

  initialize: async () => {
    if (get().initialized || get().isLoading) return;

    set({ isLoading: true, initError: null });

    try {
      if (IS_MOCK_MODE || !supabase) {
        await delay(300);
        set(loadMockState());
        return;
      }

      const uid = userId();
      const [jobsResult, appsRes, reviewsRes, messagesRes, profilesRes, profileRes] = await withTimeout(
        Promise.all([
          fetchJobsFromSupabase(),
          supabase.from('job_applications').select('*'),
          supabase.from('reviews').select('*'),
          supabase.from('chat_messages').select('*').order('created_at', { ascending: true }),
          supabase.from('profiles').select('*'),
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        ]),
        12000
      );

      const errors = [
        appsRes.error,
        reviewsRes.error,
        messagesRes.error,
        profilesRes.error,
        profileRes.error,
      ].filter(Boolean);

      const profile = profileRes.data ?? resolveCurrentUser();
      const profiles = profilesRes.data ?? [];

      if (errors.length > 0) {
        console.warn('[Актобе Жұмыс] Supabase fetch failed:', errors);
      }

      set({
        jobs: jobsResult.data,
        jobsError: jobsResult.error,
        applications: appsRes.data ?? [],
        reviews: reviewsRes.data ?? [],
        messages: messagesRes.data ?? [],
        profiles,
        currentUser: profile,
        selectedCity: profile.city ?? DEFAULT_CITY,
        isLoading: false,
        initialized: true,
        initError: null,
      });

      setupRealtime(set);
    } catch (error) {
      console.warn('[Актобе Жұмыс] Initialize failed.', error);
      const user = resolveCurrentUser();
      set({
        ...loadMockState(),
        currentUser: user,
        selectedCity: user.city ?? DEFAULT_CITY,
        isLoading: false,
        initError: error instanceof Error ? error.message : 'Failed to initialize',
      });
    }
  },

  fetchJobs: async () => {
    set({ jobsLoading: true, jobsError: null });

    try {
      const { data, error } = await fetchJobsFromSupabase();

      set({
        jobs: data,
        jobsLoading: false,
        jobsError: error,
        initialized: true,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Не удалось загрузить вакансии';
      console.error('[Актобе Жұмыс] Failed to load jobs:', error);
      set({
        jobs: [],
        jobsLoading: false,
        jobsError: message,
        initialized: true,
      });
    }
  },

  syncUserFromAuth: () => {
    const profile = useAuthStore.getState().profile;
    if (!profile) return;
    set((state) => ({
      currentUser: profile,
      profiles: upsertProfileList(state.profiles, profile),
      selectedCity: profile.city ?? state.selectedCity,
      activeMode:
        profile.role === 'client' ? 'client' : profile.role === 'worker' ? 'worker' : state.activeMode,
    }));
  },

  teardownRealtime: () => {
    if (syncChannel && supabase) {
      supabase.removeChannel(syncChannel);
      syncChannel = null;
    }
  },

  resetSession: () => {
    get().teardownRealtime();
    set({
      jobs: [],
      jobsError: null,
      applications: [],
      reviews: [],
      messages: [],
      profiles: [],
      initialized: false,
      isLoading: false,
      initError: null,
      currentUser: emptyProfile(),
      selectedCity: DEFAULT_CITY,
    });
  },

  setActiveMode: (mode) => set({ activeMode: mode }),
  setSelectedCity: (city) => set({ selectedCity: city }),
  setSelectedDistrict: (district) => set({ selectedDistrict: district }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getOpenJobs: () => {
    const { jobs, selectedDistrict, selectedCategory, searchQuery } = get();
    return filterOpenJobs(jobs, { selectedCategory, selectedDistrict, searchQuery });
  },

  getProfile: (id) => {
    const uid = userId();
    if (id === uid) return get().currentUser;
    return get().profiles.find((p) => p.id === id) ?? getProfileById(id);
  },

  getApplicationsForJob: (jobId) => get().applications.filter((a) => a.job_id === jobId),

  getMyClientJobs: () => get().jobs.filter((j) => j.client_id === userId()),

  getMyWorkerApplications: () => get().applications.filter((a) => a.worker_id === userId()),

  hasApplied: (jobId) =>
    get().applications.some(
      (a) => a.job_id === jobId && a.worker_id === userId() && a.status !== 'rejected'
    ),

  getJobMessages: (jobId) =>
    get()
      .messages.filter((m) => m.job_id === jobId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),

  getActiveChatJobs: () => {
    const uid = userId();
    return get().jobs.filter(
      (j) =>
        j.status === 'in_progress' &&
        (j.client_id === uid || j.selected_worker_id === uid)
    );
  },

  getActiveChatCount: () => get().getActiveChatJobs().length,

  applyToJob: async (jobId) => {
    const uid = userId();
    const newApp: JobApplication = {
      id: generateId(),
      job_id: jobId,
      worker_id: uid,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase.from('job_applications').insert(newApp).select().single();
      if (error) throw error;
      if (data) newApp.id = data.id;
    } else {
      await delay(300);
    }

    set((state) => ({
      applications: state.applications.some((a) => a.id === newApp.id)
        ? state.applications
        : [...state.applications, newApp],
    }));
  },

  acceptWorker: async (jobId, workerId) => {
    if (!IS_MOCK_MODE && supabase) {
      const { error: jobErr } = await supabase
        .from('jobs')
        .update({ status: 'in_progress', selected_worker_id: workerId })
        .eq('id', jobId);
      if (jobErr) throw jobErr;

      await supabase.from('job_applications').update({ status: 'accepted' }).eq('job_id', jobId).eq('worker_id', workerId);
      await supabase.from('job_applications').update({ status: 'rejected' }).eq('job_id', jobId).neq('worker_id', workerId);
    } else {
      await delay(400);
    }

    set((state) => ({
      jobs: state.jobs.map((j) =>
        j.id === jobId ? { ...j, status: 'in_progress' as const, selected_worker_id: workerId } : j
      ),
      applications: state.applications.map((a) => {
        if (a.job_id !== jobId) return a;
        if (a.worker_id === workerId) return { ...a, status: 'accepted' as const };
        if (a.status === 'pending') return { ...a, status: 'rejected' as const };
        return a;
      }),
    }));
  },

  completeJob: async (jobId) => {
    if (!IS_MOCK_MODE && supabase) {
      const { error } = await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId);
      if (error) throw error;
    } else {
      await delay(300);
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'completed' as const } : j)),
    }));
  },

  createJob: async (jobData) => {
    requireSupabaseForJobs();

    const uid = get().currentUser.id && get().currentUser.id.length > 10
      ? get().currentUser.id
      : await resolveAuthUserId();
    const postedCount = getPostedJobCount(get().jobs, uid);
    if (!canPostJob(postedCount, get().currentUser)) {
      throw new Error('POST_LIMIT');
    }

    try {
      const newJob = await insertJobToSupabase(jobData);
      set((state) => ({
        jobs: state.jobs.some((j) => j.id === newJob.id) ? state.jobs : [newJob, ...state.jobs],
      }));
      return newJob;
    } catch (err) {
      if (err instanceof JobSubmitError) throw err;
      console.error('Job submit error:', err);
      throw err;
    }
  },

  sendMessage: async (jobId, content) => {
    const uid = userId();
    const newMsg: ChatMessage = {
      id: generateId(),
      job_id: jobId,
      sender_id: uid,
      content,
      created_at: new Date().toISOString(),
    };

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase.from('chat_messages').insert(newMsg).select().single();
      if (error) throw error;
      if (data) Object.assign(newMsg, data);
    } else {
      await delay(200);
    }

    set((state) => ({
      messages: state.messages.some((m) => m.id === newMsg.id)
        ? state.messages
        : [...state.messages, newMsg],
    }));
  },

  submitReview: async (input) => {
    const uid = userId();
    const newReview: Review = {
      id: generateId(),
      job_id: input.job_id,
      reviewer_id: uid,
      target_id: input.target_id,
      rating: input.rating,
      comment: input.comment,
    };

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase.from('reviews').insert(newReview).select().single();
      if (error) throw error;
      if (data) newReview.id = data.id;
    } else {
      await delay(300);
    }

    set((state) => ({
      reviews: state.reviews.some((r) => r.id === newReview.id)
        ? state.reviews
        : [...state.reviews, newReview],
    }));
  },

  updateProfile: async (updates) => {
    const uid = userId();

    if (!IS_MOCK_MODE && supabase) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', uid);
      if (error) throw error;
    } else {
      await delay(200);
    }

    const updated = { ...get().currentUser, ...updates };

    set((state) => ({
      currentUser: updated,
      profiles: upsertProfileList(state.profiles, updated),
    }));

    const session = loadAuthSession();
    if (session?.profile) {
      const nextProfile = { ...session.profile, ...updates };
      saveAuthSession(updateSessionProfile(session, nextProfile));
      useAuthStore.setState({ profile: nextProfile });
    }
  },

  subscribeToPro: async () => {
    await useAuthStore.getState().subscribeToPro();
    const profile = useAuthStore.getState().profile;
    if (profile) {
      set((state) => ({
        currentUser: profile,
        profiles: upsertProfileList(state.profiles, profile),
      }));
    }
  },

  updateProfileById: async (id, updates) => {
    if (!IS_MOCK_MODE && supabase) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', id);
      if (error) throw error;
    } else {
      await delay(200);
    }

    set((state) => {
      const profiles = state.profiles.map((p) => (p.id === id ? { ...p, ...updates } : p));
      const currentUser = state.currentUser.id === id ? { ...state.currentUser, ...updates } : state.currentUser;
      return { profiles, currentUser };
    });

    const session = loadAuthSession();
    if (session?.profile?.id === id) {
      const nextProfile = { ...session.profile, ...updates };
      saveAuthSession(updateSessionProfile(session, nextProfile));
      useAuthStore.setState({ profile: nextProfile });
    }
  },

  adminActivateSubscription: async (targetPhone) => {
    const normalized = normalizePhone(targetPhone);

    let target: Profile | null =
      get().profiles.find((p) => normalizePhone(p.phone) === normalized) ?? null;

    if (!target && !IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', normalized)
        .maybeSingle();
      if (error) throw error;
      target = data as Profile | null;
    }

    if (!target) {
      target = findMockUserByPhone(normalized)?.profile ?? null;
    }

    if (!target) return null;

    const activation = buildSubscriptionActivation(target);
    const updated: Profile = { ...target, ...activation };

    if (!IS_MOCK_MODE && supabase) {
      const { error: rpcError } = await supabase.rpc('admin_activate_subscription', {
        target_phone: normalized,
      });
      if (rpcError) {
        const { error } = await supabase.from('profiles').update(activation).eq('id', target.id);
        if (error) throw error;
      }
    } else {
      updateMockUserProfileByPhone(normalized, activation);
    }

    await get().updateProfileById(target.id, activation);

    return updated;
  },
}));
