import { useCallback, useEffect, useState } from 'react';
import { Search, AlertCircle, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { JobCard } from '@/components/jobs/JobCard';
import { JobDetailsModal } from '@/components/jobs/JobDetailsModal';
import { CategoryFilter } from '@/components/jobs/CategoryFilter';
import { DistrictFilter } from '@/components/jobs/DistrictFilter';
import { JobCardSkeleton } from '@/components/ui/skeleton';
import { ProSubscriptionModal } from '@/components/profile/ProSubscription';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId, useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { hasActiveSubscription } from '@/lib/subscription';
import { isSupabaseConfigured } from '@/lib/supabase';
import {
  tryRecordJobView,
  getRemainingFreeViews,
  syncJobViewsFromProfile,
  canOpenJobDetails,
  FREE_JOB_VIEW_LIMIT,
} from '@/lib/jobViewLimit';
import type { Job } from '@/types';

export function ExplorePage() {
  const { t } = useTranslation();
  const jobsLoading = useAppStore((s) => s.jobsLoading);
  const jobsError = useAppStore((s) => s.jobsError);
  const allJobs = useAppStore((s) => s.jobs);
  const fetchJobs = useAppStore((s) => s.fetchJobs);
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
  const isPro = useAuthStore((s) => s.isPro);
  const refreshProfile = useAuthStore((s) => s.refreshProfile);

  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [paywallContext, setPaywallContext] = useState<'seeker' | 'apply'>('seeker');
  const [viewCount, setViewCount] = useState(0);

  const userId = getActiveUserId();
  const subscribed = hasActiveSubscription(currentUser);
  const remainingViews = subscribed ? Infinity : getRemainingFreeViews(userId, currentUser);

  /** Загрузка вакансий из Supabase при открытии страницы */
  useEffect(() => {
    void fetchJobs();
  }, [fetchJobs]);

  useEffect(() => {
    void refreshProfile();
  }, [refreshProfile]);

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

  const openPaywall = useCallback((context: 'seeker' | 'apply' = 'seeker') => {
    setPaywallContext(context);
    setSelectedJob(null);
    setPaywallOpen(true);
    toast({
      title: context === 'apply' ? t('paywallApplyTitle') : t('paywallBlocked'),
      variant: 'default',
    });
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
    [userId, currentUser, openPaywall, syncViewsToProfile]
  );

  const handleApply = async (job: Job) => {
    if (hasApplied(job.id)) return;

    if (!isPro) {
      openPaywall('apply');
      return;
    }

    try {
      await applyToJob(job.id);
      toast({ title: t('applicationSentToast'), description: t('applicationSentDesc'), variant: 'success' });
    } catch {
      toast({ title: t('error'), variant: 'error' });
    }
  };

  const resetFilters = () => {
    setSelectedCategory('all');
    setSelectedDistrict('all');
    setSearchQuery('');
  };

  const jobs = getOpenJobs();
  const supabaseReady = isSupabaseConfigured();

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

      {!supabaseReady && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div>
            <p className="font-semibold text-red-800">{t('jobsLoadError')}</p>
            <p className="text-sm text-red-600 mt-1">
              Supabase не подключён. Проверьте `.env`: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY
            </p>
          </div>
        </div>
      )}

      {jobsError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-red-800">{t('jobsLoadError')}</p>
            <p className="text-sm text-red-600 mt-1 break-words">{jobsError}</p>
            <Button variant="outline" size="sm" className="mt-3" onClick={() => void fetchJobs()}>
              <RefreshCw className="h-4 w-4" />
              {t('jobsRetry')}
            </Button>
          </div>
        </div>
      )}

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
        {jobsLoading ? (
          Array.from({ length: 4 }).map((_, i) => <JobCardSkeleton key={i} />)
        ) : jobsError ? null : jobs.length === 0 && allJobs.length === 0 ? (
          <div className="text-center py-16 rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <p className="text-gray-500 text-lg">{t('jobsEmptyDb')}</p>
            <p className="text-sm text-gray-400 mt-1">{t('noJobs')}</p>
            <Button variant="outline" size="sm" className="mt-4" onClick={() => void fetchJobs()}>
              <RefreshCw className="h-4 w-4" />
              {t('jobsRetry')}
            </Button>
          </div>
        ) : jobs.length === 0 && allJobs.length > 0 ? (
          <div className="text-center py-16 rounded-xl border border-amber-200 bg-amber-50">
            <p className="text-amber-900 font-medium">
              {t('jobsFilteredOut').replace('{count}', String(allJobs.length))}
            </p>
            <Button variant="outline" size="sm" className="mt-4" onClick={resetFilters}>
              {t('tryFilters')}
            </Button>
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
        paywallContext={paywallContext}
      />
    </div>
  );
}
