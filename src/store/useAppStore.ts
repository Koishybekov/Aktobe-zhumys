import { create } from 'zustand';
import type {
  Profile,
  Job,
  JobApplication,
  Review,
  ChatMessage,
  ActiveMode,
  ReviewInput,
} from '@/types';
import { supabase, IS_MOCK_MODE } from '@/lib/supabase';
import { DEFAULT_CITY } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import { loadAuthSession, saveAuthSession, updateSessionProfile } from '@/lib/authStorage';
import { getActiveUserId, useAuthStore } from '@/store/useAuthStore';
import {
  mockProfiles,
  mockJobs,
  mockApplications,
  mockReviews,
  mockMessages,
  getProfileById,
} from '@/data/mockData';

interface AppState {
  currentUser: Profile;
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
  initialized: boolean;
  initError: string | null;

  initialize: () => Promise<void>;
  syncUserFromAuth: () => void;
  resetSession: () => void;
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
  createJob: (job: Omit<Job, 'id' | 'client_id' | 'status' | 'selected_worker_id' | 'created_at'>) => Promise<Job>;
  sendMessage: (jobId: string, content: string) => Promise<void>;
  submitReview: (input: ReviewInput) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  subscribeToPro: () => Promise<void>;
}

function delay(ms = 400): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function resolveCurrentUser(): Profile {
  const authProfile = useAuthStore.getState().profile ?? loadAuthSession()?.profile;
  if (authProfile?.onboarding_completed) return authProfile;
  return mockProfiles[0];
}

function loadMockState() {
  const user = resolveCurrentUser();
  return {
    jobs: [...mockJobs],
    applications: [...mockApplications],
    reviews: [...mockReviews],
    messages: [...mockMessages],
    currentUser: user,
    selectedCity: user.city ?? DEFAULT_CITY,
    selectedDistrict: 'all',
    isLoading: false,
    initialized: true,
    initError: null as string | null,
  };
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

export const useAppStore = create<AppState>((set, get) => ({
  currentUser: mockProfiles[0],
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
      const [jobsRes, appsRes, reviewsRes, profileRes] = await withTimeout(
        Promise.all([
          supabase.from('jobs').select('*').order('created_at', { ascending: false }),
          supabase.from('job_applications').select('*'),
          supabase.from('reviews').select('*'),
          supabase.from('profiles').select('*').eq('id', uid).maybeSingle(),
        ]),
        8000
      );

      const hasErrors =
        jobsRes.error || appsRes.error || reviewsRes.error || profileRes.error;

      if (hasErrors) {
        console.warn('[EasyJob] Supabase fetch failed — falling back to mock data.', {
          jobs: jobsRes.error,
          apps: appsRes.error,
          reviews: reviewsRes.error,
          profile: profileRes.error,
        });
        set(loadMockState());
        return;
      }

      const profile = profileRes.data ?? resolveCurrentUser();

      set({
        jobs: jobsRes.data ?? [],
        applications: appsRes.data ?? [],
        reviews: reviewsRes.data ?? [],
        messages: [...mockMessages],
        currentUser: profile,
        selectedCity: profile.city ?? DEFAULT_CITY,
        isLoading: false,
        initialized: true,
        initError: null,
      });
    } catch (error) {
      console.warn('[EasyJob] Initialize failed — falling back to mock data.', error);
      set({
        ...loadMockState(),
        initError: null,
      });
    }
  },

  syncUserFromAuth: () => {
    const profile = useAuthStore.getState().profile;
    if (!profile) return;
    set({
      currentUser: profile,
      selectedCity: profile.city ?? get().selectedCity,
      activeMode:
        profile.role === 'client' ? 'client' : profile.role === 'worker' ? 'worker' : get().activeMode,
    });
  },

  resetSession: () => {
    set({
      jobs: [],
      applications: [],
      reviews: [],
      messages: [],
      initialized: false,
      isLoading: false,
      initError: null,
      currentUser: mockProfiles[0],
      selectedCity: DEFAULT_CITY,
    });
  },

  setActiveMode: (mode) => set({ activeMode: mode }),
  setSelectedCity: (city) => set({ selectedCity: city }),
  setSelectedDistrict: (district) => set({ selectedDistrict: district }),
  setSelectedCategory: (category) => set({ selectedCategory: category }),
  setSearchQuery: (query) => set({ searchQuery: query }),

  getOpenJobs: () => {
    const { jobs, selectedCity, selectedDistrict, selectedCategory, searchQuery } = get();
    return jobs.filter((job) => {
      if (job.status !== 'open') return false;
      if (selectedCity !== 'All' && job.city !== selectedCity) return false;
      if (selectedDistrict !== 'all' && job.district !== selectedDistrict) return false;
      if (selectedCategory !== 'all' && job.category !== selectedCategory) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        return (
          job.title.toLowerCase().includes(q) ||
          job.description.toLowerCase().includes(q) ||
          job.location_address.toLowerCase().includes(q)
        );
      }
      return true;
    });
  },

  getProfile: (id) => {
    const uid = userId();
    if (id === uid) return get().currentUser;
    return getProfileById(id) ?? mockProfiles.find((p) => p.id === id);
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
      try {
        await supabase.from('job_applications').insert(newApp);
      } catch (error) {
        console.warn('[EasyJob] applyToJob remote failed, saved locally.', error);
      }
    } else {
      await delay(300);
    }

    set((state) => ({ applications: [...state.applications, newApp] }));
  },

  acceptWorker: async (jobId, workerId) => {
    if (!IS_MOCK_MODE && supabase) {
      try {
        await supabase.from('jobs').update({ status: 'in_progress', selected_worker_id: workerId }).eq('id', jobId);
        await supabase.from('job_applications').update({ status: 'accepted' }).eq('job_id', jobId).eq('worker_id', workerId);
        await supabase.from('job_applications').update({ status: 'rejected' }).eq('job_id', jobId).neq('worker_id', workerId);
      } catch (error) {
        console.warn('[EasyJob] acceptWorker remote failed, saved locally.', error);
      }
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
      try {
        await supabase.from('jobs').update({ status: 'completed' }).eq('id', jobId);
      } catch (error) {
        console.warn('[EasyJob] completeJob remote failed, saved locally.', error);
      }
    } else {
      await delay(300);
    }

    set((state) => ({
      jobs: state.jobs.map((j) => (j.id === jobId ? { ...j, status: 'completed' as const } : j)),
    }));
  },

  createJob: async (jobData) => {
    const uid = userId();
    const newJob: Job = {
      ...jobData,
      id: generateId(),
      client_id: uid,
      status: 'open',
      selected_worker_id: null,
      created_at: new Date().toISOString(),
    };

    if (!IS_MOCK_MODE && supabase) {
      try {
        await supabase.from('jobs').insert(newJob);
      } catch (error) {
        console.warn('[EasyJob] createJob remote failed, saved locally.', error);
      }
    } else {
      await delay(500);
    }

    set((state) => ({ jobs: [newJob, ...state.jobs] }));
    return newJob;
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
      try {
        await supabase.from('chat_messages').insert(newMsg);
      } catch (error) {
        console.warn('[EasyJob] sendMessage remote failed, saved locally.', error);
      }
    } else {
      await delay(200);
    }

    set((state) => ({ messages: [...state.messages, newMsg] }));
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
      try {
        await supabase.from('reviews').insert(newReview);
      } catch (error) {
        console.warn('[EasyJob] submitReview remote failed, saved locally.', error);
      }
    } else {
      await delay(300);
    }

    set((state) => ({ reviews: [...state.reviews, newReview] }));
  },

  updateProfile: async (updates) => {
    const uid = userId();

    if (!IS_MOCK_MODE && supabase) {
      try {
        await supabase.from('profiles').update(updates).eq('id', uid);
      } catch (error) {
        console.warn('[EasyJob] updateProfile remote failed, saved locally.', error);
      }
    } else {
      await delay(200);
    }

    const updated = { ...get().currentUser, ...updates };

    set({ currentUser: updated });

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
      set({ currentUser: profile });
    }
  },
}));
