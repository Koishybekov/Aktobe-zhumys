import type { Profile } from '@/types';
import { hasActiveSubscription } from '@/lib/subscription';

export const FREE_JOB_POST_LIMIT = 3;

/** Count all jobs ever posted by this employer (any status). */
export function getPostedJobCount(jobs: { client_id: string }[], userId: string): number {
  return jobs.filter((j) => j.client_id === userId).length;
}

export function canPostJob(
  postedCount: number,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro' | 'pro_expires_at'>
): boolean {
  if (hasActiveSubscription(profile)) return true;
  return postedCount < FREE_JOB_POST_LIMIT;
}

export function getRemainingFreePosts(
  postedCount: number,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro' | 'pro_expires_at'>
): number {
  if (hasActiveSubscription(profile)) return Infinity;
  return Math.max(0, FREE_JOB_POST_LIMIT - postedCount);
}

export function isPostPaywallActive(
  postedCount: number,
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro' | 'pro_expires_at'>
): boolean {
  if (hasActiveSubscription(profile)) return false;
  return postedCount >= FREE_JOB_POST_LIMIT;
}
