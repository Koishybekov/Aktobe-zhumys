import { MapPin, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { formatPrice, formatRelativeTime, getJobSalary } from '@/lib/utils';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { Job } from '@/types';

interface JobCardProps {
  job: Job;
  onSelect: (job: Job) => void;
  onApply?: (job: Job) => void;
  showApply?: boolean;
  hasApplied?: boolean;
}

export function JobCard({ job, onSelect, onApply, showApply = true, hasApplied = false }: JobCardProps) {
  const { t, category } = useTranslation();

  const title = job?.title?.trim() || t('notSpecified');
  const jobCategory = job?.category?.trim() || '';
  const categoryLabel = jobCategory ? category(jobCategory) : t('notSpecified');
  const city = job?.city?.trim() || t('notSpecified');
  const district = job?.district?.trim() || '';
  const createdAt = job?.created_at;

  return (
    <article
      className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm hover:shadow-md transition-all cursor-pointer animate-fade-in active:scale-[0.99]"
      onClick={() => job && onSelect(job)}
    >
      <div className="flex items-start justify-between gap-3 mb-1">
        <h3 className="font-semibold text-gray-900 text-[15px] leading-snug flex-1">{title}</h3>
        <Badge category={jobCategory || undefined}>{categoryLabel}</Badge>
      </div>
      {job?.company?.trim() && <p className="text-sm text-gray-500 mb-1">{job.company}</p>}

      <p className="text-emerald-600 font-bold text-lg mb-3">{formatPrice(getJobSalary(job))}</p>

      <div className="flex flex-col gap-1.5 text-sm text-gray-500 mb-4">
        <div className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">
            {city}
            {district ? ` · ${district}` : ''}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0" />
          <span>
            {createdAt
              ? (() => {
                  try {
                    return formatRelativeTime(createdAt);
                  } catch {
                    return t('notSpecified');
                  }
                })()
              : t('notSpecified')}
          </span>
        </div>
      </div>

      {showApply && onApply && (
        <Button
          className="w-full"
          variant={hasApplied ? 'secondary' : 'default'}
          disabled={hasApplied}
          onClick={(e) => {
            e.stopPropagation();
            onApply(job);
          }}
        >
          {hasApplied ? t('applied') : t('apply')}
        </Button>
      )}
    </article>
  );
}
