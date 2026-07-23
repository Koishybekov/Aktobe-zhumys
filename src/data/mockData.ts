import type { Profile } from '@/types';
import { CURRENT_USER_ID, DEFAULT_CITY } from '@/lib/constants';

/** Fallback profiles for local dev when Supabase auth mock is active — no jobs. */
export const mockProfiles: Profile[] = [
  {
    id: CURRENT_USER_ID,
    phone: '+77071234567',
    full_name: 'Айдар Нұрланов',
    avatar_url: null,
    role: 'both',
    rating: 4.8,
    city: DEFAULT_CITY,
    district: 'Батыс-2',
  },
  {
    id: 'user-002',
    phone: '+77012345678',
    full_name: 'Марина Ким',
    avatar_url: null,
    role: 'client',
    rating: 4.9,
    city: DEFAULT_CITY,
    district: 'Нұр Ақтөбе',
  },
];

export function getProfileById(id: string): Profile | undefined {
  return mockProfiles.find((p) => p.id === id);
}
