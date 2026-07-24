import type { Profile } from '@/types';
import { DEFAULT_CITY } from '@/lib/constants';
import { generateId } from '@/lib/utils';
import { normalizePhone } from '@/lib/authPhone';
import { createEmptyProfile } from '@/lib/authStorage';

const MOCK_USERS_KEY = 'aktobe_mock_users';

export interface MockUserRecord {
  id: string;
  phone: string;
  password: string;
  profile: Profile;
}

function loadMockUsers(): MockUserRecord[] {
  try {
    const raw = localStorage.getItem(MOCK_USERS_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as MockUserRecord[];
  } catch {
    return [];
  }
}

function saveMockUsers(users: MockUserRecord[]): void {
  localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
}

export function findMockUserByPhone(phone: string): MockUserRecord | undefined {
  const normalized = normalizePhone(phone);
  return loadMockUsers().find((u) => u.phone === normalized);
}

export function registerMockUser(phone: string, password: string, fullName = ''): MockUserRecord {
  const normalized = normalizePhone(phone);
  const users = loadMockUsers();
  if (users.some((u) => u.phone === normalized)) {
    throw new Error('USER_EXISTS');
  }

  const id = generateId();
  const profile = createEmptyProfile(id, normalized, 'both');
  profile.full_name = fullName.trim();
  profile.city = DEFAULT_CITY;

  const record: MockUserRecord = { id, phone: normalized, password, profile };
  users.push(record);
  saveMockUsers(users);
  return record;
}

export function verifyMockLogin(phone: string, password: string): MockUserRecord | null {
  const user = findMockUserByPhone(phone);
  if (!user || user.password !== password) return null;
  return user;
}

export function updateMockUserProfile(userId: string, profile: Profile): void {
  const users = loadMockUsers();
  const idx = users.findIndex((u) => u.id === userId);
  if (idx === -1) return;
  users[idx] = { ...users[idx], profile };
  saveMockUsers(users);
}

export function updateMockUserProfileByPhone(phone: string, updates: Partial<Profile>): Profile | null {
  const normalized = normalizePhone(phone);
  const users = loadMockUsers();
  const idx = users.findIndex((u) => u.phone === normalized);
  if (idx === -1) return null;
  const profile = { ...users[idx].profile, ...updates };
  users[idx] = { ...users[idx], profile };
  saveMockUsers(users);
  return profile;
}
