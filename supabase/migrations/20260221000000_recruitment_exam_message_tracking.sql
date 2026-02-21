alter table public.recruitment_exam_sessions
  add column if not exists exam_message_id text;

create index if not exists idx_recruitment_exam_sessions_exam_message_id
  on public.recruitment_exam_sessions(exam_message_id);
