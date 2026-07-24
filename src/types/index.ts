export type UserRole = 'client' | 'worker' | 'both';
export type JobStatus = 'open' | 'in_progress' | 'completed' | 'cancelled';
export type ApplicationStatus = 'pending' | 'accepted' | 'rejected';
export type AuthStep = 'language' | 'role' | 'profile' | 'terms' | 'otp' | 'complete';

export interface Profile {
  id: string;
  phone: string;
  full_name: string;
  avatar_url: string | null;
  role: UserRole;
  rating: number;
  city?: string;
  district?: string;
  skills?: string[];
  offer_accepted_at?: string | null;
  onboarding_completed?: boolean;
  is_pro?: boolean;
  pro_since?: string | null;
  pro_expires_at?: string | null;
  is_subscribed?: boolean;
  subscribed_until?: string | null;
  password_hash?: string;
  viewed_job_ids?: string[];
}

export interface Job {
  id: string;
  client_id: string;
  user_id?: string;
  title: string;
  company?: string;
  description: string;
  category: string;
  salary?: number;
  /** @deprecated use salary */
  price?: number;
  phone?: string;
  location_address?: string;
  city: string;
  district?: string;
  status: JobStatus;
  selected_worker_id: string | null;
  created_at: string;
}

export interface CreateJobInput {
  title: string;
  company: string;
  city: string;
  salary: number;
  description: string;
  phone: string;
  category: string;
}

export interface JobApplication {
  id: string;
  job_id: string;
  worker_id: string;
  status: ApplicationStatus;
  created_at: string;
}

export interface Review {
  id: string;
  job_id: string;
  reviewer_id: string;
  target_id: string;
  rating: number;
  comment: string;
  created_at?: string;
}

export interface Conversation {
  id: string;
  job_id: string;
  worker_id: string;
  client_id: string;
  created_at: string;
  updated_at?: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  content: string;
  is_system?: boolean;
  created_at: string;
}

/** @deprecated Legacy job-scoped chat — use Conversation + Message */
export interface ChatMessage {
  id: string;
  job_id: string;
  sender_id: string;
  content: string;
  created_at: string;
}

export interface JobWithClient extends Job {
  client?: Profile;
  application_count?: number;
}

export interface ApplicationWithWorker extends JobApplication {
  worker?: Profile;
}

export interface JobWithApplications extends Job {
  applications?: ApplicationWithWorker[];
}

export type ActiveMode = 'client' | 'worker';

export interface ReviewInput {
  job_id: string;
  target_id: string;
  rating: number;
  comment: string;
}

export interface ProfileSetupInput {
  full_name: string;
  avatar_url: string | null;
  city: string;
  district: string;
  skills: string[];
}

export interface AuthSession {
  userId: string;
  phone: string;
  role: UserRole;
  isAuthenticated: boolean;
  offerAcceptedAt: string | null;
  onboardingCompleted: boolean;
  profile: Profile | null;
}
