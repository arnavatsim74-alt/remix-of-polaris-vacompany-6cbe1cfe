-- Leave of Absence requests
CREATE TABLE public.loa_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pilot_id UUID NOT NULL REFERENCES public.pilots(id) ON DELETE CASCADE,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  reviewed_by UUID REFERENCES public.pilots(id),
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.loa_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own LOA" ON public.loa_requests FOR SELECT
  USING (pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid()));

CREATE POLICY "Users can create own LOA" ON public.loa_requests FOR INSERT
  WITH CHECK (pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage LOA" ON public.loa_requests FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Activity requirement stored in site_settings: key = 'activity_pirep_days', value = number of days
-- No new table needed, we'll use site_settings
