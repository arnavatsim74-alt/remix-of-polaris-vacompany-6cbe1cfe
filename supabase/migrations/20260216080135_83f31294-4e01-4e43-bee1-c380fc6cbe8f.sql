-- Add image_url column to academy_lessons for embedding images in lesson content
ALTER TABLE public.academy_lessons ADD COLUMN IF NOT EXISTS image_url text DEFAULT NULL;