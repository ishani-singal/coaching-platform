-- coach_questions: LLM-generated questions surfaced to the coach from client/trainee chat sessions.
-- The coach answers these from personal experience; answers are embedded into Pinecone (qa_<coachId>)
-- and used as RAG context in future persona-chat interactions.

create table if not exists coach_questions (
  question_id   uuid        primary key default gen_random_uuid(),
  coach_id      uuid        not null references user_profiles(user_id) on delete cascade,
  question      text        not null,
  person_type   text        check (person_type in ('client', 'trainee', 'prospect')),
  coaching_type text,
  answer        text,
  answered_at   timestamptz,
  embedded_at   timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists coach_questions_coach_idx
  on coach_questions (coach_id);

create index if not exists coach_questions_unanswered_idx
  on coach_questions (coach_id)
  where answer is null;

alter table coach_questions enable row level security;

create policy "coach owns questions"
  on coach_questions for all
  using (coach_id = auth.uid());
