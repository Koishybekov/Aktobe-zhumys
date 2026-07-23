import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Job, JobApplication, Review, ChatMessage } from '@/types';

/** Supabase project URL — set in `.env` as VITE_SUPABASE_URL */
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL ?? '').trim();

/** Supabase anon / publishable key — set in `.env` as VITE_SUPABASE_ANON_KEY */
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY ?? '').trim();

function createSupabaseClient(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseAnonKey) {
    if (import.meta.env.DEV) {
      console.warn(
        '[EasyJob] Supabase not configured. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to .env'
      );
    }
    return null;
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

export const supabase = createSupabaseClient();

/** True when Supabase client could not be created (missing env vars). */
export const IS_MOCK_MODE = supabase === null;

/** @deprecated Use IS_MOCK_MODE — kept for backward compatibility */
export const USE_MOCK_DATA = IS_MOCK_MODE;

export function isValidSupabaseConfig(url: string, key: string): boolean {
  return Boolean(url.trim() && key.trim());
}

export type Database = {
  public: {
    Tables: {
      profiles: { Row: Profile; Insert: Omit<Profile, 'id'> & { id?: string }; Update: Partial<Profile> };
      jobs: { Row: Job; Insert: Omit<Job, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<Job> };
      job_applications: { Row: JobApplication; Insert: Omit<JobApplication, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<JobApplication> };
      reviews: { Row: Review; Insert: Omit<Review, 'id'> & { id?: string }; Update: Partial<Review> };
      chat_messages: { Row: ChatMessage; Insert: Omit<ChatMessage, 'id' | 'created_at'> & { id?: string; created_at?: string }; Update: Partial<ChatMessage> };
    };
  };
};

export function isSupabaseConfigured(): boolean {
  return supabase !== null;
}

if (import.meta.env.DEV && supabase) {
  console.info('[EasyJob] Supabase connected:', supabaseUrl);
}
