import { useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Briefcase, Phone, Star, ToggleLeft, ToggleRight, MapPin, LogOut, FileText, ShieldCheck, Crown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { StarRating, StatusBadge } from '@/components/ui/badge';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { formatPrice, getInitials } from '@/lib/utils';
import { CATEGORY_COLORS } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { ProSubscriptionCard, ProSubscriptionModal } from '@/components/profile/ProSubscription';

export function ProfilePage() {
  const navigate = useNavigate();
  const { currentUser, activeMode, setActiveMode, getMyClientJobs, getMyWorkerApplications, jobs, reviews, resetSession, subscribeToPro } =
    useAppStore();
  const logout = useAuthStore((s) => s.logout);
  const isSubmitting = useAuthStore((s) => s.isSubmitting);
  const offerAcceptedAt = useAuthStore((s) => s.offerAcceptedAt);
  const { t, category } = useTranslation();
  const { toast } = useToast();
  const [proModalOpen, setProModalOpen] = useState(false);

  const userId = getActiveUserId();
  const clientJobs = getMyClientJobs();
  const workerApps = getMyWorkerApplications();
  const completedAsClient = clientJobs.filter((j) => j.status === 'completed').length;
  const completedAsWorker = workerApps.filter((a) => {
    const job = jobs.find((j) => j.id === a.job_id);
    return job?.status === 'completed';
  }).length;

  const myReviews = reviews.filter((r) => r.target_id === userId);

  const toggleMode = () => {
    const newMode = activeMode === 'client' ? 'worker' : 'client';
    setActiveMode(newMode);
    toast({ title: t('switchedMode'), variant: 'success' });
  };

  const handleLogout = () => {
    logout();
    resetSession();
    navigate('/auth', { replace: true });
    toast({ title: t('signedOut'), variant: 'default' });
  };

  const handleSubscribePro = async () => {
    await subscribeToPro();
    setProModalOpen(false);
    toast({ title: t('proSuccess'), variant: 'success' });
  };

  const recentHistory = [
    ...clientJobs.slice(0, 3).map((j) => ({ ...j, role: 'client' as const })),
    ...workerApps
      .slice(0, 3)
      .map((a) => {
        const job = jobs.find((j) => j.id === a.job_id);
        return job ? { ...job, role: 'worker' as const } : null;
      })
      .filter(Boolean),
  ]
    .sort((a, b) => new Date(b!.created_at).getTime() - new Date(a!.created_at).getTime())
    .slice(0, 5);

  return (
    <div className="animate-fade-in space-y-5">
      <div className="rounded-2xl bg-gradient-to-br from-emerald-600 to-indigo-600 p-6 text-white">
        <div className="flex items-center gap-4">
          <Avatar className="h-16 w-16 border-2 border-white/30">
            {currentUser.avatar_url ? (
              <AvatarImage src={currentUser.avatar_url} alt={currentUser.full_name} className="object-cover" />
            ) : null}
            <AvatarFallback className="bg-white/20 text-white text-lg">
              {getInitials(currentUser.full_name || '?')}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-bold truncate">{currentUser.full_name || t('userFallback')}</h2>
              {currentUser.is_pro && (
                <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-400/90 px-2 py-0.5 text-[10px] font-bold text-indigo-900 shrink-0">
                  <Crown className="h-3 w-3" />
                  {t('proBadge')}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 mt-1">
              <Star className="h-4 w-4 text-amber-300 fill-amber-300" />
              <span className="text-sm font-medium">{currentUser.rating.toFixed(1)}</span>
              <span className="text-xs text-white/70 ml-1">
                ({myReviews.length} {t('reviewsCount')})
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-sm text-white/80">
              <Phone className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{currentUser.phone}</span>
            </div>
            {currentUser.city && (
              <div className="flex items-center gap-1.5 mt-0.5 text-sm text-white/70">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                {currentUser.city}
              </div>
            )}
          </div>
        </div>

        {currentUser.skills && currentUser.skills.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-4">
            {currentUser.skills.map((skill) => (
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

      <ProSubscriptionCard isPro={!!currentUser.is_pro} onOpenModal={() => setProModalOpen(true)} />

      <ProSubscriptionModal
        open={proModalOpen}
        onClose={() => setProModalOpen(false)}
        onSubscribe={handleSubscribePro}
        isSubmitting={isSubmitting}
      />

      {(offerAcceptedAt || currentUser.offer_accepted_at) && (
        <Card>
          <CardContent className="p-4 flex items-start gap-3">
            <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900">{t('offerAccepted')}</p>
              <p className="text-xs text-gray-400 mt-0.5">
                {new Date(offerAcceptedAt ?? currentUser.offer_accepted_at!).toLocaleDateString('kk-KZ')}
              </p>
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
                <div key={`${item.id}-${item.role}`} className="flex items-center gap-3 p-3 rounded-xl bg-white border border-gray-100">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{item.title}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-xs text-gray-400">
                        {item.role === 'client' ? t('roleClientActivity') : t('roleWorkerActivity')}
                      </span>
                      <span className="text-xs text-gray-300">·</span>
                      <span className="text-xs text-emerald-600 font-medium">{formatPrice(item.price)}</span>
                    </div>
                  </div>
                  <StatusBadge status={item.status} />
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
            {myReviews.map((review) => (
              <div key={review.id} className="p-4 rounded-xl bg-white border border-gray-100">
                <StarRating rating={review.rating} />
                {review.comment && <p className="text-sm text-gray-600 mt-2">{review.comment}</p>}
              </div>
            ))}
          </div>
        </div>
      )}

      <Button variant="outline" className="w-full text-red-600 border-red-100 hover:bg-red-50" onClick={handleLogout}>
        <LogOut className="h-4 w-4" />
        {t('signOut')}
      </Button>
    </div>
  );
}
