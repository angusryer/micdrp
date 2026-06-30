-- micdrp — initial schema
-- Apply with: supabase db push
-- Tables mirror the shared DTO contract (packages/shared/src/dto/).
-- Column names use snake_case to match Postgres convention; the client
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
-- recordings — one row per saved take
-- Maps to RecordingDto (packages/shared/src/dto/recording.ts).
-- ============================================================
create table public.recordings (
  id             uuid primary key default uuid_generate_v4(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  title          text not null,
  created_at     timestamptz not null default now(),
  duration_ms    integer not null,
  sample_rate_hz integer not null,
  note_count     integer not null default 0,
  -- score: 0..100 pitch accuracy, null if not yet analysed
  score          numeric(5, 2),
  -- detected key, e.g. "A minor"
  key            text,
  tempo_bpm      numeric(6, 2),
  -- storage paths within the 'takes' bucket (null until uploaded)
  audio_path     text,
  midi_path      text
);

comment on table public.recordings is
  'One row per captured singing take; blobs live in the ''takes'' storage bucket.';

-- Row-Level Security: users may only access their own recordings.
alter table public.recordings enable row level security;

create policy "recordings: owner select"
  on public.recordings for select
  using (auth.uid() = user_id);

create policy "recordings: owner insert"
  on public.recordings for insert
  with check (auth.uid() = user_id);

create policy "recordings: owner update"
  on public.recordings for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "recordings: owner delete"
  on public.recordings for delete
  using (auth.uid() = user_id);

-- Index for the most common query: list a user's recordings newest-first.
create index recordings_user_created
  on public.recordings (user_id, created_at desc);

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
-- Storage bucket: 'takes'
-- Objects are stored at: <user_id>/<recording_id>.<ext>
-- Bucket is private (not public); access is via signed URLs.
-- ============================================================
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'takes',
  'takes',
  false,
  52428800, -- 50 MiB
  array['audio/mp4', 'audio/m4a', 'audio/aac', 'audio/mpeg', 'audio/x-m4a', 'audio/midi', 'audio/mid']
)
on conflict (id) do nothing;

-- Storage RLS policies on storage.objects for the 'takes' bucket.
-- Path convention: <auth.uid()>/<filename>
-- Policies check that the leading path segment equals the authenticated user's id.

create policy "takes: owner select"
  on storage.objects for select
  using (
    bucket_id = 'takes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "takes: owner insert"
  on storage.objects for insert
  with check (
    bucket_id = 'takes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "takes: owner update"
  on storage.objects for update
  using (
    bucket_id = 'takes'
    and auth.uid()::text = (storage.foldername(name))[1]
  )
  with check (
    bucket_id = 'takes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

create policy "takes: owner delete"
  on storage.objects for delete
  using (
    bucket_id = 'takes'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
