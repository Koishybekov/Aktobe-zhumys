import { AKTOBE_DISTRICTS, JOB_CATEGORY_IDS } from '@/lib/constants';
import { translations, type TranslationKey } from '@/lib/i18n/translations';
import type { Job } from '@/types';

const CATEGORY_KEYS: Record<string, TranslationKey> = {
  all: 'catAll',
  Delivery: 'catDelivery',
  Construction: 'catConstruction',
  Cleaning: 'catCleaning',
  IT: 'catIT',
  Handyman: 'catHandyman',
  Moving: 'catMoving',
  Tutoring: 'catTutoring',
  Other: 'catOther',
};

const ALL_FILTER_TOKENS = new Set([
  'all',
  '',
  'барлығы',
  'барлық',
  'все',
  'catall',
]);

function buildCategoryLookup(): Map<string, string> {
  const map = new Map<string, string>();

  for (const id of JOB_CATEGORY_IDS) {
    map.set(id.toLowerCase(), id);
  }

  for (const [id, key] of Object.entries(CATEGORY_KEYS)) {
    if (id === 'all') continue;
    map.set(id.toLowerCase(), id);
    for (const locale of ['kk', 'ru'] as const) {
      const label = translations[locale][key];
      if (label) {
        map.set(label.trim().toLowerCase(), id);
      }
    }
  }

  return map;
}

const CATEGORY_LOOKUP = buildCategoryLookup();

function buildDistrictLookup(): Map<string, string> {
  const map = new Map<string, string>();
  for (const d of AKTOBE_DISTRICTS) {
    if (d.id === 'all') continue;
    map.set(d.id.trim().toLowerCase(), d.id);
    map.set(d.labelKk.trim().toLowerCase(), d.id);
    map.set(d.labelRu.trim().toLowerCase(), d.id);
  }
  return map;
}

const DISTRICT_LOOKUP = buildDistrictLookup();

export function normalizeFilterToken(value: string | undefined | null): string {
  return (value ?? '').trim().toLowerCase();
}

/** True when filter means "show everything" (all / Барлығы / empty). */
export function isAllFilter(value: string | undefined | null): boolean {
  return ALL_FILTER_TOKENS.has(normalizeFilterToken(value));
}

export function normalizeJobCategory(value: string | undefined | null): string {
  const token = normalizeFilterToken(value);
  if (!token) return '';
  return CATEGORY_LOOKUP.get(token) ?? (value ?? '').trim();
}

export function normalizeJobDistrict(value: string | undefined | null): string {
  const token = normalizeFilterToken(value);
  if (!token) return '';
  return DISTRICT_LOOKUP.get(token) ?? (value ?? '').trim();
}

export function jobMatchesCategory(
  jobCategory: string | undefined | null,
  selectedCategory: string | undefined | null
): boolean {
  if (isAllFilter(selectedCategory)) return true;

  const jobNorm = normalizeJobCategory(jobCategory).toLowerCase();
  const selectedNorm = normalizeJobCategory(selectedCategory).toLowerCase();

  if (!selectedNorm) return true;
  if (!jobNorm) return false;

  return jobNorm === selectedNorm;
}

export function jobMatchesDistrict(
  jobDistrict: string | undefined | null,
  selectedDistrict: string | undefined | null
): boolean {
  if (isAllFilter(selectedDistrict)) return true;

  const jobNorm = normalizeJobDistrict(jobDistrict).toLowerCase();
  const selectedNorm = normalizeJobDistrict(selectedDistrict).toLowerCase();

  if (!selectedNorm) return true;
  if (!jobNorm) return false;

  return jobNorm === selectedNorm;
}

export function jobMatchesSearch(job: Job, searchQuery: string | undefined | null): boolean {
  const q = (searchQuery ?? '').trim().toLowerCase();
  if (!q) return true;

  return (
    (job.title?.toLowerCase().includes(q) ?? false) ||
    (job.company?.toLowerCase().includes(q) ?? false) ||
    (job.description?.toLowerCase().includes(q) ?? false) ||
    (job.location_address?.toLowerCase().includes(q) ?? false) ||
    (job.category?.toLowerCase().includes(q) ?? false) ||
    (job.city?.toLowerCase().includes(q) ?? false) ||
    (job.district?.toLowerCase().includes(q) ?? false)
  );
}

export function filterOpenJobs(
  jobs: Job[],
  options: {
    selectedCategory?: string;
    selectedDistrict?: string;
    searchQuery?: string;
  }
): Job[] {
  const { selectedCategory = 'all', selectedDistrict = 'all', searchQuery = '' } = options;

  return jobs.filter((job) => {
    if (job.status && job.status.toLowerCase() !== 'open') return false;
    if (!jobMatchesDistrict(job.district, selectedDistrict)) return false;
    if (!jobMatchesCategory(job.category, selectedCategory)) return false;
    if (!jobMatchesSearch(job, searchQuery)) return false;
    return true;
  });
}
