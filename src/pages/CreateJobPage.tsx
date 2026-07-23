import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProSubscriptionModal } from '@/components/profile/ProSubscription';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { CATEGORIES, DEFAULT_CITY, AKTOBE_DISTRICTS } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { hasActiveSubscription } from '@/lib/subscription';
import {
  canPostJob,
  getPostedJobCount,
  getRemainingFreePosts,
  isPostPaywallActive,
  FREE_JOB_POST_LIMIT,
} from '@/lib/jobPostLimit';
import { isSupabaseConfigured } from '@/lib/supabase';
import { cn } from '@/lib/utils';

export function CreateJobPage() {
  const navigate = useNavigate();
  const { t, category, locale } = useTranslation();
  const { toast } = useToast();
  const createJob = useAppStore((s) => s.createJob);
  const jobs = useAppStore((s) => s.jobs);
  const currentUser = useAppStore((s) => s.currentUser);

  const supabaseReady = isSupabaseConfigured();

  const userId = getActiveUserId();
  const postedCount = useMemo(() => getPostedJobCount(jobs, userId), [jobs, userId]);
  const subscribed = hasActiveSubscription(currentUser);
  const remainingPosts = getRemainingFreePosts(postedCount, currentUser);
  const postLimitReached = isPostPaywallActive(postedCount, currentUser);

  const stepLabels = [t('stepTitle'), t('stepDescription'), t('stepPayment')];

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [form, setForm] = useState({
    title: '',
    category: '',
    description: '',
    location_address: '',
    district: '',
    city: DEFAULT_CITY,
    price: '',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const openPaywall = () => {
    setPaywallOpen(true);
    toast({ title: t('paywallPostBlocked'), variant: 'default' });
  };

  const canProceed = () => {
    if (postLimitReached) return false;
    if (step === 0) return form.title.trim().length >= 3 && form.category;
    if (step === 1) return form.description.trim().length >= 10 && form.location_address.trim().length >= 3 && form.district;
    if (step === 2) return Number(form.price) >= 1000;
    return false;
  };

  const handleSubmit = async () => {
    if (!canPostJob(postedCount, currentUser)) {
      openPaywall();
      return;
    }

    setSubmitting(true);
    try {
      await createJob({
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim(),
        location_address: form.location_address.trim(),
        city: form.city,
        district: form.district,
        price: Number(form.price),
      });
      toast({ title: t('jobPublished'), variant: 'success' });
      navigate('/my-jobs');
    } catch (err) {
      if (err instanceof Error && err.message === 'POST_LIMIT') {
        openPaywall();
      } else if (err instanceof Error && err.message === 'SUPABASE_REQUIRED') {
        toast({ title: t('supabaseRequired'), variant: 'error' });
      } else {
        toast({ title: t('error'), variant: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  };

  const formDisabled = postLimitReached || !supabaseReady;

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('postJob')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('postJobDesc')}</p>
        {!subscribed && (
          <p className="text-xs text-amber-600 font-medium mt-1">
            {remainingPosts > 0
              ? t('paywallPostRemaining').replace('{count}', String(remainingPosts))
              : t('paywallPostBlocked')}
            {postedCount > 0 && ` · ${t('paywallPostUsed').replace('{count}', String(Math.min(postedCount, FREE_JOB_POST_LIMIT)))}`}
          </p>
        )}
      </div>

      {!supabaseReady && (
        <div className="mb-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <p className="font-semibold">{t('supabaseRequired')}</p>
        </div>
      )}

      {postLimitReached && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          <p className="font-semibold">{t('paywallPostTitle')}</p>
          <p className="mt-1 text-amber-800">{t('paywallPostDesc')}</p>
          <Button className="mt-3 w-full" onClick={openPaywall}>
            {t('proSubscribe')}
          </Button>
        </div>
      )}

      <div className={cn('flex items-center gap-2 mb-8', formDisabled && 'opacity-50 pointer-events-none')}>
        {stepLabels.map((label, i) => (
          <div key={label} className="flex items-center gap-2 flex-1">
            <div className={cn(
              'flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors',
              i < step ? 'bg-emerald-600 text-white' : i === step ? 'bg-indigo-600 text-white' : 'bg-gray-100 text-gray-400'
            )}>
              {i < step ? <Check className="h-4 w-4" /> : i + 1}
            </div>
            <span className={cn('text-xs font-medium hidden sm:block', i === step ? 'text-gray-900' : 'text-gray-400')}>{label}</span>
            {i < stepLabels.length - 1 && <div className={cn('h-0.5 flex-1 rounded', i < step ? 'bg-emerald-500' : 'bg-gray-100')} />}
          </div>
        ))}
      </div>

      <div className={cn('rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5', formDisabled && 'opacity-50 pointer-events-none')}>
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">{t('jobTitle')}</Label>
              <Input id="title" placeholder={t('jobTitlePlaceholder')} value={form.title} onChange={(e) => update('title', e.target.value)} disabled={formDisabled} />
            </div>
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select value={form.category} onValueChange={(v) => update('category', v)} disabled={formDisabled}>
                <SelectTrigger><SelectValue placeholder={t('selectCategory')} /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>{category(cat.id)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </>
        )}

        {step === 1 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="description">{t('description')}</Label>
              <Textarea id="description" placeholder={t('descriptionPlaceholder')} value={form.description} onChange={(e) => update('description', e.target.value)} rows={5} disabled={formDisabled} />
            </div>
            <div className="space-y-2">
              <Label>{t('district')}</Label>
              <Select value={form.district} onValueChange={(v) => update('district', v)} disabled={formDisabled}>
                <SelectTrigger><SelectValue placeholder={t('selectDistrict')} /></SelectTrigger>
                <SelectContent>
                  {AKTOBE_DISTRICTS.filter((d) => d.id !== 'all').map((d) => (
                    <SelectItem key={d.id} value={d.id}>{locale === 'kk' ? d.labelKk : d.labelRu}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">{t('location')}</Label>
              <Input id="location" placeholder={t('locationPlaceholder')} value={form.location_address} onChange={(e) => update('location_address', e.target.value)} disabled={formDisabled} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="price">{t('payment')}</Label>
              <Input id="price" type="number" placeholder="5000" min={1000} value={form.price} onChange={(e) => update('price', e.target.value)} disabled={formDisabled} />
              <p className="text-xs text-gray-400">{t('minPayment')}</p>
            </div>
            <div className="rounded-xl bg-emerald-50 p-4 space-y-2">
              <h4 className="font-semibold text-emerald-800 text-sm">{t('summary')}</h4>
              <p className="text-sm text-emerald-700"><strong>{form.title}</strong></p>
              <p className="text-xs text-emerald-600">{category(form.category)} · {form.district}</p>
              <p className="text-lg font-bold text-emerald-700">{Number(form.price).toLocaleString()} ₸</p>
            </div>
          </>
        )}
      </div>

      <div className="flex gap-3 mt-6">
        {step > 0 && (
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1" disabled={formDisabled}>
            <ChevronLeft className="h-4 w-4" /> {t('back')}
          </Button>
        )}
        {step < stepLabels.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="flex-1">
            {t('next')} <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canProceed() || submitting || formDisabled} className="flex-1">
            {submitting ? t('publishing') : t('publish')}
          </Button>
        )}
      </div>

      <ProSubscriptionModal
        open={paywallOpen}
        onClose={() => setPaywallOpen(false)}
        userPhone={currentUser.phone}
        paywall
        paywallContext="employer"
      />
    </div>
  );
}
