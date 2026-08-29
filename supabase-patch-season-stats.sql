-- ============================================
-- PATCH: Season Stats fixes
-- Run AFTER supabase-migration-season-stats.sql
-- ============================================

-- 1. Composite indexes for RPC performance
CREATE INDEX IF NOT EXISTS idx_player_game_stats_team_player ON public.player_game_stats(team_id, player_id);
CREATE INDEX IF NOT EXISTS idx_player_game_stints_team_player ON public.player_game_stints(team_id, player_id);

-- 2. Exclude soft-deleted games from all RPCs
-- RPCs JOIN with games table to skip status='deleted'

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
    COUNT(*) FILTER (WHERE gss.result = 'win')::bigint AS wins,
    COUNT(*) FILTER (WHERE gss.result = 'loss')::bigint AS losses,
    COUNT(*) FILTER (WHERE gss.result = 'draw')::bigint AS draws,
    ROUND(AVG(gss.our_score), 1) AS avg_our_score,
    ROUND(AVG(gss.rival_score), 1) AS avg_rival_score,
    ROUND(AVG(gss.substitutions), 1) AS avg_substitutions,
    ROUND(AVG(gss.lead_changes), 1) AS avg_lead_changes,
    SUM(gss.our_score)::bigint AS total_our_score,
    SUM(gss.rival_score)::bigint AS total_rival_score
  FROM public.game_summary_stats gss
  INNER JOIN public.games g ON g.id = gss.game_id AND g.status = 'completed'
  WHERE gss.team_id = p_team_id;
$$;

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
  INNER JOIN public.games g ON g.id = pgs.game_id AND g.status = 'completed'
  WHERE pgs.team_id = p_team_id
  GROUP BY pgs.player_id
  ORDER BY total_minutes DESC;
$$;

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
  INNER JOIN public.games g ON g.id = gqs.game_id AND g.status = 'completed'
  WHERE gqs.team_id = p_team_id
  GROUP BY gqs.quintet_key
  HAVING SUM(gqs.total_minutes) >= 1
  ORDER BY SUM(gqs.total_minutes) DESC;
$$;

CREATE OR REPLACE FUNCTION public.get_stint_analysis(p_team_id uuid)
RETURNS TABLE (
  player_id uuid,
  duration_bucket text,
  stint_count bigint,
  avg_plus_minus numeric,
  total_plus_minus bigint,
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
    SUM(pgs.plus_minus)::bigint AS total_plus_minus,
    ROUND(SUM(pgs.duration), 2) AS total_duration,
    ROUND(AVG(pgs.duration), 2) AS avg_duration
  FROM public.player_game_stints pgs
  INNER JOIN public.games g ON g.id = pgs.game_id AND g.status = 'completed'
  WHERE pgs.team_id = p_team_id
  GROUP BY pgs.player_id, pgs.duration_bucket
  ORDER BY pgs.player_id, pgs.duration_bucket;
$$;
