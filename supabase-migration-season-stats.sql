-- ============================================
-- SEASON STATS MIGRATION
-- 4 tablas nuevas + RLS + 4 RPCs
-- Ejecutar en Supabase Dashboard > SQL Editor
-- ============================================

-- ============================================
-- 1. player_game_stats — 1 fila por jugador por partido
-- ============================================
CREATE TABLE IF NOT EXISTS public.player_game_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  player_name text NOT NULL DEFAULT '',
  player_number text NOT NULL DEFAULT '',
  -- Time
  minutes numeric NOT NULL DEFAULT 0,
  stint_count integer NOT NULL DEFAULT 0,
  -- Scoring
  points integer NOT NULL DEFAULT 0,
  fg_made integer NOT NULL DEFAULT 0,
  fg_attempted integer NOT NULL DEFAULT 0,
  ft_made integer NOT NULL DEFAULT 0,
  ft_attempted integer NOT NULL DEFAULT 0,
  pts3_made integer NOT NULL DEFAULT 0,
  pts3_attempted integer NOT NULL DEFAULT 0,
  pts2_made integer NOT NULL DEFAULT 0,
  pts2_attempted integer NOT NULL DEFAULT 0,
  -- Impact
  plus_minus integer NOT NULL DEFAULT 0,
  fouls integer NOT NULL DEFAULT 0,
  best_stint_pm integer,
  worst_stint_pm integer,
  on_court_pm integer NOT NULL DEFAULT 0,
  off_court_pm integer NOT NULL DEFAULT 0,
  on_court_minutes numeric NOT NULL DEFAULT 0,
  off_court_minutes numeric NOT NULL DEFAULT 0,
  -- Game context
  game_date timestamptz,
  our_score integer NOT NULL DEFAULT 0,
  rival_score integer NOT NULL DEFAULT 0,
  result text CHECK (result IN ('win', 'loss', 'draw')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player_id)
);

-- ============================================
-- 2. player_game_stints — 1 fila por stint por jugador por partido
-- ============================================
CREATE TABLE IF NOT EXISTS public.player_game_stints (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  player_id uuid NOT NULL,
  stint_index integer NOT NULL DEFAULT 0,
  duration numeric NOT NULL DEFAULT 0,
  plus_minus integer NOT NULL DEFAULT 0,
  duration_bucket text NOT NULL CHECK (duration_bucket IN ('0-2', '2-4', '4-6', '6-8', '8+')),
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, player_id, stint_index)
);

-- ============================================
-- 3. game_quintet_stats — 1 fila por quinteto unico por partido
-- ============================================
CREATE TABLE IF NOT EXISTS public.game_quintet_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  quintet_key text NOT NULL,
  player_ids uuid[] NOT NULL DEFAULT '{}',
  total_minutes numeric NOT NULL DEFAULT 0,
  points_scored integer NOT NULL DEFAULT 0,
  points_allowed integer NOT NULL DEFAULT 0,
  plus_minus integer NOT NULL DEFAULT 0,
  occurrences integer NOT NULL DEFAULT 1,
  fg_made integer NOT NULL DEFAULT 0,
  fg_attempted integer NOT NULL DEFAULT 0,
  threept_made integer NOT NULL DEFAULT 0,
  threept_attempted integer NOT NULL DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id, quintet_key)
);

-- ============================================
-- 4. game_summary_stats — 1 fila por partido completado
-- ============================================
CREATE TABLE IF NOT EXISTS public.game_summary_stats (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id uuid NOT NULL REFERENCES public.games(id) ON DELETE CASCADE,
  team_id uuid NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  game_date timestamptz,
  our_score integer NOT NULL DEFAULT 0,
  rival_score integer NOT NULL DEFAULT 0,
  our_team_name text NOT NULL DEFAULT '',
  rival_team_name text NOT NULL DEFAULT '',
  is_home boolean NOT NULL DEFAULT true,
  result text NOT NULL CHECK (result IN ('win', 'loss', 'draw')),
  substitutions integer NOT NULL DEFAULT 0,
  lead_changes integer NOT NULL DEFAULT 0,
  ties integer NOT NULL DEFAULT 0,
  biggest_lead_us integer NOT NULL DEFAULT 0,
  biggest_lead_them integer NOT NULL DEFAULT 0,
  partial_scores jsonb DEFAULT '{}',
  phase text,
  matchday integer,
  created_at timestamptz DEFAULT now(),
  UNIQUE(game_id)
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_player_game_stats_team ON public.player_game_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stats_game ON public.player_game_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stints_team ON public.player_game_stints(team_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stints_game ON public.player_game_stints(game_id);
CREATE INDEX IF NOT EXISTS idx_game_quintet_stats_team ON public.game_quintet_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_game_summary_stats_team ON public.game_summary_stats(team_id);

-- ============================================
-- RLS — Misma logica que tabla games
-- ============================================
ALTER TABLE public.player_game_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.player_game_stints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_quintet_stats ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_summary_stats ENABLE ROW LEVEL SECURITY;

-- SELECT: todos los miembros del equipo
CREATE POLICY "Members can view player_game_stats"
  ON public.player_game_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stats.team_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Members can view player_game_stints"
  ON public.player_game_stints FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stints.team_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Members can view game_quintet_stats"
  ON public.game_quintet_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_quintet_stats.team_id AND tm.user_id = auth.uid()
  ));

CREATE POLICY "Members can view game_summary_stats"
  ON public.game_summary_stats FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_summary_stats.team_id AND tm.user_id = auth.uid()
  ));

-- INSERT/UPDATE/DELETE: solo owner/editor
CREATE POLICY "Editors can insert player_game_stats"
  ON public.player_game_stats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can update player_game_stats"
  ON public.player_game_stats FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can delete player_game_stats"
  ON public.player_game_stats FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can insert player_game_stints"
  ON public.player_game_stints FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stints.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can update player_game_stints"
  ON public.player_game_stints FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stints.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can delete player_game_stints"
  ON public.player_game_stints FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = player_game_stints.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can insert game_quintet_stats"
  ON public.game_quintet_stats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_quintet_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can update game_quintet_stats"
  ON public.game_quintet_stats FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_quintet_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can delete game_quintet_stats"
  ON public.game_quintet_stats FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_quintet_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can insert game_summary_stats"
  ON public.game_summary_stats FOR INSERT
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_summary_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can update game_summary_stats"
  ON public.game_summary_stats FOR UPDATE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_summary_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

CREATE POLICY "Editors can delete game_summary_stats"
  ON public.game_summary_stats FOR DELETE
  USING (EXISTS (
    SELECT 1 FROM public.team_members tm
    WHERE tm.team_id = game_summary_stats.team_id AND tm.user_id = auth.uid()
    AND tm.role IN ('owner', 'editor')
  ));

-- ============================================
-- RPCs
-- ============================================

-- 1. get_season_summary: W/L/D, avg scores, avg subs
CREATE OR REPLACE FUNCTION public.get_season_summary(p_team_id uuid)
RETURNS TABLE (
  total_games bigint,
  wins bigint,
  losses bigint,
  draws bigint,
  avg_our_score numeric,
  avg_rival_score numeric,
  avg_substitutions numeric,
  avg_lead_changes numeric,
  total_our_score bigint,
  total_rival_score bigint
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    COUNT(*)::bigint AS total_games,
    COUNT(*) FILTER (WHERE result = 'win')::bigint AS wins,
    COUNT(*) FILTER (WHERE result = 'loss')::bigint AS losses,
    COUNT(*) FILTER (WHERE result = 'draw')::bigint AS draws,
    ROUND(AVG(our_score), 1) AS avg_our_score,
    ROUND(AVG(rival_score), 1) AS avg_rival_score,
    ROUND(AVG(substitutions), 1) AS avg_substitutions,
    ROUND(AVG(lead_changes), 1) AS avg_lead_changes,
    SUM(our_score)::bigint AS total_our_score,
    SUM(rival_score)::bigint AS total_rival_score
  FROM public.game_summary_stats
  WHERE team_id = p_team_id;
$$;

-- 2. get_season_player_stats: stats agregadas por jugador
CREATE OR REPLACE FUNCTION public.get_season_player_stats(p_team_id uuid)
RETURNS TABLE (
  player_id uuid,
  player_name text,
  player_number text,
  games_played bigint,
  total_minutes numeric,
  avg_minutes numeric,
  total_points bigint,
  avg_points numeric,
  total_plus_minus bigint,
  avg_plus_minus numeric,
  total_fouls bigint,
  avg_fouls numeric,
  total_fg_made bigint,
  total_fg_attempted bigint,
  fg_pct numeric,
  total_ft_made bigint,
  total_ft_attempted bigint,
  ft_pct numeric,
  total_pts3_made bigint,
  total_pts3_attempted bigint,
  pts3_pct numeric,
  best_stint_pm integer,
  worst_stint_pm integer,
  total_on_court_pm bigint,
  total_off_court_pm bigint,
  total_on_court_minutes numeric,
  total_off_court_minutes numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    pgs.player_id,
    MAX(pgs.player_name) AS player_name,
    MAX(pgs.player_number) AS player_number,
    COUNT(*)::bigint AS games_played,
    ROUND(SUM(pgs.minutes), 1) AS total_minutes,
    ROUND(AVG(pgs.minutes), 1) AS avg_minutes,
    SUM(pgs.points)::bigint AS total_points,
    ROUND(AVG(pgs.points), 1) AS avg_points,
    SUM(pgs.plus_minus)::bigint AS total_plus_minus,
    ROUND(AVG(pgs.plus_minus), 1) AS avg_plus_minus,
    SUM(pgs.fouls)::bigint AS total_fouls,
    ROUND(AVG(pgs.fouls), 1) AS avg_fouls,
    SUM(pgs.fg_made)::bigint AS total_fg_made,
    SUM(pgs.fg_attempted)::bigint AS total_fg_attempted,
    CASE WHEN SUM(pgs.fg_attempted) > 0
      THEN ROUND(SUM(pgs.fg_made)::numeric / SUM(pgs.fg_attempted) * 100, 1)
      ELSE NULL END AS fg_pct,
    SUM(pgs.ft_made)::bigint AS total_ft_made,
    SUM(pgs.ft_attempted)::bigint AS total_ft_attempted,
    CASE WHEN SUM(pgs.ft_attempted) > 0
      THEN ROUND(SUM(pgs.ft_made)::numeric / SUM(pgs.ft_attempted) * 100, 1)
      ELSE NULL END AS ft_pct,
    SUM(pgs.pts3_made)::bigint AS total_pts3_made,
    SUM(pgs.pts3_attempted)::bigint AS total_pts3_attempted,
    CASE WHEN SUM(pgs.pts3_attempted) > 0
      THEN ROUND(SUM(pgs.pts3_made)::numeric / SUM(pgs.pts3_attempted) * 100, 1)
      ELSE NULL END AS pts3_pct,
    MAX(pgs.best_stint_pm) AS best_stint_pm,
    MIN(pgs.worst_stint_pm) AS worst_stint_pm,
    SUM(pgs.on_court_pm)::bigint AS total_on_court_pm,
    SUM(pgs.off_court_pm)::bigint AS total_off_court_pm,
    ROUND(SUM(pgs.on_court_minutes), 1) AS total_on_court_minutes,
    ROUND(SUM(pgs.off_court_minutes), 1) AS total_off_court_minutes
  FROM public.player_game_stats pgs
  WHERE pgs.team_id = p_team_id
  GROUP BY pgs.player_id
  ORDER BY total_minutes DESC;
$$;

-- 3. get_season_quintet_stats: quintetos agregados cross-game
CREATE OR REPLACE FUNCTION public.get_season_quintet_stats(p_team_id uuid)
RETURNS TABLE (
  quintet_key text,
  player_ids uuid[],
  total_minutes numeric,
  points_scored bigint,
  points_allowed bigint,
  plus_minus bigint,
  occurrences bigint,
  games_count bigint,
  fg_made bigint,
  fg_attempted bigint,
  threept_made bigint,
  threept_attempted bigint
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    gqs.quintet_key,
    (array_agg(gqs.player_ids::text))[1]::uuid[] AS player_ids,
    ROUND(SUM(gqs.total_minutes), 2) AS total_minutes,
    SUM(gqs.points_scored)::bigint AS points_scored,
    SUM(gqs.points_allowed)::bigint AS points_allowed,
    SUM(gqs.plus_minus)::bigint AS plus_minus,
    SUM(gqs.occurrences)::bigint AS occurrences,
    COUNT(DISTINCT gqs.game_id)::bigint AS games_count,
    SUM(gqs.fg_made)::bigint AS fg_made,
    SUM(gqs.fg_attempted)::bigint AS fg_attempted,
    SUM(gqs.threept_made)::bigint AS threept_made,
    SUM(gqs.threept_attempted)::bigint AS threept_attempted
  FROM public.game_quintet_stats gqs
  WHERE gqs.team_id = p_team_id
  GROUP BY gqs.quintet_key
  HAVING SUM(gqs.total_minutes) >= 1
  ORDER BY SUM(gqs.total_minutes) DESC;
$$;

-- 4. get_stint_analysis: stints agrupados por player + duration_bucket
CREATE OR REPLACE FUNCTION public.get_stint_analysis(p_team_id uuid)
RETURNS TABLE (
  player_id uuid,
  duration_bucket text,
  stint_count bigint,
  avg_plus_minus numeric,
  total_duration numeric,
  avg_duration numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    pgs.player_id,
    pgs.duration_bucket,
    COUNT(*)::bigint AS stint_count,
    ROUND(AVG(pgs.plus_minus), 2) AS avg_plus_minus,
    ROUND(SUM(pgs.duration), 2) AS total_duration,
    ROUND(AVG(pgs.duration), 2) AS avg_duration
  FROM public.player_game_stints pgs
  WHERE pgs.team_id = p_team_id
  GROUP BY pgs.player_id, pgs.duration_bucket
  ORDER BY pgs.player_id, pgs.duration_bucket;
$$;
