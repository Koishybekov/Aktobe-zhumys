import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Profile, Job, JobApplication, Review, ChatMessage } from '@/types';

const PLACEHOLDER_PATTERNS = [
  'your-project',
  'your-anon-key',
  'example.com',
  'placeholder',
  'changeme',
  'xxx',
];

function env(key: string): string {
  return (import.meta.env[key] ?? '').trim();
}

const supabaseUrl = env('VITE_SUPABASE_URL');
const supabaseAnonKey = env('VITE_SUPABASE_ANON_KEY');
const mockFlag = env('VITE_USE_MOCK_DATA');

/** True when URL/key look like real Supabase credentials (not empty or placeholder). */
export function isValidSupabaseConfig(url: string, key: string): boolean {
  if (!url || !key) return false;

  const lowerUrl = url.toLowerCase();
  const lowerKey = key.toLowerCase();

  if (PLACEHOLDER_PATTERNS.some((p) => lowerUrl.includes(p) || lowerKey.includes(p))) {
    return false;
  }

  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.includes('.');
  } catch {
    return false;
  }
}

const hasValidCredentials = isValidSupabaseConfig(supabaseUrl, supabaseAnonKey);

/**
 * Use mock data when explicitly requested, credentials are missing/invalid,
 * or Supabase client creation fails.
 */
export const USE_MOCK_DATA =
  mockFlag === 'true' || mockFlag === '1' || !hasValidCredentials;

function createSupabaseClient(): SupabaseClient | null {
  if (USE_MOCK_DATA) return null;

  try {
    return createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (error) {
    console.warn('[EasyJob] Supabase client init failed — using mock data.', error);
    return null;
  }
}

export const supabase = createSupabaseClient();

/** Effective mock mode after client creation (covers init failure). */
export const IS_MOCK_MODE = USE_MOCK_DATA || supabase === null;

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
  return supabase !== null && !IS_MOCK_MODE;
}

if (import.meta.env.DEV && IS_MOCK_MODE) {
  console.info('[EasyJob] Running in mock data mode (Supabase not configured).');
}
