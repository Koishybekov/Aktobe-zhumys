import type { Session } from '@supabase/supabase-js';
import { normalizePhone } from '@/lib/authPhone';

const PHONE_SESSIONS_KEY = 'aktobe_phone_sessions';

interface StoredPhoneSession {
  userId: string;
  access_token: string;
  refresh_token: string;
  expires_at?: number;
}

type PhoneSessionMap = Record<string, StoredPhoneSession>;

function loadMap(): PhoneSessionMap {
  try {
    const raw = localStorage.getItem(PHONE_SESSIONS_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PhoneSessionMap;
  } catch {
    return {};
  }
}

function saveMap(map: PhoneSessionMap): void {
  localStorage.setItem(PHONE_SESSIONS_KEY, JSON.stringify(map));
}

export function savePhoneSession(phone: string, session: Session): void {
  const key = normalizePhone(phone);
  const map = loadMap();
  map[key] = {
    userId: session.user.id,
    access_token: session.access_token,
    refresh_token: session.refresh_token,
    expires_at: session.expires_at,
  };
  saveMap(map);
}

export function loadPhoneSession(phone: string): StoredPhoneSession | null {
  const key = normalizePhone(phone);
  return loadMap()[key] ?? null;
}

export function clearPhoneSession(phone: string): void {
  const key = normalizePhone(phone);
  const map = loadMap();
  delete map[key];
  saveMap(map);
}
