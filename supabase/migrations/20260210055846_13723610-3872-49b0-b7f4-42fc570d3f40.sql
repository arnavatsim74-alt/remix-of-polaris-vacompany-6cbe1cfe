
-- Update trigger function to use hardcoded Supabase URL (it's public info)
CREATE OR REPLACE FUNCTION public.update_pilot_stats_on_pirep()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    new_hours DECIMAL;
    hours_to_add DECIMAL;
    old_rank TEXT;
    new_rank TEXT;
    pilot_name TEXT;
    pilot_pid TEXT;
BEGIN
    IF NEW.status = 'approved' AND (OLD.status IS NULL OR OLD.status != 'approved') THEN
        hours_to_add := NEW.flight_hours * NEW.multiplier;
        
        -- Get old rank before update
        SELECT current_rank, full_name, pid INTO old_rank, pilot_name, pilot_pid
        FROM public.pilots WHERE id = NEW.pilot_id;
        
        UPDATE public.pilots
        SET 
            total_hours = total_hours + hours_to_add,
            total_pireps = total_pireps + 1,
            current_rank = public.calculate_rank(total_hours + hours_to_add),
            updated_at = NOW()
        WHERE id = NEW.pilot_id
        RETURNING total_hours, current_rank INTO new_hours, new_rank;
        
        -- If rank changed, send Discord notification via edge function
        IF old_rank IS DISTINCT FROM new_rank AND old_rank IS NOT NULL THEN
            PERFORM extensions.http_post(
                'https://spkgconuaautbhgqjwjw.supabase.co/functions/v1/discord-rank-notification',
                jsonb_build_object(
                    'pilot_name', pilot_name,
                    'pid', pilot_pid,
                    'old_rank', old_rank,
                    'new_rank', new_rank
                )::text,
                'application/json',
                ARRAY[extensions.http_header('Content-Type', 'application/json')]
            );
        END IF;
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
$function$;
