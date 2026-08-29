-- Migration: Enrich player_game_stints with shooting and foul data
-- Run this in Supabase Dashboard > SQL Editor

-- 1. Add new columns to player_game_stints
ALTER TABLE public.player_game_stints
  ADD COLUMN IF NOT EXISTS fg_made integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fg_attempted integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS fouls integer NOT NULL DEFAULT 0;

-- 2. Replace get_stint_analysis RPC with enriched version
CREATE OR REPLACE FUNCTION public.get_stint_analysis(p_team_id uuid)
RETURNS TABLE (
  player_id uuid,
  duration_bucket text,
  stint_count bigint,
  avg_plus_minus numeric,
  min_plus_minus integer,
  max_plus_minus integer,
  total_duration numeric,
  avg_duration numeric,
  total_fg_made bigint,
  total_fg_attempted bigint,
  total_fouls bigint,
  avg_fouls numeric
)
LANGUAGE sql STABLE SECURITY INVOKER
AS $$
  SELECT
    pgs.player_id,
    pgs.duration_bucket,
    COUNT(*)::bigint AS stint_count,
    ROUND(AVG(pgs.plus_minus), 2) AS avg_plus_minus,
    MIN(pgs.plus_minus) AS min_plus_minus,
    MAX(pgs.plus_minus) AS max_plus_minus,
    ROUND(SUM(pgs.duration), 2) AS total_duration,
    ROUND(AVG(pgs.duration), 2) AS avg_duration,
    SUM(pgs.fg_made)::bigint AS total_fg_made,
    SUM(pgs.fg_attempted)::bigint AS total_fg_attempted,
    SUM(pgs.fouls)::bigint AS total_fouls,
    ROUND(AVG(pgs.fouls), 2) AS avg_fouls
  FROM public.player_game_stints pgs
  INNER JOIN public.games g ON g.id = pgs.game_id AND g.status = 'completed'
  WHERE pgs.team_id = p_team_id
  GROUP BY pgs.player_id, pgs.duration_bucket
  ORDER BY pgs.player_id, pgs.duration_bucket;
$$;
