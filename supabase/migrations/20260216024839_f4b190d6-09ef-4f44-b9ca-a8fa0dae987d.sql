
-- Dynamic bonus tiers table
CREATE TABLE public.bonus_tiers (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  min_hours NUMERIC NOT NULL DEFAULT 0,
  card_image_url TEXT,
  text_color TEXT NOT NULL DEFAULT 'text-white',
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.bonus_tiers ENABLE ROW LEVEL SECURITY;

-- Everyone can read tiers
CREATE POLICY "Anyone can read bonus tiers" ON public.bonus_tiers FOR SELECT USING (true);

-- Only admins can manage
CREATE POLICY "Admins can insert bonus tiers" ON public.bonus_tiers FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update bonus tiers" ON public.bonus_tiers FOR UPDATE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete bonus tiers" ON public.bonus_tiers FOR DELETE USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Add admin email
INSERT INTO public.approved_admin_emails (email) VALUES ('arnav4op@gmail.com')
ON CONFLICT DO NOTHING;

-- Seed default tiers
INSERT INTO public.bonus_tiers (name, min_hours, text_color, sort_order) VALUES
  ('Premium', 200, 'text-black', 1),
  ('Essential', 400, 'text-black', 2),
  ('Gold', 600, 'text-black', 3),
  ('Card Platina', 1200, 'text-white', 4),
  ('Prestige', 2000, 'text-white', 5),
  ('Black', 4000, 'text-white', 6);
