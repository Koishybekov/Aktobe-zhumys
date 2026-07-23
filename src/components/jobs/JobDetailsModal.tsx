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
import { formatPrice, formatRelativeTime, getInitials } from '@/lib/utils';
import { openWhatsApp } from '@/lib/whatsapp';
import { useTranslation } from '@/lib/i18n/useTranslation';
import type { Job, Profile } from '@/types';

interface JobDetailsModalProps {
  job: Job | null;
  client?: Profile;
  open: boolean;
  onClose: () => void;
  onApply?: () => void;
  hasApplied?: boolean;
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

  const handleWhatsApp = () => {
    if (!client?.phone) return;
    const message = `${t('whatsappMessage')} "${job.title}"`;
    openWhatsApp(client.phone, message);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden">
        <div className="p-6 pb-4">
          <DialogHeader>
            <div className="flex items-start gap-2 mb-2">
              <Badge category={job.category}>{category(job.category)}</Badge>
              <span className="text-xs text-gray-400 ml-auto">{job.city}{job.district ? ` · ${job.district}` : ''}</span>
            </div>
            <DialogTitle className="text-xl text-left">{job.title}</DialogTitle>
            <DialogDescription className="text-left text-emerald-600 font-bold text-2xl mt-1">
              {formatPrice(job.price)}
            </DialogDescription>
          </DialogHeader>

          <div className="mt-4 space-y-3">
            <p className="text-sm text-gray-600 leading-relaxed">{job.description}</p>

            <div className="flex items-center gap-2 text-sm text-gray-500">
              <MapPin className="h-4 w-4 shrink-0 text-emerald-500" />
              {job.location_address}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Clock className="h-4 w-4 shrink-0 text-emerald-500" />
              {t('posted')} {formatRelativeTime(job.created_at)}
            </div>

            {client && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 mt-2">
                <Avatar>
                  {client.avatar_url ? (
                    <AvatarImage src={client.avatar_url} alt={client.full_name} />
                  ) : (
                    <AvatarFallback>{getInitials(client.full_name)}</AvatarFallback>
                  )}
                </Avatar>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <User className="h-3.5 w-3.5 text-gray-400" />
                    <span className="text-sm font-medium text-gray-900 truncate">{client.full_name}</span>
                  </div>
                  <StarRating rating={client.rating} />
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="p-4 border-t border-gray-100 bg-gray-50 space-y-2">
          {client?.phone && (
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
              onClick={onApply}
            >
              {hasApplied ? t('applicationSent') : t('applyForJob')}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
