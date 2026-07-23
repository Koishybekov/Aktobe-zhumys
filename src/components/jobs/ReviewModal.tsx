import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { InteractiveStarRating } from '@/components/ui/badge';
import { useState } from 'react';
import { useTranslation } from '@/lib/i18n/useTranslation';

interface ReviewModalProps {
  open: boolean;
  onClose: () => void;
  onSubmit: (rating: number, comment: string) => void;
  targetName: string;
}

export function ReviewModal({ open, onClose, onSubmit, targetName }: ReviewModalProps) {
  const { t } = useTranslation();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async () => {
    if (rating < 1) return;
    setSubmitting(true);
    await onSubmit(rating, comment);
    setSubmitting(false);
    setRating(5);
    setComment('');
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>
            {t('reviewTitle')} {targetName}
          </DialogTitle>
          <DialogDescription>{t('reviewDesc')}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-4">
          <InteractiveStarRating value={rating} onChange={setRating} />
          <Textarea
            placeholder={t('reviewCommentPlaceholder')}
            value={comment}
            onChange={(e) => setComment(e.target.value)}
            className="w-full"
          />
        </div>

        <Button onClick={handleSubmit} disabled={submitting || rating < 1} className="w-full">
          {t('submitReview')}
        </Button>
      </DialogContent>
    </Dialog>
  );
}
