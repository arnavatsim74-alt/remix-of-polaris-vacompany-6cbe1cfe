
-- 1. Remove unique constraint on aircraft icao_code to allow same code with different liveries
ALTER TABLE public.aircraft DROP CONSTRAINT aircraft_icao_code_key;

-- 2. Create challenges table
CREATE TABLE public.challenges (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  destination_icao TEXT,
  image_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active challenges" ON public.challenges
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage challenges" ON public.challenges
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Create challenge completions table
CREATE TABLE public.challenge_completions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  challenge_id UUID NOT NULL REFERENCES public.challenges(id) ON DELETE CASCADE,
  pilot_id UUID NOT NULL REFERENCES public.pilots(id) ON DELETE CASCADE,
  pirep_id UUID REFERENCES public.pireps(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(challenge_id, pilot_id)
);

ALTER TABLE public.challenge_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own completions" ON public.challenge_completions
  FOR SELECT USING (pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid()));

CREATE POLICY "Admins can manage completions" ON public.challenge_completions
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 4. Create announcements table
CREATE TABLE public.announcements (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES public.pilots(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active announcements" ON public.announcements
  FOR SELECT USING (is_active = true);

CREATE POLICY "Admins can manage announcements" ON public.announcements
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

-- 5. Create daily_featured_routes table
CREATE TABLE public.daily_featured_routes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID NOT NULL REFERENCES public.routes(id) ON DELETE CASCADE,
  featured_date DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.daily_featured_routes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can view featured routes" ON public.daily_featured_routes
  FOR SELECT USING (true);

CREATE POLICY "Admins can manage featured routes" ON public.daily_featured_routes
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
