import { create } from 'zustand';
import type { RealtimeChannel } from '@supabase/supabase-js';
import type {
  Profile,
  Job,
  JobApplication,
  Review,
  ChatMessage,
  Conversation,
  Message,
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
import { buildProGrantUpdate, isProActive, PROFILE_SELECT, normalizeProfileProFields } from '@/lib/subscription';
import {
  canPostJob,
  getPostedJobCount,
} from '@/lib/jobPostLimit';
import { fetchJobsFromSupabase } from '@/lib/jobsApi';
import { findProfileByIdentifier, findProfileByIdentifierInList } from '@/lib/profileLookup';
import { insertJobToSupabase, JobSubmitError, resolveAuthUserId } from '@/lib/jobCreate';
import { updateMockUserProfileByPhone, findMockUserByPhone } from '@/lib/mockAuth';
import { getProfileById } from '@/data/mockData';
import {
  findConversationForJobAndWorker,
  sortConversationsByRecent,
} from '@/lib/conversationsApi';

interface AppState {
  currentUser: Profile;
  profiles: Profile[];
  activeMode: ActiveMode;
  jobs: Job[];
  applications: JobApplication[];
  reviews: Review[];
  messages: ChatMessage[];
  conversations: Conversation[];
  conversationMessages: Message[];
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
  getMyConversations: () => Conversation[];
  getConversationCount: () => number;
  getConversationMessages: (conversationId: string) => Message[];
  findConversationForJob: (jobId: string) => string | null;
  findOrCreateConversationForJob: (jobId: string, introMessage: string) => Promise<string>;
  sendConversationMessage: (conversationId: string, content: string) => Promise<void>;
  hasUserReviewedJob: (jobId: string) => boolean;
  getPendingReviewJobs: () => Job[];
  getReviewTargetForJob: (job: Job) => { targetId: string; targetName: string };

  applyToJob: (jobId: string) => Promise<void>;
  acceptWorker: (jobId: string, workerId: string) => Promise<void>;
  completeJob: (jobId: string) => Promise<void>;
  createJob: (job: CreateJobInput) => Promise<Job>;
  sendMessage: (jobId: string, content: string) => Promise<void>;
  submitReview: (input: ReviewInput) => Promise<void>;
  updateProfile: (updates: Partial<Profile>) => Promise<void>;
  subscribeToPro: () => Promise<void>;
  adminActivateSubscription: (targetIdentifier: string) => Promise<Profile | null>;
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
    conversations: [] as Conversation[],
    conversationMessages: [] as Message[],
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

function upsertConversation(conversations: Conversation[], conversation: Conversation): Conversation[] {
  const idx = conversations.findIndex((c) => c.id === conversation.id);
  if (idx === -1) return [...conversations, conversation];
  const next = [...conversations];
  next[idx] = conversation;
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
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, (payload) => {
      const row = payload.new as Conversation;
      set((state) => {
        if (state.conversations.some((c) => c.id === row.id)) return {};
        return { conversations: [...state.conversations, row] };
      });
    })
    .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, (payload) => {
      const row = payload.new as Message;
      set((state) => {
        if (state.conversationMessages.some((m) => m.id === row.id)) return {};
        return { conversationMessages: [...state.conversationMessages, row] };
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
        const row = normalizeProfileProFields(payload.new as Profile);
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
  conversations: [],
  conversationMessages: [],
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
      const [jobsResult, appsRes, reviewsRes, messagesRes, convRes, convMsgRes, profilesRes, profileRes] = await withTimeout(
        Promise.all([
          fetchJobsFromSupabase(),
          supabase.from('job_applications').select('*'),
          supabase.from('reviews').select('*'),
          supabase.from('chat_messages').select('*').order('created_at', { ascending: true }),
          supabase.from('conversations').select('*').or(`worker_id.eq.${uid},client_id.eq.${uid}`),
          supabase.from('messages').select('*').order('created_at', { ascending: true }),
          supabase.from('profiles').select(PROFILE_SELECT),
          supabase.from('profiles').select(PROFILE_SELECT).eq('id', uid).maybeSingle(),
        ]),
        12000
      );

      const convIds = new Set((convRes.data ?? []).map((c: Conversation) => c.id));
      const filteredConvMessages = (convMsgRes.data ?? []).filter((m: Message) =>
        convIds.has(m.conversation_id)
      );

      const errors = [
        appsRes.error,
        reviewsRes.error,
        messagesRes.error,
        convRes.error,
        convMsgRes.error,
        profilesRes.error,
        profileRes.error,
      ].filter(Boolean);

      const profile = profileRes.data
        ? normalizeProfileProFields(profileRes.data as Profile)
        : resolveCurrentUser();
      const profiles = (profilesRes.data ?? []).map((p) => normalizeProfileProFields(p as Profile));

      if (errors.length > 0) {
        console.warn('[Актобе Жұмыс] Supabase fetch failed:', errors);
      }

      set({
        jobs: jobsResult.data,
        jobsError: jobsResult.error,
        applications: appsRes.data ?? [],
        reviews: reviewsRes.data ?? [],
        messages: messagesRes.data ?? [],
        conversations: convRes.data ?? [],
        conversationMessages: filteredConvMessages,
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
    const normalized = normalizeProfileProFields(profile);
    set((state) => ({
      currentUser: normalized,
      profiles: upsertProfileList(state.profiles, normalized),
      selectedCity: normalized.city ?? state.selectedCity,
      activeMode:
        normalized.role === 'client' ? 'client' : normalized.role === 'worker' ? 'worker' : state.activeMode,
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
      conversations: [],
      conversationMessages: [],
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

  getMyConversations: () => {
    const uid = userId();
    const mine = get().conversations.filter((c) => c.worker_id === uid || c.client_id === uid);
    return sortConversationsByRecent(mine, get().conversationMessages);
  },

  getConversationCount: () => get().getMyConversations().length,

  getConversationMessages: (conversationId) =>
    get()
      .conversationMessages.filter((m) => m.conversation_id === conversationId)
      .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),

  findConversationForJob: (jobId) => {
    const uid = userId();
    const existing = findConversationForJobAndWorker(get().conversations, jobId, uid);
    return existing?.id ?? null;
  },

  findOrCreateConversationForJob: async (jobId, introMessage) => {
    const uid = userId();
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Job not found');
    if (job.client_id === uid) throw new Error('Cannot apply to own job');

    const cached = findConversationForJobAndWorker(get().conversations, jobId, uid);
    if (cached) return cached.id;

    if (!IS_MOCK_MODE && supabase) {
      const { data: found, error: findErr } = await supabase
        .from('conversations')
        .select('*')
        .eq('job_id', jobId)
        .eq('worker_id', uid)
        .maybeSingle();

      if (findErr) console.warn('[Chat] Conversation lookup failed:', findErr);

      if (found) {
        const conv = found as Conversation;
        set((state) => ({ conversations: upsertConversation(state.conversations, conv) }));
        return conv.id;
      }

      const { data: conv, error: convErr } = await supabase
        .from('conversations')
        .insert({ job_id: jobId, worker_id: uid, client_id: job.client_id })
        .select()
        .single();

      if (convErr) throw convErr;

      const { data: msg, error: msgErr } = await supabase
        .from('messages')
        .insert({
          conversation_id: conv.id,
          sender_id: uid,
          content: introMessage,
          is_system: true,
        })
        .select()
        .single();

      if (msgErr) console.warn('[Chat] Initial message failed:', msgErr);

      set((state) => ({
        conversations: upsertConversation(state.conversations, conv as Conversation),
        conversationMessages: msg
          ? [...state.conversationMessages, msg as Message]
          : state.conversationMessages,
      }));

      return conv.id;
    }

    const conv: Conversation = {
      id: generateId(),
      job_id: jobId,
      worker_id: uid,
      client_id: job.client_id,
      created_at: new Date().toISOString(),
    };
    const msg: Message = {
      id: generateId(),
      conversation_id: conv.id,
      sender_id: uid,
      content: introMessage,
      is_system: true,
      created_at: new Date().toISOString(),
    };

    set((state) => ({
      conversations: [...state.conversations, conv],
      conversationMessages: [...state.conversationMessages, msg],
    }));

    return conv.id;
  },

  sendConversationMessage: async (conversationId, content) => {
    const uid = userId();
    const payload = {
      conversation_id: conversationId,
      sender_id: uid,
      content,
      is_system: false,
    };

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase.from('messages').insert(payload).select().single();
      if (error) throw error;
      set((state) => ({
        conversationMessages: state.conversationMessages.some((m) => m.id === data.id)
          ? state.conversationMessages
          : [...state.conversationMessages, data as Message],
      }));
      return;
    }

    const msg: Message = {
      id: generateId(),
      ...payload,
      created_at: new Date().toISOString(),
    };
    set((state) => ({
      conversationMessages: [...state.conversationMessages, msg],
    }));
  },

  hasUserReviewedJob: (jobId) => {
    const uid = userId();
    return get().reviews.some((r) => r.job_id === jobId && r.reviewer_id === uid);
  },

  getPendingReviewJobs: () => {
    const uid = userId();
    return get().jobs.filter((job) => {
      if (job.status !== 'completed') return false;
      const isClient = job.client_id === uid;
      const isWorker = job.selected_worker_id === uid;
      if (!isClient && !isWorker) return false;
      return !get().hasUserReviewedJob(job.id);
    });
  },

  getReviewTargetForJob: (job) => {
    const uid = userId();
    if (job.client_id === uid && job.selected_worker_id) {
      return { targetId: job.selected_worker_id, targetName: 'worker' };
    }
    return { targetId: job.client_id, targetName: 'client' };
  },

  applyToJob: async (jobId) => {
    const uid = userId();
    if (!uid) throw new Error('Not authenticated');
    if (get().hasApplied(jobId)) return;

    const payload = {
      job_id: jobId,
      worker_id: uid,
      status: 'pending' as const,
    };

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase
        .from('job_applications')
        .insert(payload)
        .select()
        .single();

      if (error) {
        if (error.code === '23505') return;
        throw error;
      }

      if (data) {
        set((state) => ({
          applications: state.applications.some((a) => a.id === data.id)
            ? state.applications
            : [...state.applications, data as JobApplication],
        }));
      }
      return;
    }

    const newApp: JobApplication = {
      id: generateId(),
      job_id: jobId,
      worker_id: uid,
      status: 'pending',
      created_at: new Date().toISOString(),
    };

    await delay(300);

    set((state) => ({
      applications: state.applications.some(
        (a) => a.job_id === jobId && a.worker_id === uid
      )
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
    const uid = userId();
    const job = get().jobs.find((j) => j.id === jobId);
    if (!job) throw new Error('Job not found');
    if (job.client_id !== uid) throw new Error('Only job owner can complete');
    if (job.status !== 'in_progress') throw new Error('Job is not in progress');

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
    const payload = {
      job_id: input.job_id,
      reviewer_id: uid,
      target_id: input.target_id,
      rating: input.rating,
      comment: input.comment,
    };

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase.from('reviews').insert(payload).select().single();
      if (error) {
        if (error.code === '23505') return;
        throw error;
      }
      if (data) {
        set((state) => ({
          reviews: state.reviews.some((r) => r.id === data.id)
            ? state.reviews
            : [...state.reviews, data as Review],
        }));

        const { data: targetProfile } = await supabase
          .from('profiles')
          .select(PROFILE_SELECT)
          .eq('id', input.target_id)
          .maybeSingle();

        if (targetProfile) {
          const normalized = normalizeProfileProFields(targetProfile as Profile);
          set((state) => ({
            profiles: upsertProfileList(state.profiles, normalized),
            currentUser: state.currentUser.id === normalized.id ? normalized : state.currentUser,
          }));
        }
      }
      return;
    }

    const newReview: Review = {
      id: generateId(),
      ...payload,
      created_at: new Date().toISOString(),
    };

    await delay(300);

    set((state) => {
      const targetReviews = [...state.reviews, newReview].filter((r) => r.target_id === input.target_id);
      const avg = targetReviews.reduce((sum, r) => sum + r.rating, 0) / targetReviews.length;
      const profiles = state.profiles.map((p) =>
        p.id === input.target_id ? { ...p, rating: Math.round(avg * 100) / 100 } : p
      );
      const currentUser =
        state.currentUser.id === input.target_id
          ? { ...state.currentUser, rating: Math.round(avg * 100) / 100 }
          : state.currentUser;

      return {
        reviews: state.reviews.some((r) => r.id === newReview.id)
          ? state.reviews
          : [...state.reviews, newReview],
        profiles,
        currentUser,
      };
    });
  },

  updateProfile: async (updates) => {
    const uid = userId();

    if (!IS_MOCK_MODE && supabase) {
      const { error } = await supabase.from('profiles').update(updates).eq('id', uid);
      if (error) throw error;
    } else {
      await delay(200);
    }

    const updated = normalizeProfileProFields({ ...get().currentUser, ...updates });

    set((state) => ({
      currentUser: updated,
      profiles: upsertProfileList(state.profiles, updated),
    }));

    const session = loadAuthSession();
    if (session?.profile) {
      const nextProfile = normalizeProfileProFields({ ...session.profile, ...updates });
      saveAuthSession(updateSessionProfile(session, nextProfile));
      useAuthStore.setState({
        profile: nextProfile,
        isPro: isProActive(nextProfile),
      });
    }

    await useAuthStore.getState().refreshProfile();
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
      const nextProfile = normalizeProfileProFields({ ...session.profile, ...updates });
      saveAuthSession(updateSessionProfile(session, nextProfile));
      useAuthStore.setState({
        profile: nextProfile,
        isPro: isProActive(nextProfile),
      });
    }

    await useAuthStore.getState().refreshProfile();
  },

  adminActivateSubscription: async (targetIdentifier) => {
    const trimmed = targetIdentifier.trim();
    const lookupPhone = trimmed.includes('@')
      ? null
      : normalizePhone(trimmed);

    let target: Profile | null = findProfileByIdentifierInList(trimmed, get().profiles);

    if (!target && !IS_MOCK_MODE && supabase) {
      target = await findProfileByIdentifier(trimmed);
    }

    if (!target) {
      target = lookupPhone
        ? findMockUserByPhone(lookupPhone)?.profile ?? null
        : null;
    }

    if (!target?.id) return null;

    const proUpdate = buildProGrantUpdate(target);
    let updated: Profile = normalizeProfileProFields({ ...target, ...proUpdate });

    if (!IS_MOCK_MODE && supabase) {
      const { data, error } = await supabase
        .from('profiles')
        .update({
          is_pro: true,
          pro_expires_at: proUpdate.pro_expires_at,
          is_subscribed: true,
          subscribed_until: proUpdate.subscribed_until,
          pro_since: proUpdate.pro_since,
        })
        .eq('id', target.id)
        .select(PROFILE_SELECT)
        .single();

      if (error) {
        console.error('Admin PRO grant update failed:', error);
        const rpcPhone = lookupPhone ?? target.phone;
        if (rpcPhone) {
          const { error: rpcError } = await supabase.rpc('admin_activate_subscription', {
            target_phone: normalizePhone(rpcPhone),
          });
          if (rpcError) {
            console.error('Admin PRO grant RPC failed:', rpcError);
            throw rpcError;
          }
        } else {
          throw error;
        }
        const refreshed = await findProfileByIdentifier(trimmed);
        if (refreshed) updated = refreshed;
      } else if (data) {
        updated = normalizeProfileProFields(data as Profile);
      }
    } else if (lookupPhone) {
      updateMockUserProfileByPhone(lookupPhone, proUpdate);
    }

    set((state) => ({
      profiles: upsertProfileList(state.profiles, updated),
      currentUser: state.currentUser.id === target!.id ? updated : state.currentUser,
    }));

    const session = loadAuthSession();
    if (session?.profile?.id === target.id) {
      saveAuthSession(updateSessionProfile(session, updated));
      useAuthStore.setState({
        profile: updated,
        isPro: isProActive(updated),
      });
    }

    await useAuthStore.getState().refreshProfile();

    return updated;
  },
}));
