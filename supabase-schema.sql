-- ============================================
-- ESQUEMA DE BASE DE DATOS PARA PLAYSTATS BASKETBALL
-- Ejecutar en Supabase SQL Editor (https://supabase.com/dashboard)
-- ============================================

-- 1. TABLA PROFILES (se crea automaticamente al registrarse)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  display_name text,
  created_at timestamptz default now()
);

-- Trigger para crear perfil automaticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, display_name)
  values (new.id, new.email, split_part(new.email, '@', 1));
  return new;
end;
$$ language plpgsql security definer;

-- Eliminar trigger si existe y recrear
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. TABLA TEAMS
create table if not exists public.teams (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  icon text default '🏀',
  invite_code text unique default encode(gen_random_bytes(6), 'hex'),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

-- 3. TABLA TEAM_MEMBERS
create table if not exists public.team_members (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  user_id uuid references public.profiles(id) on delete cascade not null,
  role text default 'member' check (role in ('owner', 'admin', 'member')),
  joined_at timestamptz default now(),
  unique(team_id, user_id)
);

-- 4. TABLA TEAM_PLAYERS (plantilla del equipo)
create table if not exists public.team_players (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  name text not null,
  number text default '0',
  position text default 'Unselected' check (position in ('Base', 'Alero', 'Joker', 'Unselected')),
  sort_order int default 0,
  created_at timestamptz default now()
);

-- 5. TABLA GAMES (partidos)
create table if not exists public.games (
  id uuid default gen_random_uuid() primary key,
  team_id uuid references public.teams(id) on delete cascade not null,
  created_by uuid references public.profiles(id) on delete set null,
  status text default 'in_progress' check (status in ('in_progress', 'completed')),
  home_team text default 'Local',
  away_team text default 'Visitante',
  home_score int default 0,
  away_score int default 0,
  is_home_team boolean default true,
  current_quarter int default 1,
  game_data jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. FUNCION RPC PARA UNIRSE POR CODIGO DE INVITACION
create or replace function public.join_team_by_invite_code(code text)
returns uuid as $$
declare
  v_team_id uuid;
  v_user_id uuid;
begin
  v_user_id := auth.uid();
  if v_user_id is null then
    raise exception 'No autenticado';
  end if;

  select id into v_team_id from public.teams where invite_code = code;
  if v_team_id is null then
    raise exception 'Codigo de invitacion no valido';
  end if;

  -- Verificar si ya es miembro
  if exists (select 1 from public.team_members where team_id = v_team_id and user_id = v_user_id) then
    return v_team_id;
  end if;

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_user_id, 'member');

  return v_team_id;
end;
$$ language plpgsql security definer;

-- ============================================
-- RLS (Row Level Security) - SEGURIDAD
-- ============================================

-- Habilitar RLS en todas las tablas
alter table public.profiles enable row level security;
alter table public.teams enable row level security;
alter table public.team_members enable row level security;
alter table public.team_players enable row level security;
alter table public.games enable row level security;

-- PROFILES: cada usuario ve su propio perfil
create policy "Users can view own profile" on public.profiles
  for select using (auth.uid() = id);

create policy "Users can update own profile" on public.profiles
  for update using (auth.uid() = id);

-- TEAMS: solo miembros pueden ver equipos
create policy "Members can view their teams" on public.teams
  for select using (
    id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Authenticated users can create teams" on public.teams
  for insert with check (auth.uid() = created_by);

create policy "Only owner can delete team" on public.teams
  for delete using (created_by = auth.uid());

create policy "Members can update team" on public.teams
  for update using (
    id in (select team_id from public.team_members where user_id = auth.uid())
  );

-- TEAM_MEMBERS: miembros ven a otros miembros de sus equipos
create policy "Members can view team members" on public.team_members
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Owner can manage members" on public.team_members
  for insert with check (
    team_id in (select id from public.teams where created_by = auth.uid())
    or user_id = auth.uid()
  );

create policy "Owner can delete members" on public.team_members
  for delete using (
    team_id in (select id from public.teams where created_by = auth.uid())
    or user_id = auth.uid()
  );

-- TEAM_PLAYERS: miembros pueden ver y gestionar jugadores
create policy "Members can view team players" on public.team_players
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Members can insert team players" on public.team_players
  for insert with check (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Members can update team players" on public.team_players
  for update using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Members can delete team players" on public.team_players
  for delete using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

-- GAMES: miembros pueden ver y gestionar partidos
create policy "Members can view team games" on public.games
  for select using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Members can create games" on public.games
  for insert with check (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Members can update games" on public.games
  for update using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );

create policy "Members can delete games" on public.games
  for delete using (
    team_id in (select team_id from public.team_members where user_id = auth.uid())
  );
