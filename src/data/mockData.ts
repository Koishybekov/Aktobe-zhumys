import type { Profile } from '@/types';

/** Minimal fallback when auth profile is unavailable — no test jobs or users. */
export const mockProfiles: Profile[] = [];

export function getProfileById(_id: string): Profile | undefined {
  return undefined;
}
