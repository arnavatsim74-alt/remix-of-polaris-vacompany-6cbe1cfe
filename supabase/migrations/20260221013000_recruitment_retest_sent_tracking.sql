alter table public.recruitment_exam_sessions
  add column if not exists retest_sent_at timestamptz;

create index if not exists idx_recruitment_exam_sessions_retest_sent_at
  on public.recruitment_exam_sessions(retest_sent_at);
