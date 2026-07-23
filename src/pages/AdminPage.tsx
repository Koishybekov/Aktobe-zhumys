import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Shield, Phone, CheckCircle, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { useAuthStore } from '@/store/useAuthStore';
import { isAdminPhone } from '@/lib/admin';
import { normalizePhone } from '@/lib/authPhone';
import { hasActiveSubscription } from '@/lib/subscription';
import { useTranslation } from '@/lib/i18n/useTranslation';

export function AdminPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { toast } = useToast();
  const profile = useAuthStore((s) => s.profile);
  const adminActivateSubscription = useAppStore((s) => s.adminActivateSubscription);

  const [targetPhone, setTargetPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [lastActivated, setLastActivated] = useState<string | null>(null);

  if (!profile || !isAdminPhone(profile.phone)) {
    return (
      <div className="min-h-dvh flex items-center justify-center p-6 bg-gray-50">
        <div className="text-center">
          <p className="text-gray-500">{t('adminAccessDenied')}</p>
          <Button variant="outline" className="mt-4" onClick={() => navigate('/')}>
            {t('back')}
          </Button>
        </div>
      </div>
    );
  }

  const handleActivate = async () => {
    const normalized = normalizePhone(targetPhone);
    if (!normalized || normalized.length < 11) {
      toast({ title: t('errPhone'), variant: 'error' });
      return;
    }

    setIsSubmitting(true);
    try {
      const activated = await adminActivateSubscription(normalized);
      if (!activated) {
        toast({ title: t('adminUserNotFound'), variant: 'error' });
        return;
      }
      setLastActivated(normalized);
      setTargetPhone('');
      toast({
        title: t('adminActivated'),
        description: `${normalized} · ${activated.full_name || t('userFallback')}`,
        variant: 'success',
      });
    } catch {
      toast({ title: t('error'), variant: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-dvh bg-gray-50">
      <header className="sticky top-0 z-10 border-b border-gray-100 bg-white px-4 py-3">
        <div className="mx-auto max-w-md flex items-center gap-3">
          <button type="button" onClick={() => navigate('/profile')} className="flex h-9 w-9 items-center justify-center rounded-xl hover:bg-gray-100">
            <ArrowLeft className="h-5 w-5 text-gray-600" />
          </button>
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5 text-indigo-600" />
            <h1 className="font-bold text-gray-900">{t('adminTitle')}</h1>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 py-6 space-y-6">
        <div className="rounded-2xl border border-indigo-100 bg-indigo-50 p-4">
          <p className="text-sm text-indigo-800">{t('adminDesc')}</p>
          <p className="text-xs text-indigo-600 mt-1">{t('adminLoggedInAs')} {profile.phone}</p>
        </div>

        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm space-y-4">
          <Label htmlFor="admin-phone">{t('adminTargetPhone')}</Label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="admin-phone"
              type="tel"
              placeholder={t('phonePlaceholder')}
              value={targetPhone}
              onChange={(e) => setTargetPhone(e.target.value)}
              className="pl-10"
            />
          </div>

          <Button className="w-full" size="lg" disabled={isSubmitting} onClick={() => void handleActivate()}>
            <CheckCircle className="h-5 w-5" />
            {isSubmitting ? t('saving') : t('adminActivateBtn')}
          </Button>
        </div>

        {lastActivated && (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-800">
            ✓ {t('adminLastActivated')}: <strong>{lastActivated}</strong>
          </div>
        )}

        <div className="rounded-xl bg-white border border-gray-100 p-4 text-xs text-gray-500 space-y-1">
          <p>{t('adminHint1')}</p>
          <p>{t('adminHint2')}</p>
        </div>
      </main>
    </div>
  );
}

export function AdminLink() {
  const profile = useAuthStore((s) => s.profile);
  const navigate = useNavigate();
  const { t } = useTranslation();

  if (!profile || !isAdminPhone(profile.phone)) return null;

  return (
    <Button variant="outline" className="w-full border-indigo-200 text-indigo-700" onClick={() => navigate('/admin')}>
      <Shield className="h-4 w-4" />
      {t('adminPanel')}
    </Button>
  );
}

/** Small helper for profile subscription badge */
export function useIsSubscribed() {
  const currentUser = useAppStore((s) => s.currentUser);
  return hasActiveSubscription(currentUser);
}
