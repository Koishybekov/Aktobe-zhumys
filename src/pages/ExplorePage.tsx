import { useCallback, useEffect, useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { JobCard } from '@/components/jobs/JobCard';
import { JobDetailsModal } from '@/components/jobs/JobDetailsModal';
import { CategoryFilter } from '@/components/jobs/CategoryFilter';
import { DistrictFilter } from '@/components/jobs/DistrictFilter';
import { JobCardSkeleton } from '@/components/ui/skeleton';
import { ProSubscriptionModal } from '@/components/profile/ProSubscription';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { hasActiveSubscription } from '@/lib/subscription';
import {
  tryRecordJobView,
  getRemainingFreeViews,
  syncJobViewsFromProfile,
  isPaywallActive,
  canOpenJobDetails,
  FREE_JOB_VIEW_LIMIT,
} from '@/lib/jobViewLimit';
import type { Job } from '@/types';

export function ExplorePage() {
  const { t } = useTranslation();
  const initialized = useAppStore((s) => s.initialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const currentUser = useAppStore((s) => s.currentUser);
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const selectedDistrict = useAppStore((s) => s.selectedDistrict);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelectedCategory = useAppStore((s) => s.setSelectedCategory);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const applyToJob = useAppStore((s) => s.applyToJob);
  const updateProfile = useAppStore((s) => s.updateProfile);
  const hasApplied = useAppStore((s) => s.hasApplied);
  const getProfile = useAppStore((s) => s.getProfile);
  const getOpenJobs = useAppStore((s) => s.getOpenJobs);

  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [viewCount, setViewCount] = useState(0);

  const userId = getActiveUserId();
  const subscribed = hasActiveSubscription(currentUser);
  const remainingViews = subscribed ? Infinity : getRemainingFreeViews(userId, currentUser);

  useEffect(() => {
    const state = syncJobViewsFromProfile(userId, currentUser.viewed_job_ids);
    setViewCount(state.viewedJobIds.length);
  }, [userId, currentUser.viewed_job_ids]);

  const syncViewsToProfile = useCallback(
    async (viewedIds: string[]) => {
      try {
        await updateProfile({ viewed_job_ids: viewedIds.slice(0, FREE_JOB_VIEW_LIMIT) });
      } catch {
        /* localStorage remains source of truth */
      }
    },
    [updateProfile]
  );

  const openPaywall = useCallback(() => {
    setSelectedJob(null);
    setPaywallOpen(true);
    toast({ title: t('paywallBlocked'), variant: 'default' });
  }, [toast, t]);

  const handleJobSelect = useCallback(
    (job: Job) => {
      if (!canOpenJobDetails(userId, job.id, currentUser)) {
        openPaywall();
        return;
      }

      const result = tryRecordJobView(userId, job.id, currentUser);
      if (!result.allowed) {
        openPaywall();
        return;
      }

      setViewCount(result.state.viewedJobIds.length);
      void syncViewsToProfile(result.state.viewedJobIds);
      setSelectedJob(job);
    },
    [userId, currentUser, subscribed, openPaywall, syncViewsToProfile]
  );

  const handleApply = async (job: Job) => {
    if (!subscribed && isPaywallActive(userId, currentUser) && !canOpenJobDetails(userId, job.id, currentUser)) {
      openPaywall();
      return;
    }
    if (hasApplied(job.id)) return;
    try {
      await applyToJob(job.id);
      toast({ title: t('applicationSentToast'), description: t('applicationSentDesc'), variant: 'success' });
    } catch {
      toast({ title: t('error'), variant: 'error' });
    }
  };

  const jobs = getOpenJobs();

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('findWork')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('findWorkDesc')}</p>
        {!subscribed && (
          <p className="text-xs text-amber-600 font-medium mt-1">
            {remainingViews > 0
              ? t('paywallRemaining').replace('{count}', String(remainingViews))
              : t('paywallBlocked')}
            {viewCount > 0 && ` · ${t('paywallUsed').replace('{count}', String(viewCount))}`}
          </p>
        )}
      </div>

      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder={t('searchJobs')}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      <DistrictFilter selected={selectedDistrict} onChange={setSelectedDistrict} />
      <CategoryFilter selected={selectedCategory} onChange={setSelectedCategory} />

      <div className="space-y-3">
        {isLoading || !initialized ? (
          Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)
        ) : jobs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 text-lg">{t('noJobs')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('tryFilters')}</p>
          </div>
        ) : (
          jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onSelect={handleJobSelect}
              onApply={handleApply}
              hasApplied={hasApplied(job.id)}
            />
          ))
        )}
      </div>

      <JobDetailsModal
        job={selectedJob}
        client={selectedJob ? getProfile(selectedJob.client_id) : undefined}
        open={!!selectedJob && !paywallOpen}
        onClose={() => setSelectedJob(null)}
        onApply={selectedJob ? () => handleApply(selectedJob) : undefined}
        hasApplied={selectedJob ? hasApplied(selectedJob.id) : false}
      />

      <ProSubscriptionModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        userPhone={currentUser.phone}
        paywall
      />
    </div>
  );
}
