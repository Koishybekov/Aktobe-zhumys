import { useNavigate } from 'react-router-dom';
import { useMemo, useState } from 'react';
import {
  Briefcase,
  Phone,
  Star,
  ToggleLeft,
  ToggleRight,
  MapPin,
  LogOut,
  FileText,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StarRating, StatusBadge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { formatPrice, getInitials, getJobSalary } from '@/lib/utils';
import { CATEGORY_COLORS } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { ProSubscriptionCard, ProSubscriptionModal } from '@/components/profile/ProSubscription';
import { AdminLink } from '@/pages/AdminPage';
import { ProBadge } from '@/components/profile/ProBadge';
import {
  formatOfferDate,
  formatProfileRating,
  hasDisplayProfile,
  resolveDisplayProfile,
} from '@/lib/profileUtils';

export function ProfilePage() {
  const navigate = useNavigate();
  const {
    currentUser,
    activeMode,
    setActiveMode,
    getMyClientJobs,
    getMyWorkerApplications,
    jobs,
    reviews,
    isLoading,
    syncUserFromAuth,
    getProfile,
  } = useAppStore();
  const authProfile = useAuthStore((s) => s.profile);
  const isAuthHydrating = useAuthStore((s) => s.isHydrating);
  const logout = useAuthStore((s) => s.logout);
  const offerAcceptedAt = useAuthStore((s) => s.offerAcceptedAt);
  const { t, category, locale } = useTranslation();
  const { toast } = useToast();
  const [proModalOpen, setProModalOpen] = useState(false);

  const profile = useMemo(
    () => resolveDisplayProfile(authProfile, currentUser),
    [authProfile, currentUser]
  );

  const userId = getActiveUserId() || profile.id;
  const skills = profile.skills ?? [];
  const displayName = profile.full_name || t('userFallback');
  const displayPhone = profile.phone || '—';

  const clientJobs = useMemo(() => {
    try {
      return getMyClientJobs();
    } catch {
      return [];
    }
  }, [getMyClientJobs]);

  const workerApps = useMemo(() => {
    try {
      return getMyWorkerApplications();
    } catch {
      return [];
    }
  }, [getMyWorkerApplications]);

  const completedAsClient = clientJobs.filter((j) => j?.status === 'completed').length;
  const completedAsWorker = workerApps.filter((a) => {
    const job = jobs.find((j) => j.id === a?.job_id);
    return job?.status === 'completed';
  }).length;

  const myReviews = (reviews ?? []).filter((r) => r?.target_id === userId);
  const averageRating = useMemo(() => {
    if (myReviews.length === 0) return profile.rating ?? 0;
    const sum = myReviews.reduce((acc, r) => acc + (r.rating ?? 0), 0);
    return Math.round((sum / myReviews.length) * 100) / 100;
  }, [myReviews, profile.rating]);

  const toggleMode = () => {
    const newMode = activeMode === 'client' ? 'worker' : 'client';
    setActiveMode(newMode);
    toast({ title: t('switchedMode'), variant: 'success' });
  };

  const handleLogout = async () => {
    await logout();
    navigate('/auth', { replace: true });
    toast({ title: t('signedOut'), variant: 'default' });
  };

  const handleRefreshProfile = () => {
    syncUserFromAuth();
    toast({ title: t('loading'), variant: 'default' });
  };

  const recentHistory = useMemo(() => {
    try {
      return [
        ...clientJobs.slice(0, 3).map((j) => ({ ...j, role: 'client' as const })),
        ...workerApps
          .slice(0, 3)
          .map((a) => {
            const job = jobs.find((j) => j.id === a?.job_id);
            return job ? { ...job, role: 'worker' as const } : null;
          })
          .filter(Boolean),
      ]
        .filter(Boolean)
        .sort((a, b) => {
          try {
            return new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime();
          } catch {
            return 0;
          }
        })
        .slice(0, 5);
    } catch {
      return [];
    }
  }, [clientJobs, workerApps, jobs]);

  const offerDate = offerAcceptedAt ?? profile.offer_accepted_at;
  const formattedOfferDate = formatOfferDate(offerDate, locale);

  if (isAuthHydrating || (isLoading && !hasDisplayProfile(profile))) {
    return (
      <div className="animate-fade-in flex flex-col items-center justify-center py-20 text-center space-y-3">
        <div className="h-10 w-10 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
        <p className="text-sm text-gray-500">{t('loading')}</p>
      </div>
    );
  }

  if (!hasDisplayProfile(profile)) {
    return (
      <div className="animate-fade-in space-y-4 py-10 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-gray-100 text-gray-400 text-2xl font-bold">
          ?
        </div>
        <h2 className="text-lg font-semibold text-gray-900">{t('userFallback')}</h2>
        <p className="text-sm text-gray-500 max-w-xs mx-auto">{t('errorTitle')}</p>
        <div className="flex flex-col gap-2 max-w-xs mx-auto">
          <Button onClick={handleRefreshProfile} variant="outline">
            <RefreshCw className="h-4 w-4" />
            {t('retry')}
          </Button>
          <Button variant="outline" className="text-red-600 border-red-100" onClick={() => void handleLogout()}>
            <LogOut className="h-4 w-4" />
            {t('signOut')}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/30">
            {profile.avatar_url ? (
              <AvatarImage src={profile.avatar_url} alt={displayName} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-white/20 text-white text-lg">
              {getInitials(displayName)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold truncate">{displayName}</h2>
              <ProBadge profile={profile} />
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-4 w-4 text-amber-300 fill-amber-300" />
              <span className="text-sm font-medium">{formatProfileRating(averageRating)}</span>
              <span className="text-xs text-white/70 ml-1">
                ({myReviews.length} {t('reviewsCount')} · {t('averageRating')})
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-white/80">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{displayPhone}</span>
            </div>
            {profile.city && (
              <div className="flex items-center gap-1.5 mt-0.5 text-sm text-white/70">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {profile.city}
              </div>
            )}
          </div>
        </div>

        {skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {skills.map((skill) => (
              <span
                key={skill}
                className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[skill] ?? 'bg-white/20 text-white'}`}
              >
                {category(skill)}
              </span>
            ))}
          </div>
        )}
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900">{t('activeMode')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {activeMode === 'client' ? t('modeClientDesc') : t('modeWorkerDesc')}
              </p>
            </div>
            <Button variant="ghost" onClick={toggleMode} className="gap-2">
              {activeMode === 'client' ? (
                <>
                  <ToggleLeft className="h-6 w-6 text-emerald-600" />
                  <span className="text-sm font-medium text-emerald-600">{t('modeClient')}</span>
                </>
              ) : (
                <>
                  <ToggleRight className="h-6 w-6 text-indigo-600" />
                  <span className="text-sm font-medium text-indigo-600">{t('modeWorker')}</span>
                </>
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <ProSubscriptionCard profile={profile} onOpenModal={() => setProModalOpen(true)} />

      <ProSubscriptionModal
        open={proModalOpen}
        onClose={() => setProModalOpen(false)}
        userPhone={displayPhone !== '—' ? displayPhone : profile.phone}
      />

      <AdminLink />

      {formattedOfferDate && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t('offerAccepted')}</p>
              <p className="text-xs text-gray-400 mt-0.5">{formattedOfferDate}</p>
            </div>
            <Button variant="ghost" size="sm" onClick={() => navigate('/offer')} className="shrink-0 text-emerald-600">
              <FileText className="h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-2 gap-3">
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 text-emerald-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{clientJobs.length}</p>
            <p className="text-xs text-gray-400">{t('jobsPosted')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <Briefcase className="h-5 w-5 text-indigo-600 mx-auto mb-1" />
            <p className="text-2xl font-bold text-gray-900">{workerApps.length}</p>
            <p className="text-xs text-gray-400">{t('applications')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-emerald-600">{completedAsClient}</p>
            <p className="text-xs text-gray-400">{t('completedClient')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <p className="text-2xl font-bold text-indigo-600">{completedAsWorker}</p>
            <p className="text-xs text-gray-400">{t('completedWorker')}</p>
          </CardContent>
        </Card>
      </div>

      <div>
        <h3 className="font-semibold text-gray-900 mb-3">{t('recentActivity')}</h3>
        {recentHistory.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{t('noActivity')}</p>
        ) : (
          <div className="space-y-2">
            {recentHistory.map((item) => {
              if (!item) return null;
              return (
                <div
                  key={`${item.id}-${item.role}`}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title ?? '—'}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {item.role === 'client' ? t('roleClientActivity') : t('roleWorkerActivity')}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-emerald-600 font-medium">
                        {formatPrice(getJobSalary(item))}
                      </span>
                    </div>
                  </div>
                  {item.status && <StatusBadge status={item.status} />}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {myReviews.length > 0 && (
        <div>
          <h3 className="font-semibold text-gray-900 mb-3">{t('reviews')}</h3>
          <div className="space-y-2">
            {myReviews.map((review) => {
              const reviewer = getProfile(review.reviewer_id);
              const job = jobs.find((j) => j.id === review.job_id);
              return (
                <div key={review.id} className="p-4 rounded-xl bg-white border border-gray-100">
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <StarRating rating={review.rating ?? 0} />
                    {review.created_at && (
                      <span className="text-xs text-gray-400">
                        {new Date(review.created_at).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')}
                      </span>
                    )}
                  </div>
                  {reviewer?.full_name && (
                    <p className="text-xs text-gray-500 mb-1">
                      {t('reviewFrom')}: {reviewer.full_name}
                    </p>
                  )}
                  {job?.title && (
                    <p className="text-xs text-gray-400 mb-2 truncate">{job.title}</p>
                  )}
                  {review.comment && <p className="text-sm text-gray-600">{review.comment}</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50" onClick={() => void handleLogout()}>
        <LogOut className="h-4 w-4" />
        {t('signOut')}
      </Button>
    </div>
  );
}
