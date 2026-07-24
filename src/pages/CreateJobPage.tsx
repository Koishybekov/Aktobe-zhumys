import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Phone } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ProSubscriptionModal } from '@/components/profile/ProSubscription';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { getActiveUserId } from '@/store/useAuthStore';
import { CATEGORIES, DEFAULT_JOB_CITY, isValidJobCategoryId, type JobCategoryId } from '@/lib/constants';
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
import { normalizePhone, isValidKzPhone } from '@/lib/authPhone';
import { JobSubmitError, validateCreateJobInput, type JobFieldKey } from '@/lib/jobCreate';
import { cn } from '@/lib/utils';

export function CreateJobPage() {
  const navigate = useNavigate();
  const { t, category } = useTranslation();
  const { toast } = useToast();
  const createJob = useAppStore((s) => s.createJob);
  const fetchJobs = useAppStore((s) => s.fetchJobs);
  const jobs = useAppStore((s) => s.jobs);
  const currentUser = useAppStore((s) => s.currentUser);

  const supabaseReady = isSupabaseConfigured();

  const userId = getActiveUserId();
  const postedCount = useMemo(() => getPostedJobCount(jobs, userId), [jobs, userId]);
  const subscribed = hasActiveSubscription(currentUser);
  const remainingPosts = getRemainingFreePosts(postedCount, currentUser);
  const postLimitReached = isPostPaywallActive(postedCount, currentUser);

  const [submitting, setSubmitting] = useState(false);
  const [paywallOpen, setPaywallOpen] = useState(false);
  const [phoneError, setPhoneError] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<JobFieldKey, string>>>({});
  const [form, setForm] = useState<{
    title: string;
    company: string;
    city: string;
    salary: string;
    description: string;
    phone: string;
    category: JobCategoryId | '';
  }>({
    title: '',
    company: '',
    city: DEFAULT_JOB_CITY,
    salary: '',
    description: '',
    phone: currentUser.phone ?? '',
    category: '',
  });

  const update = (field: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    if (field === 'phone') setPhoneError('');
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next[field as JobFieldKey];
      return next;
    });
  };

  const handleCategoryChange = (value: string) => {
    setForm((f) => ({ ...f, category: value as JobCategoryId }));
    setFieldErrors((prev) => {
      const next = { ...prev };
      delete next.category;
      return next;
    });
  };

  const jobFieldToast = (field?: JobFieldKey, code?: string): string => {
    const codeMap: Record<string, string> = {
      TITLE_REQUIRED: t('errJobTitle'),
      COMPANY_REQUIRED: t('errJobCompany'),
      DESCRIPTION_REQUIRED: t('errJobDescription'),
      CATEGORY_REQUIRED: t('errJobCategory'),
      SALARY_REQUIRED: t('errJobSalary'),
      PHONE_REQUIRED: t('errPhoneRequired'),
      CITY_REQUIRED: t('errJobCity'),
      AUTH_REQUIRED: t('errJobAuth'),
    };
    if (code && codeMap[code]) return codeMap[code];

    const fieldMap: Record<string, string> = {
      title: t('errJobTitle'),
      company: t('errJobCompany'),
      description: t('errJobDescription'),
      category: t('errJobCategory'),
      salary: t('errJobSalary'),
      phone: t('errPhoneRequired'),
      city: t('errJobCity'),
      auth: t('errJobAuth'),
    };
    if (field && fieldMap[field]) return fieldMap[field];
    if (code && code !== 'VALIDATION_FAILED' && code !== 'EMPTY_RESPONSE') return code;
    return t('errJobSubmit');
  };

  const openPaywall = () => {
    setPaywallOpen(true);
    toast({ title: t('paywallPostBlocked'), variant: 'default' });
  };

  const validatePhone = (): boolean => {
    const normalized = normalizePhone(form.phone);
    if (!form.phone.trim()) {
      setPhoneError(t('errPhoneRequired'));
      return false;
    }
    if (!isValidKzPhone(normalized)) {
      setPhoneError(t('errPhone'));
      return false;
    }
    return true;
  };

  const isFormValid = () =>
    form.title.trim().length >= 3 &&
    form.company.trim().length >= 2 &&
    form.description.trim().length >= 10 &&
    isValidJobCategoryId(form.category) &&
    Number(form.salary) >= 1000 &&
    isValidKzPhone(normalizePhone(form.phone));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validatePhone()) return;

    if (!canPostJob(postedCount, currentUser)) {
      openPaywall();
      return;
    }

    if (!isFormValid()) {
      const validation = validateCreateJobInput({
        title: form.title,
        company: form.company,
        city: form.city,
        salary: Number(form.salary),
        description: form.description,
        phone: normalizePhone(form.phone),
        category: form.category,
      });
      if (isValidJobCategoryId(form.category)) {
        delete validation.category;
      }
      setFieldErrors(validation);
      const firstField = Object.keys(validation)[0] as JobFieldKey | undefined;
      if (firstField) {
        toast({
          title: jobFieldToast(firstField, validation[firstField!]),
          variant: 'error',
        });
      }
      return;
    }

    setSubmitting(true);
    setFieldErrors({});
    try {
      await createJob({
        title: form.title.trim(),
        company: form.company.trim(),
        city: form.city.trim() || DEFAULT_JOB_CITY,
        salary: Number(form.salary),
        description: form.description.trim(),
        phone: normalizePhone(form.phone),
        category: form.category,
      });
      await fetchJobs();
      toast({ title: t('jobPublished'), variant: 'success' });
      navigate('/');
    } catch (err) {
      console.error('Job submit error:', err);
      if (err instanceof Error && err.message === 'POST_LIMIT') {
        openPaywall();
      } else if (err instanceof Error && err.message === 'SUPABASE_REQUIRED') {
        toast({ title: t('supabaseRequired'), variant: 'error' });
      } else if (err instanceof JobSubmitError) {
        if (err.field) {
          setFieldErrors((prev) => ({ ...prev, [err.field!]: err.message }));
        }
        const showCategoryError =
          err.field === 'category' && !isValidJobCategoryId(form.category);
        toast({
          title: showCategoryError
            ? jobFieldToast(err.field, err.message)
            : err.message || jobFieldToast(err.field, err.message),
          variant: 'error',
        });
      } else if (err instanceof Error) {
        toast({ title: err.message || t('errJobSubmit'), variant: 'error' });
      } else {
        toast({ title: t('errJobSubmit'), variant: 'error' });
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
            {postedCount > 0 &&
              ` · ${t('paywallPostUsed').replace('{count}', String(Math.min(postedCount, FREE_JOB_POST_LIMIT)))}`}
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

      <form
        onSubmit={(e) => void handleSubmit(e)}
        className={cn(
          'rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5',
          formDisabled && 'opacity-50 pointer-events-none'
        )}
      >
        <div className="space-y-2">
          <Label htmlFor="title">{t('jobTitle')} *</Label>
          <Input
            id="title"
            placeholder={t('jobTitlePlaceholder')}
            value={form.title}
            onChange={(e) => update('title', e.target.value)}
            disabled={formDisabled}
            required
            minLength={3}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="company">{t('company')} *</Label>
          <Input
            id="company"
            placeholder={t('companyPlaceholder')}
            value={form.company}
            onChange={(e) => update('company', e.target.value)}
            disabled={formDisabled}
            required
            minLength={2}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="city">{t('city')}</Label>
          <Input id="city" value={form.city} readOnly disabled className="bg-gray-50 text-gray-600" />
        </div>

        <div className="space-y-2">
          <Label htmlFor="salary">{t('salary')} *</Label>
          <Input
            id="salary"
            type="number"
            placeholder="150000"
            min={1000}
            value={form.salary}
            onChange={(e) => update('salary', e.target.value)}
            disabled={formDisabled}
            required
          />
          <p className="text-xs text-gray-400">{t('minPayment')}</p>
        </div>

        <div className="space-y-2">
          <Label htmlFor="description">{t('description')} *</Label>
          <Textarea
            id="description"
            placeholder={t('descriptionPlaceholder')}
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={5}
            disabled={formDisabled}
            required
            minLength={10}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="phone">{t('contactPhone')} *</Label>
          <div className="relative">
            <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              id="phone"
              type="tel"
              placeholder={t('phonePlaceholder')}
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              disabled={formDisabled}
              required
              className={cn('pl-10', phoneError && 'border-red-400 focus-visible:ring-red-400')}
            />
          </div>
          {phoneError && <p className="text-xs text-red-600">{phoneError}</p>}
          {fieldErrors.phone && !phoneError && (
            <p className="text-xs text-red-600">{jobFieldToast('phone')}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="job-category">{t('category')} *</Label>
          <Select
            value={form.category || undefined}
            onValueChange={handleCategoryChange}
            disabled={formDisabled}
          >
            <SelectTrigger
              id="job-category"
              className={cn(fieldErrors.category && 'border-red-400')}
            >
              <SelectValue placeholder={t('selectCategory')} />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIES.filter((c) => c.id !== 'all').map((cat) => (
                <SelectItem key={cat.id} value={cat.id}>
                  {category(cat.id)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {fieldErrors.category && !isValidJobCategoryId(form.category) && (
            <p className="text-xs text-red-600">{t('errJobCategory')}</p>
          )}
        </div>

        <Button type="submit" disabled={!isFormValid() || submitting || formDisabled} className="w-full" size="lg">
          {submitting ? t('publishing') : t('publish')}
        </Button>
      </form>

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
