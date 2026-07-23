import { useState, useRef, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Send, MessageCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { StatusBadge } from '@/components/ui/badge';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { formatRelativeTime, getInitials } from '@/lib/utils';
import { cn } from '@/lib/utils';

export function MessagesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const { getActiveChatJobs, getJobMessages, sendMessage, getProfile } = useAppStore();
  const { t } = useTranslation();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const chatJobs = getActiveChatJobs();
  const selectedJobId = searchParams.get('job') ?? chatJobs[0]?.id ?? null;
  const selectedJob = chatJobs.find((j) => j.id === selectedJobId);
  const messages = selectedJobId ? getJobMessages(selectedJobId) : [];

  const userId = getActiveUserId();
  const otherUserId = selectedJob
    ? selectedJob.client_id === userId
      ? selectedJob.selected_worker_id
      : selectedJob.client_id
    : null;
  const otherUser = otherUserId ? getProfile(otherUserId) : null;

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = async () => {
    if (!message.trim() || !selectedJobId) return;
    setSending(true);
    await sendMessage(selectedJobId, message.trim());
    setMessage('');
    setSending(false);
  };

  if (chatJobs.length === 0) {
    return (
      <div className="animate-fade-in text-center py-20">
        <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 mb-4">
          <MessageCircle className="h-8 w-8 text-indigo-400" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">{t('noChats')}</h2>
        <p className="text-sm text-gray-400 mt-2 max-w-xs mx-auto">{t('noChatsDesc')}</p>
      </div>
    );
  }

  return (
    <div className="animate-fade-in flex flex-col h-[calc(100dvh-140px)] md:h-[calc(100dvh-100px)]">
      <h2 className="text-2xl font-bold text-gray-900 mb-4">{t('messages')}</h2>

      <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-3 -mx-1 px-1">
        {chatJobs.map((job) => (
          <button
            key={job.id}
            onClick={() => setSearchParams({ job: job.id })}
            className={cn(
              'shrink-0 rounded-xl px-4 py-2 text-sm font-medium border transition-colors',
              selectedJobId === job.id
                ? 'bg-indigo-600 text-white border-indigo-600'
                : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
            )}
          >
            {job.title.length > 25 ? job.title.slice(0, 25) + '…' : job.title}
          </button>
        ))}
      </div>

      {selectedJob && otherUser && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100 mb-3">
          <Avatar>
            <AvatarFallback>{getInitials(otherUser.full_name)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-gray-900 text-sm">{otherUser.full_name}</p>
            <p className="text-xs text-gray-400 truncate">{selectedJob.title}</p>
          </div>
          <StatusBadge status="in_progress" />
        </div>
      )}

      <div className="flex-1 overflow-y-auto space-y-3 pb-3">
        {messages.map((msg) => {
          const isMe = msg.sender_id === userId;
          return (
            <div key={msg.id} className={cn('flex', isMe ? 'justify-end' : 'justify-start')}>
              <div
                className={cn(
                  'max-w-[80%] rounded-2xl px-4 py-2.5 text-sm',
                  isMe
                    ? 'bg-emerald-600 text-white rounded-br-md'
                    : 'bg-white border border-gray-100 text-gray-800 rounded-bl-md shadow-sm'
                )}
              >
                <p>{msg.content}</p>
                <p className={cn('text-[10px] mt-1', isMe ? 'text-emerald-200' : 'text-gray-400')}>
                  {formatRelativeTime(msg.created_at)}
                </p>
              </div>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div className="flex gap-2 pt-3 border-t border-gray-100">
        <Input
          placeholder={t('typeMessage')}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSend()}
          className="flex-1"
        />
        <Button size="icon" onClick={handleSend} disabled={!message.trim() || sending}>
          <Send className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
