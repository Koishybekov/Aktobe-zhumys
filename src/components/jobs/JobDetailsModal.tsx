import { MapPin, Clock, User, MessageCircle } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge, StarRating } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { formatPrice, formatRelativeTime, getInitials, getJobSalary } from '@/lib/utils';
import { resolveJobContactPhone, openJobWhatsAppContact } from '@/lib/jobContact';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { ProBadge } from '@/components/profile/ProBadge';
import type { Job, Profile } from '@/types';

type JobWithProfiles = Job & {
  profiles?: Profile | Profile[] | null;
};

interface JobDetailsModalProps {
  job: Job | null;
  client?: Profile | null;
  open: boolean;
  onClose: () => void;
  onApply?: () => void | Promise<void>;
  hasApplied?: boolean;
}

function resolveNestedProfile(job: JobWithProfiles, client?: Profile | null): Profile | null {
  if (client?.id || client?.full_name || client?.phone) return client;

  const nested = job.profiles;
  if (Array.isArray(nested)) return nested[0] ?? null;
  if (nested && typeof nested === 'object') return nested;

  return null;
}

function safeRelativeTime(dateString: string | undefined | null, fallback: string): string {
  if (!dateString) return fallback;
  try {
    return formatRelativeTime(dateString);
  } catch {
    return fallback;
  }
}

export function JobDetailsModal({
  job,
  client,
  open,
  onClose,
  onApply,
  hasApplied = false,
}: JobDetailsModalProps) {
  const { t, category } = useTranslation();

  if (!job) return null;

  const jobRecord = job as JobWithProfiles;
  const profile = resolveNestedProfile(jobRecord, client ?? null);

  const title = job.title?.trim() || t('notSpecified');
  const description = job.description?.trim() || t('notSpecified');
  const company = job.company?.trim() || '';
  const city = job.city?.trim() || t('notSpecified');
  const district = job.district?.trim() || '';
  const locationLabel = district ? `${city} · ${district}` : city;
  const jobCategory = job.category?.trim() || '';
  const categoryLabel = jobCategory ? category(jobCategory) : t('notSpecified');

  const contactPhone = resolveJobContactPhone(job, profile);
  const clientName = profile?.full_name?.trim() || t('userFallback');
  const clientRating = typeof profile?.rating === 'number' ? profile.rating : Number(profile?.rating) || 0;

  const handleWhatsApp = () => {
    openJobWhatsAppContact(job, profile, t('whatsappMessage'));
  };

  const handleApplyClick = () => {
    void onApply?.();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader>
            <div className="flex items-start gap-2 mb-2">
              <Badge category={jobCategory || undefined}>{categoryLabel}</Badge>
              <span className="text-xs text-gray-400 ml-auto">{locationLabel}</span>
            </div>
            <DialogTitle className="text-xl text-left">{title}</DialogTitle>
            {company && <p className="text-sm text-gray-500 text-left mt-0.5">{company}</p>}
            <DialogDescription className="text-left text-emerald-600 font-bold text-2xl mt-1">
              {formatPrice(getJobSalary(job))}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">{description}</p>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
              {locationLabel}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MessageCircle className="h-4 w-4 shrink-0 text-emerald-500" />
              {contactPhone || t('notSpecified')}
            </div>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4 shrink-0 text-emerald-500" />
              {t('posted')} {safeRelativeTime(job.created_at, t('notSpecified'))}
            </div>

            {profile && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mt-2">
                <Avatar>
                  {profile.avatar_url ? (
                    <AvatarImage src={profile.avatar_url} alt={clientName} />
                  ) : (
                    <AvatarFallback>{getInitials(clientName)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 truncate">{clientName}</span>
                    <ProBadge profile={profile} size="sm" />
                  </div>
                  <StarRating rating={clientRating} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
          {contactPhone && (
            <Button
              className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white"
              size="lg"
              onClick={handleWhatsApp}
            >
              <MessageCircle className="h-5 w-5" />
              {t('whatsappContact')}
            </Button>
          )}

          {onApply && (
            <Button
              className="w-full"
              size="lg"
              variant={hasApplied ? 'secondary' : 'default'}
              disabled={hasApplied}
              onClick={handleApplyClick}
            >
              {hasApplied ? t('applicationSent') : t('applyForJob')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
