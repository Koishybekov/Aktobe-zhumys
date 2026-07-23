import { useState } from 'react';
import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { JobCard } from '@/components/jobs/JobCard';
import { JobDetailsModal } from '@/components/jobs/JobDetailsModal';
import { CategoryFilter } from '@/components/jobs/CategoryFilter';
import { DistrictFilter } from '@/components/jobs/DistrictFilter';
import { JobCardSkeleton } from '@/components/ui/skeleton';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { Job } from '@/types';

export function ExplorePage() {
  const { t } = useTranslation();
  const initialized = useAppStore((s) => s.initialized);
  const isLoading = useAppStore((s) => s.isLoading);
  const selectedCategory = useAppStore((s) => s.selectedCategory);
  const selectedDistrict = useAppStore((s) => s.selectedDistrict);
  const searchQuery = useAppStore((s) => s.searchQuery);
  const setSelectedCategory = useAppStore((s) => s.setSelectedCategory);
  const setSelectedDistrict = useAppStore((s) => s.setSelectedDistrict);
  const setSearchQuery = useAppStore((s) => s.setSearchQuery);
  const applyToJob = useAppStore((s) => s.applyToJob);
  const hasApplied = useAppStore((s) => s.hasApplied);
  const getProfile = useAppStore((s) => s.getProfile);
  const getOpenJobs = useAppStore((s) => s.getOpenJobs);

  const { toast } = useToast();
  const [selectedJob, setSelectedJob] = useState<Job | null>(null);

  const jobs = getOpenJobs();

  const handleApply = async (job: Job) => {
    if (hasApplied(job.id)) return;
    try {
      await applyToJob(job.id);
      toast({ title: t('applicationSentToast'), description: t('applicationSentDesc'), variant: 'success' });
    } catch {
      toast({ title: t('error'), variant: 'error' });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">{t('findWork')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('findWorkDesc')}</p>
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
              onSelect={setSelectedJob}
              onApply={handleApply}
              hasApplied={hasApplied(job.id)}
            />
          ))
        )}
      </div>

      <JobDetailsModal
        job={selectedJob}
        client={selectedJob ? getProfile(selectedJob.client_id) : undefined}
        open={!!selectedJob}
        onClose={() => setSelectedJob(null)}
        onApply={selectedJob ? () => handleApply(selectedJob) : undefined}
        hasApplied={selectedJob ? hasApplied(selectedJob.id) : false}
      />
    </div>
  );
}
