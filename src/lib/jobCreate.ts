import type { PostgrestError } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import { DEFAULT_JOB_CITY, isValidJobCategoryId } from '@/lib/constants';
import { getActiveUserId } from '@/store/useAuthStore';
import type { CreateJobInput, Job } from '@/types';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type JobFieldKey =
  | 'title'
  | 'company'
  | 'city'
  | 'salary'
  | 'description'
  | 'phone'
  | 'category'
  | 'auth';

export class JobSubmitError extends Error {
  field?: JobFieldKey;

  constructor(message: string, field?: JobFieldKey) {
    super(message);
    this.name = 'JobSubmitError';
    this.field = field;
  }
}

export function isUuid(value: string): boolean {
  return UUID_RE.test(value);
}

/** Current Supabase auth user id (session / anonymous). */
export async function resolveAuthUserId(): Promise<string> {
  if (supabase) {
    const { data: sessionData } = await supabase.auth.getSession();
    if (sessionData.session?.user?.id) return sessionData.session.user.id;

    const { data: userData } = await supabase.auth.getUser();
    if (userData.user?.id) return userData.user.id;
  }

  const fallback = getActiveUserId();
  if (fallback && isUuid(fallback)) return fallback;

  throw new JobSubmitError('AUTH_REQUIRED', 'auth');
}

export function validateCreateJobInput(input: CreateJobInput): Partial<Record<JobFieldKey, string>> {
  const errors: Partial<Record<JobFieldKey, string>> = {};

  if (!input.title?.trim() || input.title.trim().length < 3) {
    errors.title = 'TITLE_REQUIRED';
  }
  if (!input.company?.trim() || input.company.trim().length < 2) {
    errors.company = 'COMPANY_REQUIRED';
  }
  if (!input.description?.trim() || input.description.trim().length < 10) {
    errors.description = 'DESCRIPTION_REQUIRED';
  }
  if (!isValidJobCategoryId(input.category?.trim())) {
    errors.category = 'CATEGORY_REQUIRED';
  }
  if (!input.phone?.trim()) {
    errors.phone = 'PHONE_REQUIRED';
  }
  if (!input.salary || Number(input.salary) < 1000) {
    errors.salary = 'SALARY_REQUIRED';
  }
  if (!input.city?.trim()) {
    errors.city = 'CITY_REQUIRED';
  }

  return errors;
}

/** Row shape for Supabase `jobs` insert — core columns required by production schema. */
export function buildJobInsertRow(input: CreateJobInput, ownerId: string) {
  const title = input.title.trim();
  const description = input.description.trim();
  const city = input.city.trim() || DEFAULT_JOB_CITY;
  const salary = Number(input.salary);
  const category = input.category.trim();

  return {
    title,
    salary,
    description,
    phone: input.phone.trim(),
    category,
    city,
    client_id: ownerId,
  };
}

/** Extended row with optional columns (may be absent in older DB schemas). */
export function buildJobInsertRowExtended(input: CreateJobInput, ownerId: string) {
  return {
    ...buildJobInsertRow(input, ownerId),
    company: input.company.trim(),
    user_id: ownerId,
    status: 'open' as const,
    selected_worker_id: null,
  };
}

function isSchemaMismatchError(error: PostgrestError): boolean {
  const code = error.code ?? '';
  const combined = `${error.message} ${error.details ?? ''} ${error.hint ?? ''}`.toLowerCase();
  return (
    code === 'PGRST204' ||
    combined.includes('column') ||
    combined.includes('schema cache') ||
    combined.includes('does not exist')
  );
}

export function formatJobSchemaErrorMessage(error: PostgrestError): string {
  if (isSchemaMismatchError(error)) {
    return `Schema error: ${error.message}. Core fields (title, salary, description, phone, category, city) were sent.`;
  }
  return error.message;
}

export function mapSupabaseJobError(error: PostgrestError): JobSubmitError {
  const msg = error.message.toLowerCase();
  const details = (error.details ?? '').toLowerCase();
  const combined = `${msg} ${details}`;

  if (combined.includes('user_id') || combined.includes('client_id') || combined.includes('foreign key')) {
    return new JobSubmitError(error.message, 'auth');
  }
  if (combined.includes('title')) return new JobSubmitError(error.message, 'title');
  if (combined.includes('company')) return new JobSubmitError(error.message, 'company');
  if (combined.includes('description')) return new JobSubmitError(error.message, 'description');
  if (combined.includes('salary') || combined.includes('price')) return new JobSubmitError(error.message, 'salary');
  if (combined.includes('phone')) return new JobSubmitError(error.message, 'phone');
  if (combined.includes('category') && !combined.includes('client_id')) {
    return new JobSubmitError(error.message, 'category');
  }
  if (combined.includes('city')) return new JobSubmitError(error.message, 'city');

  return new JobSubmitError(error.message);
}

export async function insertJobToSupabase(input: CreateJobInput): Promise<Job> {
  if (!supabase) throw new JobSubmitError('SUPABASE_REQUIRED', 'auth');

  const fieldErrors = validateCreateJobInput(input);
  const firstKey = Object.keys(fieldErrors)[0] as JobFieldKey | undefined;
  if (firstKey) {
    throw new JobSubmitError(fieldErrors[firstKey] ?? 'VALIDATION_FAILED', firstKey);
  }

  const ownerId = await resolveAuthUserId();
  const coreRow = buildJobInsertRow(input, ownerId);
  const extendedRow = buildJobInsertRowExtended(input, ownerId);

  let result = await supabase.from('jobs').insert([extendedRow]).select('*').single();

  if (result.error && isSchemaMismatchError(result.error)) {
    console.warn('[Актобе Жұмыс] Extended job insert failed, retrying core columns:', result.error.message);
    result = await supabase.from('jobs').insert([coreRow]).select('*').single();
  }

  const { data, error } = result;

  if (error) {
    console.error('Job submit error:', error);
    const mapped = mapSupabaseJobError(error);
    mapped.message = formatJobSchemaErrorMessage(error);
    throw mapped;
  }

  if (!data) {
    console.error('Job submit error: empty response from Supabase');
    throw new JobSubmitError('EMPTY_RESPONSE');
  }

  console.log('Job created in Supabase:', data);
  return data as Job;
}
