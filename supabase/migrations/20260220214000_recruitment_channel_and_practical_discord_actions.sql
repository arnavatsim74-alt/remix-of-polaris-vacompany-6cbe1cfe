alter table public.recruitment_exam_sessions
  add column if not exists recruitment_channel_id text;

create index if not exists idx_recruitment_exam_sessions_channel_id
  on public.recruitment_exam_sessions(recruitment_channel_id);
