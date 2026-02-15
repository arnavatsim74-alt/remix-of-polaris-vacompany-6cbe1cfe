-- Fix search_path on functions that were flagged by linter
CREATE OR REPLACE FUNCTION public.calculate_rank(hours DECIMAL)
RETURNS public.pilot_rank
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
BEGIN
    IF hours >= 200 THEN
        RETURN 'commander';
    ELSIF hours >= 100 THEN
        RETURN 'senior_captain';
    ELSIF hours >= 50 THEN
        RETURN 'captain';
    ELSIF hours >= 25 THEN
        RETURN 'first_officer';
    ELSE
        RETURN 'cadet';
    END IF;
END;
$$;