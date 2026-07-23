import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone, Lock, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { LanguageSwitcher } from '@/components/LanguageSwitcher';
import { OfferAgreementCheckbox } from '@/components/auth/PublicOfferModal';
import { useAuthStore } from '@/store/useAuthStore';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { APP_NAME, ADMIN_WHATSAPP } from '@/lib/constants';
import { openWhatsApp } from '@/lib/whatsapp';
import { normalizePhone } from '@/lib/authPhone';

export function AuthPage() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { register, login, isSubmitting, error } = useAuthStore();

  const [tab, setTab] = useState<'login' | 'register'>('login');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [forgotPhone, setForgotPhone] = useState('');

  const clearForm = () => {
    setPassword('');
    setConfirmPassword('');
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!termsAccepted) return;
    await register(phone, password, confirmPassword);
    const state = useAuthStore.getState();
    if (state.isAuthenticated) {
      navigate(state.onboardingCompleted ? '/' : '/onboarding', { replace: true });
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(phone, password);
    const state = useAuthStore.getState();
    if (state.isAuthenticated) {
      navigate(state.onboardingCompleted ? '/' : '/onboarding', { replace: true });
    }
  };

  const handleForgotPassword = () => {
    const normalized = normalizePhone(forgotPhone || phone);
    const message = t('forgotPasswordMessage').replace('{phone}', normalized);
    openWhatsApp(ADMIN_WHATSAPP, message);
    setForgotOpen(false);
  };

  return (
    <div className="min-h-dvh bg-gradient-to-b from-emerald-50 via-white to-indigo-50 flex flex-col">
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-lg border-b border-gray-100">
        <span className="text-sm font-bold text-emerald-700">{APP_NAME}</span>
        <LanguageSwitcher size="sm" />
      </div>

      <div className="flex-1 flex flex-col justify-center px-6 py-8 max-w-md mx-auto w-full">
        <div className="text-center mb-6 animate-fade-in">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-lg mb-3 text-lg font-bold">
            АЖ
          </div>
          <h1 className="text-xl font-bold text-gray-900">{t('appName')}</h1>
          <p className="text-sm text-gray-500 mt-0.5">{t('appTagline')}</p>
        </div>

        <Tabs
          value={tab}
          onValueChange={(v) => {
            setTab(v as 'login' | 'register');
            clearForm();
            useAuthStore.setState({ error: null });
          }}
          className="animate-fade-in"
        >
          <TabsList className="mb-5">
            <TabsTrigger value="login">{t('authLogin')}</TabsTrigger>
            <TabsTrigger value="register">{t('authRegister')}</TabsTrigger>
          </TabsList>

          {error && (
            <p className="text-sm text-red-500 bg-red-50 rounded-lg px-3 py-2 mb-4">{error}</p>
          )}

          <TabsContent value="login">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-phone">{t('phoneNumber')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="login-phone"
                    type="tel"
                    placeholder={t('phonePlaceholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="login-password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="login-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    aria-label={t('password')}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setForgotPhone(phone);
                  setForgotOpen(true);
                }}
                className="text-sm text-emerald-600 hover:text-emerald-700 font-medium"
              >
                {t('forgotPassword')}
              </button>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? t('authSigningIn') : t('authSignIn')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="register">
            <form onSubmit={handleRegister} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="reg-phone">{t('phoneNumber')}</Label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-phone"
                    type="tel"
                    placeholder={t('phonePlaceholder')}
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="pl-10"
                    autoComplete="tel"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-password">{t('password')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('passwordPlaceholder')}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 pr-10"
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
                <p className="text-xs text-gray-400">{t('passwordHint')}</p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="reg-confirm">{t('confirmPassword')}</Label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="reg-confirm"
                    type={showPassword ? 'text' : 'password'}
                    placeholder={t('confirmPasswordPlaceholder')}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="pl-10"
                    autoComplete="new-password"
                  />
                </div>
              </div>

              <OfferAgreementCheckbox
                checked={termsAccepted}
                onCheckedChange={setTermsAccepted}
                onOpenOffer={() => navigate('/offer')}
              />

              <Button
                type="submit"
                className="w-full"
                size="lg"
                disabled={isSubmitting || !termsAccepted}
              >
                {isSubmitting ? t('authRegistering') : t('authCreateAccount')}
                <ArrowRight className="h-4 w-4" />
              </Button>
            </form>
          </TabsContent>
        </Tabs>
      </div>

      <Dialog open={forgotOpen} onOpenChange={setForgotOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>{t('forgotPasswordTitle')}</DialogTitle>
            <DialogDescription>{t('forgotPasswordDesc')}</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="forgot-phone">{t('phoneNumber')}</Label>
              <Input
                id="forgot-phone"
                type="tel"
                placeholder={t('phonePlaceholder')}
                value={forgotPhone}
                onChange={(e) => setForgotPhone(e.target.value)}
              />
            </div>
            <Button className="w-full" onClick={handleForgotPassword}>
              {t('forgotPasswordWhatsApp')}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
