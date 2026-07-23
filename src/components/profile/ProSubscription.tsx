import { Crown, Check, MessageCircle, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { KASPI_PAYMENT_PHONE, SUBSCRIPTION_PRICE, ADMIN_WHATSAPP } from '@/lib/constants';
import { buildPaymentReceiptMessage } from '@/lib/admin';
import { openWhatsApp } from '@/lib/whatsapp';
import { hasActiveSubscription } from '@/lib/subscription';
import type { Profile } from '@/types';

interface ProSubscriptionModalProps {
  open: boolean;
  onClose: () => void;
  userPhone: string;
  paywall?: boolean;
  /** seeker = job view limit, employer = job post limit */
  paywallContext?: 'seeker' | 'employer';
}

export function ProSubscriptionModal({ open, onClose, userPhone, paywall, paywallContext = 'seeker' }: ProSubscriptionModalProps) {
  const { t } = useTranslation();

  const benefits = [t('proBenefit1'), t('proBenefit2'), t('proBenefit3')];

  const paywallTitle = paywallContext === 'employer' ? t('paywallPostTitle') : t('paywallTitle');
  const paywallDesc = paywallContext === 'employer' ? t('paywallPostDesc') : t('paywallDesc');

  const handleWhatsAppReceipt = () => {
    openWhatsApp(ADMIN_WHATSAPP, buildPaymentReceiptMessage(userPhone));
  };

  const handleCopyKaspi = async () => {
    try {
      await navigator.clipboard.writeText(KASPI_PAYMENT_PHONE.replace(/\s/g, ''));
    } catch {
      /* ignore */
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="sm:max-w-md p-0 overflow-hidden max-h-[90vh] overflow-y-auto">
        <div className="bg-gradient-to-br from-indigo-600 to-emerald-600 p-6 text-white">
          <DialogHeader>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-6 w-6 text-amber-300" />
              <span className="text-xs font-bold uppercase tracking-wide bg-white/20 px-2 py-0.5 rounded-full">PRO</span>
            </div>
            <DialogTitle className="text-xl text-white text-left">
              {paywall ? paywallTitle : t('proModalTitle')}
            </DialogTitle>
            <DialogDescription className="text-indigo-100 text-left">
              {paywall ? paywallDesc : t('proModalDesc')}
            </DialogDescription>
            <p className="text-3xl font-bold mt-3">
              {SUBSCRIPTION_PRICE} ₸<span className="text-base font-normal text-indigo-200">/{t('proMonth')}</span>
            </p>
          </DialogHeader>
        </div>

        <div className="p-6 space-y-5">
          <ul className="space-y-2.5">
            {benefits.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-gray-700">
                <Check className="h-5 w-5 text-emerald-500 shrink-0" />
                {b}
              </li>
            ))}
          </ul>

          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-emerald-800">{t('kaspiPaymentTitle')}</p>
            <p className="text-sm text-gray-700">{t('kaspiPaymentDesc')}</p>
            <div className="flex items-center justify-between gap-2 rounded-lg bg-white border border-emerald-100 px-3 py-2.5">
              <div>
                <p className="text-xs text-gray-400">Kaspi Gold</p>
                <p className="font-bold text-gray-900">{KASPI_PAYMENT_PHONE}</p>
                <p className="text-sm text-emerald-600 font-semibold">{SUBSCRIPTION_PRICE} ₸</p>
              </div>
              <button
                type="button"
                onClick={() => void handleCopyKaspi()}
                className="shrink-0 flex h-9 w-9 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                aria-label={t('copyKaspi')}
              >
                <Copy className="h-4 w-4" />
              </button>
            </div>
          </div>

          <Button
            className="w-full bg-[#25D366] hover:bg-[#20BD5A] text-white"
            size="lg"
            onClick={handleWhatsAppReceipt}
          >
            <MessageCircle className="h-5 w-5" />
            {t('sendReceiptWhatsApp')}
          </Button>

          <p className="text-xs text-center text-gray-400">{t('subscriptionActivationNote')}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

interface ProSubscriptionCardProps {
  profile: Pick<Profile, 'is_subscribed' | 'subscribed_until' | 'is_pro'>;
  onOpenModal: () => void;
}

export function ProSubscriptionCard({ profile, onOpenModal }: ProSubscriptionCardProps) {
  const { t, locale } = useTranslation();
  const active = hasActiveSubscription(profile);

  if (active) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-indigo-50 p-4 flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 text-white shrink-0">
          <Crown className="h-5 w-5" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900">{t('proTitle')}</p>
          <p className="text-xs text-emerald-600 font-medium">
            {t('proActive')} ✓
            {profile.subscribed_until && (
              <span className="text-gray-400 ml-1">
                · {t('proUntil')} {new Date(profile.subscribed_until).toLocaleDateString(locale === 'kk' ? 'kk-KZ' : 'ru-RU')}
              </span>
            )}
          </p>
        </div>
        <span className="shrink-0 rounded-full bg-gradient-to-r from-indigo-600 to-emerald-600 px-2.5 py-1 text-[10px] font-bold text-white">
          {t('proBadge')}
        </span>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpenModal}
      className="w-full rounded-2xl border border-indigo-100 bg-gradient-to-r from-indigo-50 to-emerald-50 p-4 flex items-center gap-3 text-left hover:shadow-md transition-shadow"
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-emerald-600 text-white shrink-0">
        <Crown className="h-5 w-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900">{t('proTitle')}</p>
        <p className="text-sm text-indigo-600 font-bold">{t('proPrice')}</p>
        <p className="text-xs text-gray-500 mt-0.5 truncate">{t('proBenefit1')}</p>
      </div>
      <span className="shrink-0 text-xs font-semibold text-emerald-600">{t('proSubscribe')} →</span>
    </button>
  );
}
