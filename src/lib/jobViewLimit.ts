import type { Profile } from '@/types';
import { hasActiveSubscription } from '@/lib/subscription';

const STORAGE_PREFIX = 'aktobe_job_views_';
export const FREE_JOB_VIEW_LIMIT = 3;
export interface JobViewState {
  viewedJobIds: string[];
}

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

export function loadJobViewState(userId: string): JobViewState {
  try {
    const raw = localStorage.getItem(storageKey(userId));
    if (!raw) return { viewedJobIds: [] };
    const parsed = JSON.parse(raw) as JobViewState;
    const ids = Array.isArray(parsed.viewedJobIds) ? parsed.viewedJobIds : [];
    return { viewedJobIds: ids.slice(0, FREE_JOB_VIEW_LIMIT + 10) };
  } catch {
    return { viewedJobIds: [] };
  }
}

export function saveJobViewState(userId: string, state: JobViewState): void {
  localStorage.setItem(storageKey(userId), JSON.stringify(state));
}

export function getViewedCount(userId: string): number {
  return loadJobViewState(userId).viewedJobIds.length;
}

/**
 * Strict limit: max 3 unique listings without subscription.
 * Already-viewed listings can be reopened; any NEW listing after 3 is blocked.
 */
export function canOpenJobDetails(
  userId: string,
  jobId: string,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>
): boolean {
  if (hasActiveSubscription(profile)) return true;

  const state = loadJobViewState(userId);
  if (state.viewedJobIds.includes(jobId)) return true;
  return state.viewedJobIds.length < FREE_JOB_VIEW_LIMIT;
}

export function getRemainingFreeViews(
  userId: string,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>
): number {
  if (hasActiveSubscription(profile)) return Infinity;
  const used = getViewedCount(userId);
  return Math.max(0, FREE_JOB_VIEW_LIMIT - used);
}

export function isPaywallActive(
  userId: string,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>
): boolean {
  if (hasActiveSubscription(profile)) return false;
  return getViewedCount(userId) >= FREE_JOB_VIEW_LIMIT;
}

/** Record view only if under limit. Returns allowed=false when 4th+ unique job attempted. */
export function tryRecordJobView(
  userId: string,
  jobId: string,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>
): { allowed: boolean; state: JobViewState; limitReached: boolean } {
  if (hasActiveSubscription(profile)) {
    return { allowed: true, state: loadJobViewState(userId), limitReached: false };
  }

  const state = loadJobViewState(userId);
  if (state.viewedJobIds.includes(jobId)) {
    return { allowed: true, state, limitReached: state.viewedJobIds.length >= FREE_JOB_VIEW_LIMIT };
  }

  if (state.viewedJobIds.length >= FREE_JOB_VIEW_LIMIT) {
    return { allowed: false, state, limitReached: true };
  }

  const next: JobViewState = { viewedJobIds: [...state.viewedJobIds, jobId] };
  saveJobViewState(userId, next);
  const limitReached = next.viewedJobIds.length >= FREE_JOB_VIEW_LIMIT;
  return { allowed: true, state: next, limitReached };
}

export function syncJobViewsFromProfile(userId: string, viewedJobIds?: string[]): JobViewState {
  const local = loadJobViewState(userId);
  const remote = viewedJobIds ?? [];
  const merged = [...new Set([...local.viewedJobIds, ...remote])].slice(0, FREE_JOB_VIEW_LIMIT);
  const state = { viewedJobIds: merged };
  saveJobViewState(userId, state);
  return state;
}
