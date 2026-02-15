
-- Fix the trigger to use net.http_post (pg_net) instead of non-existent extensions.http_post/http_header
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
        
        -- If rank changed, send Discord notification via edge function using pg_net
        IF old_rank IS DISTINCT FROM new_rank AND old_rank IS NOT NULL THEN
            PERFORM net.http_post(
                url := 'https://spkgconuaautbhgqjwjw.supabase.co/functions/v1/discord-rank-notification',
                body := jsonb_build_object(
                    'pilot_name', pilot_name,
                    'pid', pilot_pid,
                    'old_rank', old_rank,
                    'new_rank', new_rank
                ),
                headers := '{"Content-Type": "application/json"}'::jsonb
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
