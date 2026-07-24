import { supabase } from '@/lib/supabase';
import type { Job } from '@/types';

export type JobsFetchResult = {
  data: Job[];
  error: string | null;
};

/** Load all job listings from Supabase `jobs` table (newest first). */
export async function fetchJobsFromSupabase(): Promise<JobsFetchResult> {
  if (!supabase) {
    const message = 'Supabase не подключён. Проверьте VITE_SUPABASE_URL и VITE_SUPABASE_ANON_KEY в .env';
    console.error('[Jobs]', message);
    return { data: [], error: message };
  }

  const { data, error } = await supabase
    .from('jobs')
    .select('*')
    .order('created_at', { ascending: false });

  console.log('Jobs from Supabase:', data);

  if (error) {
    console.error('Jobs from Supabase — error:', error.message, error);
    return { data: [], error: error.message };
  }

  if (!data || data.length === 0) {
    console.warn('Jobs from Supabase: таблица пуста или RLS скрывает записи');
  }

  return { data: data ?? [], error: null };
}
