-- Пюпитр: таблицы, RLS, хранилище, вступление по ссылке

create table public.band (
  id int primary key default 1 check (id = 1),
  name text not null default 'Коллектив',
  invite_token uuid not null default gen_random_uuid()
);
insert into public.band default values;

create table public.positions (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  aliases text[] not null default '{}',
  sort int not null default 0
);

create table public.members (
  user_id uuid primary key references auth.users on delete cascade,
  role text not null default 'musician' check (role in ('owner', 'musician')),
  email text,
  display_name text,
  position_id uuid references public.positions on delete set null,
  joined_at timestamptz not null default now()
);

create table public.pieces (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  duration_sec int check (duration_sec >= 0),
  bpm numeric check (bpm > 0),
  beats_per_bar int check (beats_per_bar > 0)
);

create table public.files (
  id uuid primary key default gen_random_uuid(),
  piece_id uuid not null references public.pieces on delete cascade,
  kind text not null check (kind in ('pdf', 'musicxml')),
  position_id uuid references public.positions, -- null = партитура; позицию с файлами удалить нельзя
  path text not null unique,
  name text not null,
  part_names text[] not null default '{}',
  bars_per_page int[],
  created_at timestamptz not null default now(),
  unique nulls not distinct (piece_id, position_id, kind)
);

create table public.setlists (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  items jsonb not null default '[]' check (jsonb_typeof(items) = 'array')
);

create function public.is_member() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.members where user_id = auth.uid()) $$;

create function public.is_owner() returns boolean
language sql stable security definer set search_path = ''
as $$ select exists (select 1 from public.members where user_id = auth.uid() and role = 'owner') $$;

alter table public.band enable row level security;
alter table public.positions enable row level security;
alter table public.members enable row level security;
alter table public.pieces enable row level security;
alter table public.files enable row level security;
alter table public.setlists enable row level security;

create policy "owner reads band" on public.band for select to authenticated using (public.is_owner());
create policy "owner updates band" on public.band for update to authenticated using (public.is_owner());

create policy "members read" on public.positions for select to authenticated using (public.is_member());
create policy "owner writes" on public.positions for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "members read" on public.pieces for select to authenticated using (public.is_member());
create policy "owner writes" on public.pieces for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "members read" on public.files for select to authenticated using (public.is_member());
create policy "owner writes" on public.files for all to authenticated using (public.is_owner()) with check (public.is_owner());
create policy "members read" on public.setlists for select to authenticated using (public.is_member());
create policy "owner writes" on public.setlists for all to authenticated using (public.is_owner()) with check (public.is_owner());

create policy "members read members" on public.members for select to authenticated using (public.is_member());
create policy "self updates" on public.members for update to authenticated using (user_id = auth.uid());
create policy "owner removes others" on public.members for delete to authenticated
  using (public.is_owner() and user_id <> auth.uid());
-- Вставка только через join_band; в своей строке музыкант меняет лишь инструмент и имя.
revoke insert, update on public.members from anon, authenticated;
grant update (position_id, display_name) on public.members to authenticated;

create function public.join_band(token uuid) returns void
language plpgsql security definer set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not_signed_in';
  end if;
  if not exists (select 1 from public.band where invite_token = token) then
    raise exception 'invalid_invite';
  end if;
  insert into public.members (user_id, email)
  values (auth.uid(), (select email from auth.users where id = auth.uid()))
  on conflict (user_id) do nothing;
end $$;
revoke execute on function public.join_band(uuid) from public, anon;
grant execute on function public.join_band(uuid) to authenticated;

insert into storage.buckets (id, name, public, file_size_limit) values ('scores', 'scores', false, 52428800);
create policy "members read scores" on storage.objects for select to authenticated
  using (bucket_id = 'scores' and public.is_member());
create policy "owner inserts scores" on storage.objects for insert to authenticated
  with check (bucket_id = 'scores' and public.is_owner());
create policy "owner updates scores" on storage.objects for update to authenticated
  using (bucket_id = 'scores' and public.is_owner());
create policy "owner deletes scores" on storage.objects for delete to authenticated
  using (bucket_id = 'scores' and public.is_owner());
