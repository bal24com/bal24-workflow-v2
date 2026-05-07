-- bal24 WorkFlow v2 — STEP 21
-- AI 어시스턴트 — 대화 세션 + 메시지 기록
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

-- ============================================================
-- ai_conversations (대화 세션)
-- ============================================================
create table if not exists public.ai_conversations (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null default '새 대화',
  context     text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- ai_messages (메시지 기록)
-- ============================================================
create table if not exists public.ai_messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.ai_conversations(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  created_at      timestamptz not null default now()
);

create index if not exists idx_ai_messages_conv
  on public.ai_messages(conversation_id);
create index if not exists idx_ai_conversations_user
  on public.ai_conversations(user_id);

-- ============================================================
-- RLS — 본인 대화·메시지만 접근
-- ============================================================
alter table public.ai_conversations enable row level security;

drop policy if exists "own_ai_conversations" on public.ai_conversations;
create policy "own_ai_conversations"
  on public.ai_conversations for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table public.ai_messages enable row level security;

drop policy if exists "own_ai_messages" on public.ai_messages;
create policy "own_ai_messages"
  on public.ai_messages for all
  to authenticated
  using (
    conversation_id in (
      select id from public.ai_conversations where user_id = auth.uid()
    )
  )
  with check (
    conversation_id in (
      select id from public.ai_conversations where user_id = auth.uid()
    )
  );

comment on table public.ai_conversations is 'AI 어시스턴트 대화 세션 — 본인 RLS.';
comment on table public.ai_messages is 'AI 메시지 (user/assistant 페어).';
