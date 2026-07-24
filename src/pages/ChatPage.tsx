import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { ProBadge } from '@/components/profile/ProBadge';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import { getOtherParticipantId } from '@/lib/conversationsApi';
import { cn } from '@/lib/utils';

export function ChatPage() {
  const { conversationId } = useParams<{ conversationId: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  const conversations = useAppStore((s) => s.conversations);
  const jobs = useAppStore((s) => s.jobs);
  const getConversationMessages = useAppStore((s) => s.getConversationMessages);
  const sendConversationMessage = useAppStore((s) => s.sendConversationMessage);
  const getProfile = useAppStore((s) => s.getProfile);

  const userId = getActiveUserId();
  const conversation = conversations.find((c) => c.id === conversationId);
  const job = conversation ? jobs.find((j) => j.id === conversation.job_id) : undefined;
  const messages = conversationId ? getConversationMessages(conversationId) : [];

  const otherUserId = conversation ? getOtherParticipantId(conversation, userId) : null;
  const otherUser = otherUserId ? getProfile(otherUserId) : null;

  useEffect(() => {
    if (!conversationId) {
      navigate('/messages', { replace: true });
    }
  }, [conversationId, navigate]);

  const handleSend = async () => {
    if (!message.trim() || !conversationId) return;
    setSending(true);
    try {
      await sendConversationMessage(conversationId, message.trim());
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  if (!conversation) {
    return (
      <div className="animate-fade-in text-center py-20">
        <p className="text-gray-500">{t('chatNotFound')}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate('/messages')}>
          {t('back')}
        </Button>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100dvh-140px)] md:h-[calc(100dvh-100px)]">
      <div className="flex items-center gap-3 mb-4">
        <button
          type="button"
          onClick={() => navigate('/messages')}
          className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100"
        >
          <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div className="flex-1 min-w-0">
          <h2 className="font-bold text-gray-900 truncate">{job?.title ?? t('messages')}</h2>
          {otherUser && (
            <p className="text-xs text-gray-500 truncate">{otherUser.full_name || t('userFallback')}</p>
          )}
        </div>
        {job?.status && <StatusBadge status={job.status} />}
      </div>

      {otherUser && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 mb-3">
          <Avatar>
            <AvatarFallback>{getInitials(otherUser.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="font-medium text-gray-900 text-sm">{otherUser.full_name || t('userFallback')}</p>
              <ProBadge profile={otherUser} size="sm" />
            </div>
            <p className="text-xs text-gray-400 truncate">{job?.title}</p>
          </div>
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          const isSystem = msg.is_system;
          return (
            <div
              key={msg.id}
              className={cn('flex', isSystem ? 'justify-center' : isMe ? 'justify-end' : 'justify-start')}
            >
              <div
                className={cn(
                  'max-w-[85%] rounded-2xl px-4 py-2.5 text-sm',
                  isSystem
                    ? 'bg-gray-100 text-gray-500 text-xs italic text-center'
                    : isMe
                      ? 'bg-emerald-600 text-white rounded-br-md'
                      : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                )}
              >
                <p>{msg.content}</p>
                {!isSystem && (
                  <p className={cn('text-[10px] mt-1', isMe ? 'text-emerald-200' : 'text-gray-400')}>
                    {formatRelativeTime(msg.created_at)}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Input
          placeholder={t('typeMessage')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && void handleSend()}
          className="flex-1"
        />
        <Button size="icon" onClick={() => void handleSend()} disabled={!message.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
