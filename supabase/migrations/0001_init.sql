-- micdrp — initial schema
-- Apply with: supabase db push
--
-- Two purpose-built tables back the app:
--   * notes             — the corpus of sung musical-idea memos. melody_json is
--                         the symbolic source of truth for all corpus analysis,
--                         so re-aggregation never re-touches the audio blob.
--   * practice_progress — one lightweight metrics row per finished practice
--                         session (trajectory only; no audio is kept for practice).
--
-- Column names use snake_case to match Postgres convention; the client data
-- layer maps them to camelCase DTOs.

-- ============================================================
-- Extensions
-- ============================================================
create extension if not exists "uuid-ossp";

-- ============================================================
-- profiles — 1:1 with auth.users
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users (id) on delete cascade,
  display_name  text,
  created_at    timestamptz not null default now()
);

comment on table public.profiles is
  'One profile row per auth user, created automatically on sign-up.';

-- Row-Level Security: each user may only see and modify their own profile row.
alter table public.profiles enable row level security;

create policy "profiles: owner select"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles: owner insert"
  on public.profiles for insert
  with check (auth.uid() = id);

create policy "profiles: owner update"
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

create policy "profiles: owner delete"
  on public.profiles for delete
  using (auth.uid() = id);

-- ============================================================
-- notes — one row per sung "note" (a musical-idea memo)
-- Maps to NoteDto (packages/shared/src/dto/note.ts).
-- ============================================================
create table public.notes (
  id              uuid primary key default uuid_generate_v4(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  created_at      timestamptz not null default now(),
  title           text not null,
  duration_ms     integer not null,
  sample_rate_hz  integer not null,
  -- storage path within the 'notes' bucket (null until uploaded)
  audio_path      text,
  -- NoteEvent[] — the symbolic melody; source of truth for all corpus analysis
  melody_json     jsonb not null,
  -- descriptive self-analysis (not a grade):
  key             text,
  tempo_bpm       numeric(6, 2),
  in_tune_ratio   numeric(5, 4),
  mean_cents_error numeric(7, 2),
  note_count      integer not null default 0,
  range_low_midi  integer,
  range_high_midi integer
);

comment on table public.notes is
  'One row per sung musical-idea memo; audio lives in the ''notes'' storage bucket, melody_json is the symbolic source of truth for analysis.';

alter table public.notes enable row level security;

create policy "notes: owner select"
  on public.notes for select
  using (auth.uid() = user_id);

create policy "notes: owner insert"
  on public.notes for insert
  with check (auth.uid() = user_id);

create policy "notes: owner update"
  on public.notes for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "notes: owner delete"
  on public.notes for delete
  using (auth.uid() = user_id);

-- Index for the most common query: list a user's notes newest-first.
create index notes_user_created
  on public.notes (user_id, created_at desc);

-- ============================================================
-- practice_progress — trajectory of training sessions (no audio)
-- Maps to PracticeProgressDto (packages/shared/src/dto/practiceProgress.ts).
-- ============================================================
create table public.practice_progress (
  id               uuid primary key default uuid_generate_v4(),
  user_id          uuid not null references auth.users (id) on delete cascade,
  created_at       timestamptz not null default now(),
  melody_id        text not null,
  root_midi        integer not null,
  note_duration_ms integer not null,
  score            numeric(5, 2),
  in_tune_ratio    numeric(5, 4),
  mean_cents_error numeric(7, 2),
  evaluated_frames integer not null default 0
);

comment on table public.practice_progress is
  'One row per finished practice session; powers the Dashboard training trend. No audio is retained.';

alter table public.practice_progress enable row level security;

create policy "practice_progress: owner select"
  on public.practice_progress for select
  using (auth.uid() = user_id);

create policy "practice_progress: owner insert"
  on public.practice_progress for insert
  with check (auth.uid() = user_id);

create policy "practice_progress: owner update"
  on public.practice_progress for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "practice_progress: owner delete"
  on public.practice_progress for delete
  using (auth.uid() = user_id);

create index practice_progress_user_created
  on public.practice_progress (user_id, created_at desc);

-- ============================================================
-- Trigger: auto-insert profile on new auth user
-- ============================================================
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, created_at)
  values (
    new.id,
    -- prefer the display_name raw_user_meta_data if supplied at sign-up
    (new.raw_user_meta_data ->> 'display_name'),
    now()
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ============================================================
-- RPC: delete_account — hard-delete the caller's own account
-- ============================================================
-- Deletes the caller's auth.users row, which cascades to public.profiles,
-- public.notes and public.practice_progress (all reference auth.users with
-- on delete cascade). The client removes the user's storage blobs before
-- calling this, since storage objects are not covered by the FK cascade.
--
-- SECURITY DEFINER lets an authenticated client delete its own auth user; the
-- body is hard-scoped to auth.uid() so a caller can only ever delete itself.
-- Execute is granted to the `authenticated` role only.
create or replace function public.delete_account()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_account() from public, anon;
grant execute on function public.delete_account() to authenticated;

-- ============================================================
-- Storage bucket: 'notes'
-- Objects are stored at: <user_id>/<note_id>.<ext>
-- Bucket is private (not public); access is via signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'notes',
  'notes',
  false,
  52428800, -- 50 MiB
  array['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/x-m4a', 'audio/wav']
)
on conflict (id) do nothing;

-- Storage RLS policies on storage.objects for the 'notes' bucket.
-- Path convention: <auth.uid()>/<filename>
-- Policies check that the leading path segment equals the authenticated user's id.

create policy "notes: owner select"
  on storage.objects for select
  using (
    bucket_id = 'notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "notes: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "notes: owner update"
  on storage.objects for update
  using (
    bucket_id = 'notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "notes: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'notes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
