-- Job form fields: company, salary, phone
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS company TEXT;
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS salary NUMERIC(12,2);
ALTER TABLE public.jobs ADD COLUMN IF NOT EXISTS phone TEXT;

-- Relax legacy columns when new fields are used
ALTER TABLE public.jobs ALTER COLUMN location_address DROP NOT NULL;
ALTER TABLE public.jobs ALTER COLUMN price DROP NOT NULL;

UPDATE public.jobs SET salary = price WHERE salary IS NULL AND price IS NOT NULL;
UPDATE public.jobs SET city = 'Aktobe' WHERE city IS NULL OR city = 'Актобе';
