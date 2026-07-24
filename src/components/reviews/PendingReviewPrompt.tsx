import { useEffect, useState } from 'react';
import { ReviewModal } from '@/components/jobs/ReviewModal';
import { useAppStore } from '@/store/useAppStore';
import type { Job } from '@/types';

export function PendingReviewPrompt() {
  const getPendingReviewJobs = useAppStore((s) => s.getPendingReviewJobs);
  const getReviewTargetForJob = useAppStore((s) => s.getReviewTargetForJob);
  const submitReview = useAppStore((s) => s.submitReview);
  const getProfile = useAppStore((s) => s.getProfile);
  const hasUserReviewedJob = useAppStore((s) => s.hasUserReviewedJob);

  const pendingJobs = getPendingReviewJobs();
  const [reviewJob, setReviewJob] = useState<Job | null>(null);
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    const next = pendingJobs.find((j) => !dismissedIds.has(j.id) && !hasUserReviewedJob(j.id));
    setReviewJob(next ?? null);
  }, [pendingJobs, dismissedIds, hasUserReviewedJob]);

  const target = reviewJob ? getReviewTargetForJob(reviewJob) : null;

  const handleSubmit = async (rating: number, comment: string) => {
    if (!reviewJob || !target) return;
    await submitReview({
      job_id: reviewJob.id,
      target_id: target.targetId,
      rating,
      comment,
    });
    setReviewJob(null);
  };

  const handleClose = () => {
    if (reviewJob) {
      setDismissedIds((prev) => new Set(prev).add(reviewJob.id));
    }
    setReviewJob(null);
  };

  if (!reviewJob || !target) return null;

  return (
    <ReviewModal
      open
      onClose={handleClose}
      onSubmit={handleSubmit}
      targetName={getProfile(target.targetId)?.full_name ?? target.targetName}
    />
  );
}
