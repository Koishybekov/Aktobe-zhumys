import type { Conversation, Message } from '@/types';

export function getConversationParticipantIds(conversation: Conversation): [string, string] {
  return [conversation.worker_id, conversation.client_id];
}

export function getOtherParticipantId(conversation: Conversation, userId: string): string {
  return conversation.worker_id === userId ? conversation.client_id : conversation.worker_id;
}

export function findConversationForJobAndWorker(
  conversations: Conversation[],
  jobId: string,
  workerId: string
): Conversation | undefined {
  return conversations.find((c) => c.job_id === jobId && c.worker_id === workerId);
}

export function sortConversationsByRecent(
  conversations: Conversation[],
  messages: Message[]
): Conversation[] {
  const lastMessageAt = new Map<string, number>();
  for (const msg of messages) {
    const ts = new Date(msg.created_at).getTime();
    const prev = lastMessageAt.get(msg.conversation_id) ?? 0;
    if (ts > prev) lastMessageAt.set(msg.conversation_id, ts);
  }

  return [...conversations].sort((a, b) => {
    const aTs = lastMessageAt.get(a.id) ?? new Date(a.created_at).getTime();
    const bTs = lastMessageAt.get(b.id) ?? new Date(b.created_at).getTime();
    return bTs - aTs;
  });
}

export function buildApplyIntroMessage(jobTitle: string, template: string): string {
  return template.replace('{title}', jobTitle);
}
