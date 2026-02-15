-- Create NOTAMs table for admin-managed notices
CREATE TABLE public.notams (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  priority TEXT NOT NULL DEFAULT 'info' CHECK (priority IN ('info', 'warning', 'critical')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.pilots(id)
);

-- Enable RLS
ALTER TABLE public.notams ENABLE ROW LEVEL SECURITY;

-- Admins can manage NOTAMs
CREATE POLICY "Admins can manage NOTAMs"
ON public.notams
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Anyone authenticated can view active NOTAMs
CREATE POLICY "Anyone can view active NOTAMs"
ON public.notams
FOR SELECT
USING (is_active = true AND (expires_at IS NULL OR expires_at > now()));