import { useState } from 'react';
import { Users, ChevronDown, ChevronUp, CheckCircle } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StatusBadge, StarRating } from '@/components/ui/badge';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { ReviewModal } from '@/components/jobs/ReviewModal';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatPrice, formatRelativeTime, getInitials } from '@/lib/utils';
import type { Job } from '@/types';

function ClientJobsTab() {
  const { getMyClientJobs, getApplicationsForJob, getProfile, acceptWorker, completeJob, submitReview } = useAppStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [expandedJob, setExpandedJob] = useState<string | null>(null);
  const [reviewJob, setReviewJob] = useState<Job | null>(null);

  const jobs = getMyClientJobs();

  const handleAccept = async (jobId: string, workerId: string) => {
    await acceptWorker(jobId, workerId);
    toast({ title: t('workerAccepted'), description: t('workerAcceptedDesc'), variant: 'success' });
  };

  const handleComplete = async (job: Job) => {
    await completeJob(job.id);
    setReviewJob(job);
    toast({ title: t('jobCompleted'), description: t('jobCompletedDesc'), variant: 'success' });
  };

  const handleReview = async (rating: number, comment: string) => {
    if (!reviewJob?.selected_worker_id) return;
    await submitReview({
      job_id: reviewJob.id,
      target_id: reviewJob.selected_worker_id,
      rating,
      comment,
    });
    toast({ title: t('reviewSubmitted'), variant: 'success' });
    setReviewJob(null);
  };

  if (jobs.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{t('noPostedJobs')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {jobs.map((job) => {
          const apps = getApplicationsForJob(job.id);
          const pendingApps = apps.filter((a) => a.status === 'pending');
          const isExpanded = expandedJob === job.id;

          return (
            <Card key={job.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                    <p className="text-emerald-600 font-bold text-sm mt-0.5">{formatPrice(job.price)}</p>
                  </div>
                  <StatusBadge status={job.status} />
                </div>

                <div className="flex items-center gap-3 mt-3 text-xs text-gray-500">
                  <span className="flex items-center gap-1">
                    <Users className="h-3.5 w-3.5" />
                    {pendingApps.length}{' '}
                    {pendingApps.length === 1 ? t('applicantOne') : t('applicants')}
                  </span>
                  <span>{formatRelativeTime(job.created_at)}</span>
                </div>

                {job.status === 'open' && pendingApps.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full mt-2 text-indigo-600"
                    onClick={() => setExpandedJob(isExpanded ? null : job.id)}
                  >
                    {isExpanded ? t('hideApplications') : t('viewApplications')}
                    {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                  </Button>
                )}

                {isExpanded && (
                  <div className="mt-3 space-y-2 border-t border-gray-100 pt-3 animate-fade-in">
                    {pendingApps.map((app) => {
                      const worker = getProfile(app.worker_id);
                      if (!worker) return null;
                      return (
                        <div key={app.id} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50">
                          <Avatar className="h-10 w-10">
                            <AvatarFallback>{getInitials(worker.full_name)}</AvatarFallback>
                          </Avatar>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-gray-900 truncate">{worker.full_name}</p>
                            <StarRating rating={worker.rating} />
                          </div>
                          <Button size="sm" onClick={() => handleAccept(job.id, worker.id)}>
                            {t('accept')}
                          </Button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {job.status === 'in_progress' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => handleComplete(job)}
                  >
                    <CheckCircle className="h-4 w-4" /> {t('markCompleted')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReviewModal
        open={!!reviewJob}
        onClose={() => setReviewJob(null)}
        onSubmit={handleReview}
        targetName={
          reviewJob?.selected_worker_id
            ? getProfile(reviewJob.selected_worker_id)?.full_name ?? t('workerLabel')
            : t('workerLabel')
        }
      />
    </>
  );
}

function WorkerJobsTab() {
  const { getMyWorkerApplications, jobs, completeJob, submitReview, getProfile } = useAppStore();
  const { toast } = useToast();
  const { t } = useTranslation();
  const [reviewJob, setReviewJob] = useState<Job | null>(null);

  const myApps = getMyWorkerApplications();

  const handleComplete = async (job: Job) => {
    await completeJob(job.id);
    setReviewJob(job);
    toast({ title: t('jobCompleted'), description: t('jobCompletedDesc'), variant: 'success' });
  };

  const handleReview = async (rating: number, comment: string) => {
    if (!reviewJob) return;
    await submitReview({
      job_id: reviewJob.id,
      target_id: reviewJob.client_id,
      rating,
      comment,
    });
    toast({ title: t('reviewSubmitted'), variant: 'success' });
    setReviewJob(null);
  };

  if (myApps.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">{t('noApplications')}</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {myApps.map((app) => {
          const job = jobs.find((j) => j.id === app.job_id);
          if (!job) return null;
          const client = getProfile(job.client_id);

          return (
            <Card key={app.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-gray-900 truncate">{job.title}</h3>
                    <p className="text-emerald-600 font-bold text-sm mt-0.5">{formatPrice(job.price)}</p>
                    {client && (
                      <p className="text-xs text-gray-400 mt-1">
                        {t('clientLabel')}: {client.full_name}
                      </p>
                    )}
                  </div>
                  <StatusBadge status={app.status} />
                </div>

                {app.status === 'accepted' && job.status === 'in_progress' && (
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full mt-3"
                    onClick={() => handleComplete(job)}
                  >
                    <CheckCircle className="h-4 w-4" /> {t('markCompleted')}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ReviewModal
        open={!!reviewJob}
        onClose={() => setReviewJob(null)}
        onSubmit={handleReview}
        targetName={reviewJob ? getProfile(reviewJob.client_id)?.full_name ?? t('clientLabel') : t('clientLabel')}
      />
    </>
  );
}

export function MyJobsPage() {
  const activeMode = useAppStore((s) => s.activeMode);
  const { t } = useTranslation();

  return (
    <div className="animate-fade-in">
      <div className="mb-5">
        <h2 className="text-2xl font-bold text-gray-900">{t('myJobs')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('myJobsDesc')}</p>
      </div>

      <Tabs defaultValue={activeMode === 'client' ? 'client' : 'worker'}>
        <TabsList>
          <TabsTrigger value="client">{t('asClientFull')}</TabsTrigger>
          <TabsTrigger value="worker">{t('asWorkerFull')}</TabsTrigger>
        </TabsList>
        <TabsContent value="client">
          <ClientJobsTab />
        </TabsContent>
        <TabsContent value="worker">
          <WorkerJobsTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
