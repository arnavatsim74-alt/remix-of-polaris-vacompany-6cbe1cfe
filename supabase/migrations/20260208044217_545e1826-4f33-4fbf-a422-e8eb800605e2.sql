-- Add livery column to routes table
ALTER TABLE public.routes ADD COLUMN livery text;

-- Add trigger to auto-assign admin role to admin@aflv.ru
CREATE OR REPLACE FUNCTION public.handle_admin_user_signup()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if the new user has the email admin@aflv.ru
  IF NEW.email = 'admin@aflv.ru' THEN
    -- Insert admin role for this user
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin')
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

-- Create trigger on auth.users to call the function when a new user signs up
-- Note: We need to use an event trigger approach since we can't directly attach to auth.users
-- Instead, we'll create a function that admins can call to set up admin users

-- Better approach: Create a table of pre-approved admin emails
CREATE TABLE IF NOT EXISTS public.approved_admin_emails (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text UNIQUE NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.approved_admin_emails ENABLE ROW LEVEL SECURITY;

-- Only admins can manage this table
CREATE POLICY "Admins can manage approved emails" ON public.approved_admin_emails
  FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Anyone can read approved emails" ON public.approved_admin_emails
  FOR SELECT USING (true);

-- Insert the admin email
INSERT INTO public.approved_admin_emails (email) VALUES ('admin@aflv.ru')
ON CONFLICT (email) DO NOTHING;

-- Create a function to check and assign admin role on user creation
-- This will be called from the setup-admin edge function
CREATE OR REPLACE FUNCTION public.check_and_assign_admin_role(user_id_param uuid, user_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if email is in approved list
  IF EXISTS (SELECT 1 FROM public.approved_admin_emails WHERE email = user_email) THEN
    -- Insert admin role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (user_id_param, 'admin')
    ON CONFLICT DO NOTHING;
    RETURN true;
  END IF;
  RETURN false;
END;
$$;