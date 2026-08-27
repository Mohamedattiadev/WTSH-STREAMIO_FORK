-- Ember Rail redesign - Phase 4 persistence schema.
-- Run this once in the Supabase SQL editor (Project > SQL Editor > New query) after creating
-- the project. Confirmed scope (2026-08-24): profiles, calendar_events, chat_messages.
-- No `notifications` table - real new-episode notifications already come from stremio-core
-- directly (see src/components/NavBar/HorizontalNavBar/NotificationsMenu), so a Supabase copy
-- would just be unused duplicate state.
--
-- Every owner-scoped policy is explicitly `to authenticated` (never left to apply to PUBLIC by
-- default) and every UPDATE policy carries both USING and WITH CHECK, so a user can never
-- reassign a row's user_id to someone else via update - see the `supabase` skill's RLS
-- checklist. `(select auth.uid())` (not bare `auth.uid()`) lets the planner cache it as an
-- initplan instead of re-evaluating per row.

-- profiles: one row per authenticated user.
create table public.profiles (
    id uuid primary key references auth.users (id) on delete cascade,
    display_name text,
    avatar_url text,
    created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view their own profile"
    on public.profiles for select
    to authenticated
    using ( (select auth.uid()) = id );

create policy "Users can insert their own profile"
    on public.profiles for insert
    to authenticated
    with check ( (select auth.uid()) = id );

create policy "Users can update their own profile"
    on public.profiles for update
    to authenticated
    using ( (select auth.uid()) = id )
    with check ( (select auth.uid()) = id );

-- Auto-create a profiles row whenever a new auth user signs up, seeded from whatever
-- display_name/avatar_url the sign-up flow passes as user metadata. SECURITY DEFINER is
-- required here (the trigger runs before the new user's own session exists, so there's no
-- auth.uid() to satisfy the INSERT policy above) - kept minimal, non-exposed to callers other
-- than the trigger itself, and does nothing but insert the one row tied to NEW.id.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
    insert into public.profiles (id, display_name, avatar_url)
    values (new.id, new.raw_user_meta_data ->> 'display_name', new.raw_user_meta_data ->> 'avatar_url');
    return new;
end;
$$;

create trigger on_auth_user_created
    after insert on auth.users
    for each row execute procedure public.handle_new_user();

-- calendar_events: a user's watch-scheduling entries, created either manually from the
-- Calendar screen or by the Chat assistant extracting {title, date} from a request.
create table public.calendar_events (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    title text not null,
    poster_ref text,
    scheduled_date date not null,
    source text not null default 'manual' check (source in ('manual', 'chat')),
    created_at timestamptz not null default now()
);

alter table public.calendar_events enable row level security;

create policy "Users can view their own calendar events"
    on public.calendar_events for select
    to authenticated
    using ( (select auth.uid()) = user_id );

create policy "Users can insert their own calendar events"
    on public.calendar_events for insert
    to authenticated
    with check ( (select auth.uid()) = user_id );

create policy "Users can update their own calendar events"
    on public.calendar_events for update
    to authenticated
    using ( (select auth.uid()) = user_id )
    with check ( (select auth.uid()) = user_id );

create policy "Users can delete their own calendar events"
    on public.calendar_events for delete
    to authenticated
    using ( (select auth.uid()) = user_id );

create index calendar_events_user_id_scheduled_date_idx
    on public.calendar_events (user_id, scheduled_date);

-- chat_messages: "Ask WTS" conversation history, per user.
create table public.chat_messages (
    id uuid primary key default gen_random_uuid(),
    user_id uuid not null references auth.users (id) on delete cascade,
    role text not null check (role in ('user', 'assistant')),
    content text not null,
    created_at timestamptz not null default now()
);

alter table public.chat_messages enable row level security;

create policy "Users can view their own chat messages"
    on public.chat_messages for select
    to authenticated
    using ( (select auth.uid()) = user_id );

create policy "Users can insert their own chat messages"
    on public.chat_messages for insert
    to authenticated
    with check ( (select auth.uid()) = user_id );

create policy "Users can delete their own chat messages"
    on public.chat_messages for delete
    to authenticated
    using ( (select auth.uid()) = user_id );

create index chat_messages_user_id_created_at_idx
    on public.chat_messages (user_id, created_at);
