
-- Create function to update pilot streaks when PIREPs are approved
CREATE OR REPLACE FUNCTION public.update_pilot_streak()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  streak_count INT := 0;
  check_date DATE;
  pilot_streak_id UUID;
BEGIN
  -- Only process when a PIREP becomes approved
  IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
    check_date := NEW.flight_date::date;
    
    -- Count consecutive days backwards from the PIREP date
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.pireps 
        WHERE pilot_id = NEW.pilot_id 
          AND status = 'approved' 
          AND flight_date::date = check_date
      ) THEN
        streak_count := streak_count + 1;
        check_date := check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END LOOP;

    -- Upsert the streak record
    INSERT INTO public.pilot_streaks (pilot_id, current_streak, last_pirep_date, longest_streak, updated_at)
    VALUES (
      NEW.pilot_id, 
      streak_count, 
      NEW.flight_date::date, 
      streak_count, 
      NOW()
    )
    ON CONFLICT (pilot_id) DO UPDATE SET
      current_streak = streak_count,
      last_pirep_date = NEW.flight_date::date,
      longest_streak = GREATEST(pilot_streaks.longest_streak, streak_count),
      updated_at = NOW();
  END IF;

  -- If PIREP is un-approved, recalculate
  IF OLD.status = 'approved' AND NEW.status != 'approved' THEN
    -- Recalculate streak from today backwards
    check_date := CURRENT_DATE;
    streak_count := 0;
    LOOP
      IF EXISTS (
        SELECT 1 FROM public.pireps 
        WHERE pilot_id = OLD.pilot_id 
          AND status = 'approved' 
          AND flight_date::date = check_date
          AND id != OLD.id
      ) THEN
        streak_count := streak_count + 1;
        check_date := check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END LOOP;

    UPDATE public.pilot_streaks SET
      current_streak = streak_count,
      last_pirep_date = CASE WHEN streak_count > 0 THEN (
        SELECT MAX(flight_date::date) FROM public.pireps 
        WHERE pilot_id = OLD.pilot_id AND status = 'approved' AND id != OLD.id
      ) ELSE last_pirep_date END,
      updated_at = NOW()
    WHERE pilot_id = OLD.pilot_id;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger on pireps table
CREATE TRIGGER update_streak_on_pirep
AFTER UPDATE ON public.pireps
FOR EACH ROW
EXECUTE FUNCTION public.update_pilot_streak();

-- Also run on insert (for auto-approved PIREPs)
CREATE TRIGGER update_streak_on_pirep_insert
AFTER INSERT ON public.pireps
FOR EACH ROW
EXECUTE FUNCTION public.update_pilot_streak();

-- Backfill existing streaks for pilots with approved PIREPs
DO $$
DECLARE
  p RECORD;
  streak_count INT;
  check_date DATE;
  last_date DATE;
BEGIN
  FOR p IN SELECT DISTINCT pilot_id FROM pireps WHERE status = 'approved' LOOP
    check_date := CURRENT_DATE;
    streak_count := 0;
    
    LOOP
      IF EXISTS (
        SELECT 1 FROM pireps 
        WHERE pilot_id = p.pilot_id 
          AND status = 'approved' 
          AND flight_date::date = check_date
      ) THEN
        streak_count := streak_count + 1;
        check_date := check_date - INTERVAL '1 day';
      ELSE
        EXIT;
      END IF;
    END LOOP;

    SELECT MAX(flight_date::date) INTO last_date 
    FROM pireps WHERE pilot_id = p.pilot_id AND status = 'approved';

    INSERT INTO pilot_streaks (pilot_id, current_streak, last_pirep_date, longest_streak, updated_at)
    VALUES (p.pilot_id, streak_count, last_date, streak_count, NOW())
    ON CONFLICT (pilot_id) DO UPDATE SET
      current_streak = streak_count,
      last_pirep_date = last_date,
      longest_streak = GREATEST(pilot_streaks.longest_streak, streak_count),
      updated_at = NOW();
  END LOOP;
END;
$$;
