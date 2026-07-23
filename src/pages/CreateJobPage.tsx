import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/components/ui/use-toast';
import { useAppStore } from '@/store/useAppStore';
import { CATEGORIES, DEFAULT_CITY, AKTOBE_DISTRICTS } from '@/lib/constants';
import { useTranslation } from '@/lib/i18n/useTranslation';
import { cn } from '@/lib/utils';

export function CreateJobPage() {
  const navigate = useNavigate();
  const { t, category, locale } = useTranslation();
  const { toast } = useToast();
  const createJob = useAppStore((s) => s.createJob);

  const stepLabels = [t('stepTitle'), t('stepDescription'), t('stepPayment')];

  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
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

  const canProceed = () => {
    if (step === 0) return form.title.trim().length >= 3 && form.category;
    if (step === 1) return form.description.trim().length >= 10 && form.location_address.trim().length >= 3 && form.district;
    if (step === 2) return Number(form.price) >= 1000;
    return false;
  };

  const handleSubmit = async () => {
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
    } catch {
      toast({ title: t('error'), variant: 'error' });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="animate-fade-in">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">{t('postJob')}</h2>
        <p className="text-sm text-gray-500 mt-0.5">{t('postJobDesc')}</p>
      </div>

      <div className="flex items-center gap-2 mb-8">
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

      <div className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm space-y-5">
        {step === 0 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="title">{t('jobTitle')}</Label>
              <Input id="title" placeholder={t('jobTitlePlaceholder')} value={form.title} onChange={(e) => update('title', e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>{t('category')}</Label>
              <Select value={form.category} onValueChange={(v) => update('category', v)}>
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
              <Textarea id="description" placeholder={t('descriptionPlaceholder')} value={form.description} onChange={(e) => update('description', e.target.value)} rows={5} />
            </div>
            <div className="space-y-2">
              <Label>{t('district')}</Label>
              <Select value={form.district} onValueChange={(v) => update('district', v)}>
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
              <Input id="location" placeholder={t('locationPlaceholder')} value={form.location_address} onChange={(e) => update('location_address', e.target.value)} />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <div className="space-y-2">
              <Label htmlFor="price">{t('payment')}</Label>
              <Input id="price" type="number" placeholder="5000" min={1000} value={form.price} onChange={(e) => update('price', e.target.value)} />
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
          <Button variant="outline" onClick={() => setStep((s) => s - 1)} className="flex-1">
            <ChevronLeft className="h-4 w-4" /> {t('back')}
          </Button>
        )}
        {step < stepLabels.length - 1 ? (
          <Button onClick={() => setStep((s) => s + 1)} disabled={!canProceed()} className="flex-1">
            {t('next')} <ChevronRight className="h-4 w-4" />
          </Button>
        ) : (
          <Button onClick={handleSubmit} disabled={!canProceed() || submitting} className="flex-1">
            {submitting ? t('publishing') : t('publish')}
          </Button>
        )}
      </div>
    </div>
  );
}
