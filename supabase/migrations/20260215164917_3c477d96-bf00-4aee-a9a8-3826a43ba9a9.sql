
-- ============================================
-- ACADEMY / CREW CENTER TABLES
-- ============================================

-- Courses
CREATE TABLE public.academy_courses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'general',
  thumbnail_url TEXT,
  is_published BOOLEAN DEFAULT false,
  is_required BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.academy_courses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage courses" ON public.academy_courses FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view published courses" ON public.academy_courses FOR SELECT USING (is_published = true);

-- Modules within courses
CREATE TABLE public.academy_modules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.academy_modules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage modules" ON public.academy_modules FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view modules" ON public.academy_modules FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.academy_courses WHERE id = course_id AND is_published = true)
);

-- Lessons (content pages within modules)
CREATE TABLE public.academy_lessons (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  module_id UUID REFERENCES public.academy_modules(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  video_url TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.academy_lessons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage lessons" ON public.academy_lessons FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view lessons" ON public.academy_lessons FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.academy_modules m
    JOIN public.academy_courses c ON c.id = m.course_id
    WHERE m.id = module_id AND c.is_published = true
  )
);

-- Exams
CREATE TABLE public.academy_exams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  passing_score INTEGER DEFAULT 70,
  time_limit_minutes INTEGER,
  max_attempts INTEGER DEFAULT 3,
  is_published BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.academy_exams ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage exams" ON public.academy_exams FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view published exams" ON public.academy_exams FOR SELECT USING (is_published = true);

-- Exam Questions (multiple choice)
CREATE TABLE public.academy_exam_questions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  exam_id UUID REFERENCES public.academy_exams(id) ON DELETE CASCADE NOT NULL,
  question TEXT NOT NULL,
  options JSONB NOT NULL DEFAULT '[]',
  explanation TEXT,
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.academy_exam_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage questions" ON public.academy_exam_questions FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view questions of published exams" ON public.academy_exam_questions FOR SELECT USING (
  EXISTS (SELECT 1 FROM public.academy_exams WHERE id = exam_id AND is_published = true)
);

-- Enrollments
CREATE TABLE public.academy_enrollments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id UUID REFERENCES public.pilots(id) ON DELETE CASCADE NOT NULL,
  course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE NOT NULL,
  status TEXT DEFAULT 'enrolled',
  enrolled_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ,
  UNIQUE(pilot_id, course_id)
);
ALTER TABLE public.academy_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage enrollments" ON public.academy_enrollments FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own enrollments" ON public.academy_enrollments FOR SELECT USING (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);
CREATE POLICY "Users can enroll themselves" ON public.academy_enrollments FOR INSERT WITH CHECK (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);

-- Lesson Progress
CREATE TABLE public.academy_lesson_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id UUID REFERENCES public.pilots(id) ON DELETE CASCADE NOT NULL,
  lesson_id UUID REFERENCES public.academy_lessons(id) ON DELETE CASCADE NOT NULL,
  completed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(pilot_id, lesson_id)
);
ALTER TABLE public.academy_lesson_progress ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage progress" ON public.academy_lesson_progress FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own progress" ON public.academy_lesson_progress FOR SELECT USING (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);
CREATE POLICY "Users can mark own progress" ON public.academy_lesson_progress FOR INSERT WITH CHECK (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);

-- Exam Attempts
CREATE TABLE public.academy_exam_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pilot_id UUID REFERENCES public.pilots(id) ON DELETE CASCADE NOT NULL,
  exam_id UUID REFERENCES public.academy_exams(id) ON DELETE CASCADE NOT NULL,
  score INTEGER,
  passed BOOLEAN DEFAULT false,
  answers JSONB,
  started_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.academy_exam_attempts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage attempts" ON public.academy_exam_attempts FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own attempts" ON public.academy_exam_attempts FOR SELECT USING (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);
CREATE POLICY "Users can create own attempts" ON public.academy_exam_attempts FOR INSERT WITH CHECK (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);
CREATE POLICY "Users can update own attempts" ON public.academy_exam_attempts FOR UPDATE USING (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);

-- Practicals (check rides)
CREATE TABLE public.academy_practicals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  course_id UUID REFERENCES public.academy_courses(id) ON DELETE CASCADE NOT NULL,
  pilot_id UUID REFERENCES public.pilots(id) ON DELETE CASCADE NOT NULL,
  examiner_id UUID REFERENCES public.pilots(id),
  status TEXT DEFAULT 'scheduled',
  scheduled_at TIMESTAMPTZ,
  notes TEXT,
  result_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  completed_at TIMESTAMPTZ
);
ALTER TABLE public.academy_practicals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage practicals" ON public.academy_practicals FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Users can view own practicals" ON public.academy_practicals FOR SELECT USING (
  pilot_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
  OR examiner_id IN (SELECT id FROM pilots WHERE user_id = auth.uid())
);

-- Rosters
CREATE TABLE public.academy_rosters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  roster_date DATE NOT NULL,
  created_by UUID REFERENCES public.pilots(id),
  entries JSONB DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.academy_rosters ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Admins can manage rosters" ON public.academy_rosters FOR ALL USING (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Anyone can view rosters" ON public.academy_rosters FOR SELECT USING (true);

-- ============================================
-- RANK ENHANCEMENTS: aircraft unlocks & perks
-- ============================================
ALTER TABLE public.rank_configs ADD COLUMN aircraft_unlocks TEXT[] DEFAULT '{}';
ALTER TABLE public.rank_configs ADD COLUMN perk_unlocks TEXT[] DEFAULT '{}';

-- ============================================
-- EVENTS: add aircraft field
-- ============================================
ALTER TABLE public.events ADD COLUMN aircraft_icao TEXT;
ALTER TABLE public.events ADD COLUMN aircraft_name TEXT;
