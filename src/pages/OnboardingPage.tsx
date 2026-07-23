import { useState } from 'react';
import {
  Phone,
  ArrowRight,
  Briefcase,
  User,
  Users,
  ChevronLeft,
  Globe,
  FileText,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { AvatarUpload } from '@/components/auth/AvatarUpload';
import { PublicOfferModal, OfferAgreementCheckbox } from '@/components/auth/PublicOfferModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { APP_NAME } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { UserRole, AuthStep } from '@/types';

const STEPS: AuthStep[] = ['language', 'role', 'profile', 'terms', 'otp'];

const ROLES: { id: UserRole; labelKey: 'roleWorker' | 'roleClient' | 'roleBoth'; descKey: 'roleWorkerDesc' | 'roleClientDesc' | 'roleBothDesc'; icon: typeof User }[] = [
  { id: 'worker', labelKey: 'roleWorker', descKey: 'roleWorkerDesc', icon: Briefcase },
  { id: 'client', labelKey: 'roleClient', descKey: 'roleClientDesc', icon: User },
  { id: 'both', labelKey: 'roleBoth', descKey: 'roleBothDesc', icon: Users },
];

export function OnboardingPage() {
  const { t } = useTranslation();
  const {
    authStep,
    pendingPhone,
    draftFullName,
    draftAvatar,
    selectedRole,
    offerAccepted,
    isSubmitting,
    error,
    setAuthStep,
    setSelectedRole,
    setOfferAccepted,
    setDraftFullName,
    setDraftAvatar,
    setDraftPhone,
    submitProfileDraft,
    acceptTermsAndSendOtp,
    verifyOtp,
  } = useAuthStore();

  const [otp, setOtp] = useState('');
  const [offerOpen, setOfferOpen] = useState(false);

  const stepIndex = STEPS.indexOf(authStep as AuthStep);
  const progress = authStep === 'language' ? 0 : ((stepIndex + 1) / STEPS.length) * 100;

  const handleOtpSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    void verifyOtp(otp);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-indigo-50 flex flex-col">
      {/* Top bar with language switcher */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <span className="text-sm font-bold text-emerald-700">{APP_NAME}</span>
        <LanguageSwitcher size="sm" />
      </div>

      {authStep !== 'language' && (
        <div className="px-6 pt-4">
          <div className="h-1.5 rounded-full bg-gray-100 overflow-hidden">
            <div
              className="h-full bg-emerald-500 transition-all duration-500 rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full">
        {/* Logo */}
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg mb-3 text-lg font-bold">
            АЖ
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t('appName')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('appTagline')}</p>
        </div>

        {/* Step 1: Language */}
        {authStep === 'language' && (
          <div className="space-y-6 animate-fade-in">
            <div className="text-center">
              <Globe className="h-10 w-10 text-emerald-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">{t('chooseLanguage')}</h2>
            </div>
            <div className="flex justify-center">
              <LanguageSwitcher size="md" />
            </div>
            <Button className="w-full" size="lg" onClick={() => setAuthStep('role')}>
              {t('continue')} <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        )}

        {/* Step 2: Role */}
        {authStep === 'role' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('chooseRole')}</h2>
            </div>
            <div className="grid grid-cols-1 gap-2">
              {ROLES.map(({ id, labelKey, descKey, icon: Icon }) => (
                <button
                  key={id}
                  type="button"
                  onClick={() => setSelectedRole(id)}
                  className={cn(
                    'flex items-center gap-4 rounded-xl border p-4 text-left transition-all',
                    selectedRole === id
                      ? 'border-emerald-500 bg-emerald-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  )}
                >
                  <div className={cn(
                    'flex h-11 w-11 items-center justify-center rounded-xl',
                    selectedRole === id ? 'bg-emerald-600 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{t(labelKey)}</p>
                    <p className="text-xs text-gray-400">{t(descKey)}</p>
                  </div>
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAuthStep('language')} className="flex-1">
                <ChevronLeft className="h-4 w-4" /> {t('back')}
              </Button>
              <Button onClick={() => setAuthStep('profile')} className="flex-1">
                {t('continue')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 3: Profile */}
        {authStep === 'profile' && (
          <div className="space-y-5 animate-fade-in">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('setupProfile')}</h2>
              <p className="text-sm text-gray-500">{t('setupProfileDesc')}</p>
            </div>

            <AvatarUpload
              value={draftAvatar}
              name={draftFullName}
              onChange={setDraftAvatar}
              labels={{ photo: t('profilePhoto'), tap: t('tapToUpload'), remove: t('removePhoto') }}
            />

            <div className="space-y-2">
              <Label htmlFor="fullName">{t('fullName')}</Label>
              <Input
                id="fullName"
                placeholder={t('fullNamePlaceholder')}
                value={draftFullName}
                onChange={(e) => setDraftFullName(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">{t('phoneNumber')}</Label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  id="phone"
                  type="tel"
                  placeholder={t('phonePlaceholder')}
                  value={pendingPhone}
                  onChange={(e) => setDraftPhone(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAuthStep('role')} className="flex-1">
                <ChevronLeft className="h-4 w-4" /> {t('back')}
              </Button>
              <Button onClick={submitProfileDraft} className="flex-1">
                {t('continue')} <ArrowRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}

        {/* Step 4: Terms */}
        {authStep === 'terms' && (
          <div className="space-y-5 animate-fade-in">
            <div className="text-center">
              <FileText className="h-10 w-10 text-indigo-600 mx-auto mb-3" />
              <h2 className="text-lg font-semibold text-gray-900">{t('termsTitle')}</h2>
              <p className="text-sm text-gray-500 mt-1">{t('termsDesc')}</p>
            </div>

            <button
              type="button"
              onClick={() => setOfferOpen(true)}
              className="w-full rounded-xl border border-indigo-100 bg-indigo-50 p-4 text-left hover:bg-indigo-100 transition-colors"
            >
              <p className="text-sm font-semibold text-indigo-700">{t('publicOffer')}</p>
              <p className="text-xs text-indigo-500 mt-0.5">Публичная оферта / Жария оферта →</p>
            </button>

            <OfferAgreementCheckbox
              checked={offerAccepted}
              onCheckedChange={setOfferAccepted}
              onOpenOffer={() => setOfferOpen(true)}
            />

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setAuthStep('profile')} className="flex-1">
                <ChevronLeft className="h-4 w-4" /> {t('back')}
              </Button>
              <Button
                onClick={() => void acceptTermsAndSendOtp()}
                disabled={isSubmitting || !offerAccepted}
                className="flex-1"
              >
                {isSubmitting ? t('sendingCode') : t('acceptAndContinue')}
              </Button>
            </div>
          </div>
        )}

        {/* Step 5: OTP */}
        {authStep === 'otp' && (
          <form onSubmit={handleOtpSubmit} className="space-y-5 animate-fade-in">
            <div>
              <h2 className="text-lg font-semibold text-gray-900">{t('enterCode')}</h2>
              <p className="text-sm text-gray-500 mt-0.5">
                {t('codeSentTo')} <span className="font-medium text-gray-700">{pendingPhone}</span>
              </p>
              <p className="text-xs text-emerald-600 mt-1">{t('demoHint')}</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="otp">{t('smsCode')}</Label>
              <Input
                id="otp"
                type="text"
                inputMode="numeric"
                placeholder="• • • •"
                value={otp}
                onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="text-center text-2xl tracking-[0.5em] font-semibold h-14"
                maxLength={6}
                autoFocus
              />
            </div>

            {error && <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

            <Button type="submit" className="w-full" size="lg" disabled={isSubmitting || otp.length < 4}>
              {isSubmitting ? t('verifying') : t('verifyContinue')}
            </Button>

            <button
              type="button"
              onClick={() => setAuthStep('terms')}
              className="w-full text-sm text-gray-400 hover:text-gray-600"
            >
              {t('changePhone')}
            </button>
          </form>
        )}
      </div>

      <PublicOfferModal open={offerOpen} onClose={() => setOfferOpen(false)} />
    </div>
  );
}
