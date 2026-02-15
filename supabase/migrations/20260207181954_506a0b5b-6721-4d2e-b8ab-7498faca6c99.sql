
-- 1. Drop FK from routes to aircraft.icao_code
ALTER TABLE public.routes DROP CONSTRAINT IF EXISTS routes_aircraft_icao_fkey;

-- 2. Add new columns to aircraft table
ALTER TABLE public.aircraft ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.aircraft ADD COLUMN IF NOT EXISTS min_hours integer DEFAULT 0;
ALTER TABLE public.aircraft ADD COLUMN IF NOT EXISTS livery text;

-- 3. Change pilots.current_rank from enum to text
ALTER TABLE public.pilots ALTER COLUMN current_rank DROP DEFAULT;
ALTER TABLE public.pilots ALTER COLUMN current_rank TYPE text USING current_rank::text;
ALTER TABLE public.pilots ALTER COLUMN current_rank SET DEFAULT 'cadet';

-- 4. Change routes.min_rank from enum to text
ALTER TABLE public.routes ALTER COLUMN min_rank DROP DEFAULT;
ALTER TABLE public.routes ALTER COLUMN min_rank TYPE text USING min_rank::text;
ALTER TABLE public.routes ALTER COLUMN min_rank SET DEFAULT 'cadet';

-- 5. Create rank_configs table
CREATE TABLE public.rank_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  label text NOT NULL,
  min_hours numeric NOT NULL DEFAULT 0,
  max_hours numeric,
  order_index integer NOT NULL DEFAULT 0,
  color text DEFAULT 'bg-slate-500',
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.rank_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view ranks" ON public.rank_configs FOR SELECT USING (true);
CREATE POLICY "Admins can manage ranks" ON public.rank_configs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.rank_configs (name, label, min_hours, max_hours, order_index, color, description) VALUES
  ('cadet', 'Cadet', 0, 25, 1, 'bg-slate-500', 'Starting your aviation journey'),
  ('first_officer', 'First Officer', 25, 50, 2, 'bg-blue-500', 'Gaining experience in the cockpit'),
  ('captain', 'Captain', 50, 100, 3, 'bg-green-500', 'Commanding your own flights'),
  ('senior_captain', 'Senior Captain', 100, 200, 4, 'bg-purple-500', 'Experienced leader of the skies'),
  ('commander', 'Commander', 200, 300, 5, 'bg-yellow-500', 'Elite pilot with exceptional skills'),
  ('vladimir', 'Vladimir', 999, NULL, 10, 'bg-red-500', 'Founder rank'),
  ('vladelets', 'Vladelets', 999, NULL, 11, 'bg-amber-500', 'Owner rank');

-- 6. Create multiplier_configs table
CREATE TABLE public.multiplier_configs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  value numeric NOT NULL,
  description text,
  is_active boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE public.multiplier_configs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view multipliers" ON public.multiplier_configs FOR SELECT USING (true);
CREATE POLICY "Admins can manage multipliers" ON public.multiplier_configs FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

INSERT INTO public.multiplier_configs (name, value, description) VALUES
  ('None', 1.0, 'Standard flight hours'),
  ('Event 1.5x', 1.5, 'Event multiplier'),
  ('ROTW 1.5x', 1.5, 'Route of the week multiplier'),
  ('Event 2x', 2.0, 'Double event multiplier'),
  ('ROTW 2x', 2.0, 'Double ROTW multiplier'),
  ('Featured Route', 1.2, 'Featured route multiplier'),
  ('General 1.5x (Games & Others)', 1.5, 'General multiplier');

-- 7. Drop and recreate calculate_rank with text return type
DROP FUNCTION IF EXISTS public.calculate_rank(numeric);

CREATE FUNCTION public.calculate_rank(hours numeric)
RETURNS text
LANGUAGE plpgsql
STABLE
SET search_path TO 'public'
AS $$
DECLARE
  rank_name text;
BEGIN
  SELECT name INTO rank_name
  FROM public.rank_configs
  WHERE is_active = true AND hours >= min_hours
  ORDER BY min_hours DESC
  LIMIT 1;
  RETURN COALESCE(rank_name, 'cadet');
END;
$$;

-- 8. Update trigger function
CREATE OR REPLACE FUNCTION public.update_pilot_stats_on_pirep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
    new_hours DECIMAL;
    hours_to_add DECIMAL;
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        hours_to_add := NEW.flight_hours * NEW.multiplier;
        UPDATE public.pilots
        SET 
            total_hours = total_hours + hours_to_add,
            total_pireps = total_pireps + 1,
            current_rank = public.calculate_rank(total_hours + hours_to_add),
            updated_at = NOW()
        WHERE id = NEW.pilot_id
        RETURNING total_hours INTO new_hours;
    END IF;
    
    IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
        hours_to_add := OLD.flight_hours * OLD.multiplier;
        UPDATE public.pilots
        SET 
            total_hours = GREATEST(0, total_hours - hours_to_add),
            total_pireps = GREATEST(0, total_pireps - 1),
            current_rank = public.calculate_rank(GREATEST(0, total_hours - hours_to_add)),
            updated_at = NOW()
        WHERE id = OLD.pilot_id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 9. Create trigger
DROP TRIGGER IF EXISTS update_pilot_stats_on_pirep ON public.pireps;
CREATE TRIGGER update_pilot_stats_on_pirep
  AFTER UPDATE OF status ON public.pireps
  FOR EACH ROW
  EXECUTE FUNCTION public.update_pilot_stats_on_pirep();
