
-- Custom sidebar links managed by admin
CREATE TABLE public.custom_sidebar_links (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT 'Link',
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.custom_sidebar_links ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active sidebar links"
  ON public.custom_sidebar_links FOR SELECT USING (true);

CREATE POLICY "Admins can manage sidebar links"
  ON public.custom_sidebar_links FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- Pilot bonus cards with generated card numbers
CREATE TABLE public.pilot_bonus_cards (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  pilot_id UUID NOT NULL REFERENCES public.pilots(id) ON DELETE CASCADE,
  card_number TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(pilot_id)
);

ALTER TABLE public.pilot_bonus_cards ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Pilots can view their own bonus card"
  ON public.pilot_bonus_cards FOR SELECT
  USING (pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid()));

CREATE POLICY "System can insert bonus cards"
  ON public.pilot_bonus_cards FOR INSERT
  WITH CHECK (pilot_id IN (SELECT id FROM public.pilots WHERE user_id = auth.uid()));

CREATE POLICY "Admins can view all bonus cards"
  ON public.pilot_bonus_cards FOR SELECT
  USING (public.has_role(auth.uid(), 'admin'));
