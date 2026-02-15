
-- Add day_of_week to routes_of_week for daily route assignments
ALTER TABLE public.routes_of_week ADD COLUMN day_of_week integer;

-- Update existing rows with sequential day numbers within each week
WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY week_start ORDER BY created_at) - 1 AS rn
  FROM public.routes_of_week
)
UPDATE public.routes_of_week
SET day_of_week = numbered.rn
FROM numbered
WHERE routes_of_week.id = numbered.id;

-- Set default and not null
ALTER TABLE public.routes_of_week ALTER COLUMN day_of_week SET DEFAULT 0;
ALTER TABLE public.routes_of_week ALTER COLUMN day_of_week SET NOT NULL;

-- Add unique constraint for one route per day per week
ALTER TABLE public.routes_of_week ADD CONSTRAINT unique_rotw_week_day UNIQUE (week_start, day_of_week);

-- Create site_settings table for configurable settings
CREATE TABLE public.site_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text UNIQUE NOT NULL,
  value text,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read site settings"
ON public.site_settings FOR SELECT USING (true);

CREATE POLICY "Admins can insert site settings"
ON public.site_settings FOR INSERT
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site settings"
ON public.site_settings FOR UPDATE
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site settings"
ON public.site_settings FOR DELETE
USING (public.has_role(auth.uid(), 'admin'));

-- Create site-assets storage bucket for admin uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('site-assets', 'site-assets', true)
ON CONFLICT DO NOTHING;

CREATE POLICY "Anyone can view site assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'site-assets');

CREATE POLICY "Admins can upload site assets"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update site assets"
ON storage.objects FOR UPDATE
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete site assets"
ON storage.objects FOR DELETE
USING (bucket_id = 'site-assets' AND public.has_role(auth.uid(), 'admin'));
