-- Apply in your own Supabase SQL editor. Never expose service_role to the browser.
create table if not exists public.sketch_board_backups (
  room_id text primary key,
  revision bigint not null,
  object_path text not null,
  owner_hash text not null,
  editor_hashes text[] not null default '{}',
  backed_up_at timestamptz not null default now()
);

alter table public.sketch_board_backups enable row level security;
-- No anon/authenticated policies: backups are service-role accessible only.

insert into storage.buckets (id, name, public, file_size_limit)
values ('sketch-board-backups', 'sketch-board-backups', false, 20000000)
on conflict (id) do nothing;

-- Realtime policies are restricted to the topic in the server-signed guest JWT.
-- In Supabase Realtime Settings also DISABLE "Allow public access".
create policy "Sketch room members read realtime"
on realtime.messages for select to authenticated
using (
  (select realtime.topic()) = 'sketch:' || (auth.jwt()->>'room_id')
  and realtime.messages.extension in ('broadcast', 'presence')
  and (auth.jwt()->>'room_role') in ('owner', 'editor')
);

create policy "Sketch room members publish realtime"
on realtime.messages for insert to authenticated
with check (
  (select realtime.topic()) = 'sketch:' || (auth.jwt()->>'room_id')
  and realtime.messages.extension in ('broadcast', 'presence')
  and (auth.jwt()->>'room_role') in ('owner', 'editor')
);
