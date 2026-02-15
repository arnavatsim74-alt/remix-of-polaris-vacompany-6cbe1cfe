-- Create Routes of the Week table
CREATE TABLE public.routes_of_week (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  route_id UUID REFERENCES public.routes(id) ON DELETE CASCADE NOT NULL,
  week_start DATE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID REFERENCES public.pilots(id) ON DELETE SET NULL
);

-- Enable RLS
ALTER TABLE public.routes_of_week ENABLE ROW LEVEL SECURITY;

-- Everyone can view ROTW
CREATE POLICY "Routes of week are viewable by authenticated users"
ON public.routes_of_week FOR SELECT
TO authenticated
USING (true);

-- Only admins can manage ROTW
CREATE POLICY "Admins can manage routes of week"
ON public.routes_of_week FOR ALL
TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin')
);

-- Create storage bucket for event banners
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-banners', 'event-banners', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public to view event banners
CREATE POLICY "Event banners are publicly viewable"
ON storage.objects FOR SELECT
USING (bucket_id = 'event-banners');

-- Allow authenticated users to upload event banners
CREATE POLICY "Authenticated users can upload event banners"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'event-banners');

-- Allow authenticated users to delete their uploaded event banners
CREATE POLICY "Authenticated users can delete event banners"
ON storage.objects FOR DELETE
TO authenticated
USING (bucket_id = 'event-banners');