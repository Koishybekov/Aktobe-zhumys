import { openWhatsApp } from '@/lib/whatsapp';
import type { Job, Profile } from '@/types';

export function resolveJobContactPhone(job: Job, client?: Profile | null): string {
  return job.phone?.trim() || client?.phone?.trim() || '';
}

export function openJobWhatsAppContact(
  job: Job,
  client: Profile | null | undefined,
  messagePrefix: string
): boolean {
  const phone = resolveJobContactPhone(job, client);
  if (!phone) return false;

  const title = job.title?.trim() || '';
  const message = title ? `${messagePrefix} "${title}"` : messagePrefix;
  openWhatsApp(phone, message);
  return true;
}
