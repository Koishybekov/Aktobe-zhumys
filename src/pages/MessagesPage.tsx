import { useNavigate } from 'react-router-dom';
import { MessageCircle, ChevronRight } from 'lucide-react';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { ProBadge } from '@/components/profile/ProBadge';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import { getOtherParticipantId } from '@/lib/conversationsApi';

export function MessagesPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const getMyConversations = useAppStore((s) => s.getMyConversations);
  const getConversationMessages = useAppStore((s) => s.getConversationMessages);
  const jobs = useAppStore((s) => s.jobs);
  const getProfile = useAppStore((s) => s.getProfile);

  const userId = getActiveUserId();
  const conversations = getMyConversations();

  if (conversations.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
          <MessageCircle className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">{t('noConversations')}</h2>
        <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">{t('noConversationsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">{t('messages')}</h2>

      <div className="space-y-2">
        {conversations.map((conv) => {
          const job = jobs.find((j) => j.id === conv.job_id);
          const otherId = getOtherParticipantId(conv, userId);
          const otherUser = getProfile(otherId);
          const msgs = getConversationMessages(conv.id);
          const lastMsg = msgs[msgs.length - 1];

          return (
            <button
              key={conv.id}
              type="button"
              onClick={() => navigate(`/chat/${conv.id}`)}
              className="w-full flex items-center gap-3 p-4 rounded-2xl bg-white border border-gray-100 shadow-sm hover:border-indigo-200 transition-colors text-left"
            >
              <Avatar>
                <AvatarFallback>{getInitials(otherUser?.full_name ?? '?')}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <p className="font-semibold text-gray-900 truncate text-sm">
                    {job?.title ?? t('notSpecified')}
                  </p>
                  {job?.status && <StatusBadge status={job.status} />}
                </div>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs text-gray-500 truncate">
                    {otherUser?.full_name ?? t('userFallback')}
                  </span>
                  <ProBadge profile={otherUser} size="sm" />
                </div>
                {lastMsg && (
                  <p className="text-xs text-gray-400 truncate mt-1">{lastMsg.content}</p>
                )}
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                {lastMsg && (
                  <span className="text-[10px] text-gray-400">
                    {formatRelativeTime(lastMsg.created_at)}
                  </span>
                )}
                <ChevronRight className="h-4 w-4 text-gray-300" />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
