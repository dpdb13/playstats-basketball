-- ============================================
-- MIGRATION: Role-based access system
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ============================================

-- 1. Update CHECK constraint to allow 'editor' and 'viewer' roles
-- First drop the existing constraint (name may vary)
DO $$
BEGIN
  -- Try common constraint names
  BEGIN ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS team_members_role_check; EXCEPTION WHEN OTHERS THEN NULL; END;
  BEGIN ALTER TABLE public.team_members DROP CONSTRAINT IF EXISTS check_role; EXCEPTION WHEN OTHERS THEN NULL; END;
  -- Drop any CHECK on role column
  EXECUTE (
    SELECT string_agg('ALTER TABLE public.team_members DROP CONSTRAINT ' || quote_ident(con.conname), '; ')
    FROM pg_constraint con
    JOIN pg_attribute att ON att.attnum = ANY(con.conkey) AND att.attrelid = con.conrelid
    WHERE con.conrelid = 'public.team_members'::regclass
      AND att.attname = 'role'
      AND con.contype = 'c'
  );
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

-- 2. Migrate existing roles BEFORE adding new constraint
-- (must happen first so existing rows are valid for the new constraint)
UPDATE public.team_members SET role = 'editor' WHERE role = 'member';
UPDATE public.team_members SET role = 'editor' WHERE role = 'admin';

-- Add new CHECK constraint (now all existing rows are valid)
ALTER TABLE public.team_members
ADD CONSTRAINT team_members_role_check
CHECK (role IN ('owner', 'editor', 'viewer'));

-- 3. Update RLS policies for write operations to exclude viewers
-- (viewers can read but not write)

-- IMPORTANT: Drop old-named policies that may exist from original schema
-- (names vary between environments, so we drop all possible variants)
DROP POLICY IF EXISTS "Members can update players" ON public.team_players;
DROP POLICY IF EXISTS "Members can insert players" ON public.team_players;
DROP POLICY IF EXISTS "Members can delete players" ON public.team_players;
DROP POLICY IF EXISTS "Members can create games" ON public.games;
DROP POLICY IF EXISTS "Members can update games" ON public.games;
DROP POLICY IF EXISTS "Members can delete games" ON public.games;
DROP POLICY IF EXISTS "Members can update teams" ON public.teams;
DROP POLICY IF EXISTS "Team members can update teams" ON public.teams;

-- Add UPDATE policy on teams table to exclude viewers
DROP POLICY IF EXISTS "Editors can update teams" ON public.teams;
CREATE POLICY "Editors can update teams" ON public.teams
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = teams.id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- Drop and recreate UPDATE policy on team_players
DROP POLICY IF EXISTS "Team members can update players" ON public.team_players;
CREATE POLICY "Team members can update players" ON public.team_players
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = team_players.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- Drop and recreate INSERT policy on team_players
DROP POLICY IF EXISTS "Team members can insert players" ON public.team_players;
CREATE POLICY "Team members can insert players" ON public.team_players
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = team_players.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- Drop and recreate DELETE policy on team_players
DROP POLICY IF EXISTS "Team members can delete players" ON public.team_players;
CREATE POLICY "Team members can delete players" ON public.team_players
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = team_players.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- Drop and recreate INSERT policy on games
DROP POLICY IF EXISTS "Team members can insert games" ON public.games;
CREATE POLICY "Team members can insert games" ON public.games
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = games.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- Drop and recreate UPDATE policy on games
DROP POLICY IF EXISTS "Team members can update games" ON public.games;
CREATE POLICY "Team members can update games" ON public.games
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = games.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- Drop and recreate DELETE policy on games
DROP POLICY IF EXISTS "Team members can delete games" ON public.games;
CREATE POLICY "Team members can delete games" ON public.games
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = games.team_id
      AND user_id = auth.uid()
      AND role IN ('owner', 'editor')
  )
);

-- 4. Create/update RPCs

-- Update join_team_by_invite_code to use 'editor' role + upgrade viewers
CREATE OR REPLACE FUNCTION public.join_team_by_invite_code(code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
  v_existing_role TEXT;
BEGIN
  SELECT id INTO v_team_id FROM public.teams WHERE invite_code = code;
  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid invite code';
  END IF;

  -- Check if already a member
  SELECT role INTO v_existing_role FROM public.team_members
  WHERE team_id = v_team_id AND user_id = auth.uid();

  IF v_existing_role IS NOT NULL THEN
    -- If viewer, upgrade to editor (they got the editor link)
    IF v_existing_role = 'viewer' THEN
      UPDATE public.team_members SET role = 'editor'
      WHERE team_id = v_team_id AND user_id = auth.uid();
    END IF;
    RETURN v_team_id;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_team_id, auth.uid(), 'editor');

  RETURN v_team_id;
END;
$$;

-- Get team info by invite code (already exists, recreate to be safe)
CREATE OR REPLACE FUNCTION public.get_team_by_invite_code(code TEXT)
RETURNS TABLE(id UUID, name TEXT, icon TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.icon
  FROM public.teams t
  WHERE t.invite_code = code;
END;
$$;

-- NEW: Join team as viewer via viewer invite code
CREATE OR REPLACE FUNCTION public.join_team_as_viewer(code TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
DECLARE
  v_team_id UUID;
  v_existing_role TEXT;
BEGIN
  SELECT id INTO v_team_id FROM public.teams
  WHERE team_settings->>'viewer_invite_code' = code;

  IF v_team_id IS NULL THEN
    RAISE EXCEPTION 'Invalid viewer code';
  END IF;

  -- Check if already a member
  SELECT role INTO v_existing_role FROM public.team_members
  WHERE team_id = v_team_id AND user_id = auth.uid();

  IF v_existing_role IS NOT NULL THEN
    -- Don't downgrade existing editors/owners
    RETURN v_team_id;
  END IF;

  INSERT INTO public.team_members (team_id, user_id, role)
  VALUES (v_team_id, auth.uid(), 'viewer');

  RETURN v_team_id;
END;
$$;

-- NEW: Get team info by viewer invite code
CREATE OR REPLACE FUNCTION public.get_team_by_viewer_code(code TEXT)
RETURNS TABLE(id UUID, name TEXT, icon TEXT)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT t.id, t.name, t.icon
  FROM public.teams t
  WHERE t.team_settings->>'viewer_invite_code' = code;
END;
$$;

-- NEW: Get team members with email info
CREATE OR REPLACE FUNCTION public.get_team_members_info(p_team_id UUID)
RETURNS TABLE(user_id UUID, role TEXT, email TEXT, joined_at TIMESTAMPTZ)
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is a member of this team
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Not a member of this team';
  END IF;

  RETURN QUERY
  SELECT tm.user_id, tm.role::TEXT, au.email::TEXT, tm.created_at
  FROM public.team_members tm
  JOIN auth.users au ON au.id = tm.user_id
  WHERE tm.team_id = p_team_id
  ORDER BY
    CASE tm.role
      WHEN 'owner' THEN 1
      WHEN 'editor' THEN 2
      WHEN 'viewer' THEN 3
    END,
    tm.created_at;
END;
$$;

-- NEW: Update a member's role (owner/editor can do this)
CREATE OR REPLACE FUNCTION public.update_member_role(p_team_id UUID, p_user_id UUID, p_role TEXT)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is owner or editor
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Not authorized to manage roles';
  END IF;

  -- Can't change owner's role
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot change owner role';
  END IF;

  -- Can't assign owner role
  IF p_role = 'owner' THEN
    RAISE EXCEPTION 'Cannot assign owner role';
  END IF;

  -- Validate role
  IF p_role NOT IN ('editor', 'viewer') THEN
    RAISE EXCEPTION 'Invalid role';
  END IF;

  UPDATE public.team_members
  SET role = p_role
  WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;

-- NEW: Remove a team member (owner/editor can do this)
CREATE OR REPLACE FUNCTION public.remove_team_member(p_team_id UUID, p_user_id UUID)
RETURNS VOID
LANGUAGE plpgsql SECURITY DEFINER
AS $$
BEGIN
  -- Verify caller is owner or editor
  IF NOT EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = auth.uid() AND role IN ('owner', 'editor')
  ) THEN
    RAISE EXCEPTION 'Not authorized';
  END IF;

  -- Can't remove the owner
  IF EXISTS (
    SELECT 1 FROM public.team_members
    WHERE team_id = p_team_id AND user_id = p_user_id AND role = 'owner'
  ) THEN
    RAISE EXCEPTION 'Cannot remove team owner';
  END IF;

  -- Can't remove yourself (prevents accidental self-removal)
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Cannot remove yourself';
  END IF;

  DELETE FROM public.team_members
  WHERE team_id = p_team_id AND user_id = p_user_id;
END;
$$;

-- 5. Generate viewer_invite_code for existing teams that don't have one
DO $$
DECLARE
  r RECORD;
  new_code TEXT;
BEGIN
  FOR r IN
    SELECT id FROM public.teams
    WHERE team_settings IS NULL
       OR team_settings->>'viewer_invite_code' IS NULL
       OR team_settings->>'viewer_invite_code' = ''
  LOOP
    new_code := encode(gen_random_bytes(6), 'hex');
    UPDATE public.teams
    SET team_settings = COALESCE(team_settings, '{}'::jsonb) || jsonb_build_object('viewer_invite_code', new_code)
    WHERE id = r.id;
  END LOOP;
END $$;
