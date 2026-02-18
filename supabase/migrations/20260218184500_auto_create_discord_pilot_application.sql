-- Auto-create pilot applications for Discord OAuth signups at the database layer
CREATE OR REPLACE FUNCTION public.auto_create_discord_pilot_application()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  provider text;
  has_discord_provider boolean;
  full_name_value text;
  email_value text;
BEGIN
  provider := COALESCE(NEW.raw_app_meta_data ->> 'provider', '');
  has_discord_provider := COALESCE(NEW.raw_app_meta_data -> 'providers', '[]'::jsonb) ? 'discord';

  -- Only auto-create for Discord OAuth signups
  IF provider <> 'discord' AND NOT has_discord_provider THEN
    RETURN NEW;
  END IF;

  full_name_value := COALESCE(
    NULLIF(NEW.raw_user_meta_data ->> 'full_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'global_name', ''),
    NULLIF(NEW.raw_user_meta_data ->> 'preferred_username', ''),
    split_part(COALESCE(NEW.email, ''), '@', 1),
    'Discord Pilot'
  );

  email_value := COALESCE(
    NULLIF(NEW.email, ''),
    NULLIF(NEW.raw_user_meta_data ->> 'email', ''),
    CONCAT('discord-', NEW.id::text, '@users.noreply.local')
  );

  INSERT INTO public.pilot_applications (
    user_id,
    email,
    full_name,
    vatsim_id,
    ivao_id,
    experience_level,
    preferred_simulator,
    reason_for_joining,
    status
  )
  VALUES (
    NEW.id,
    email_value,
    full_name_value,
    NULL,
    NULL,
    'N/A',
    'N/A',
    'Signed up with Discord OAuth',
    'pending'
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_discord_application ON auth.users;

CREATE TRIGGER on_auth_user_discord_application
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.auto_create_discord_pilot_application();
