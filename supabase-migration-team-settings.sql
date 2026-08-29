-- Add team_settings JSONB column to teams table
-- Default value: empty JSON object (positions will fall back to ['Base', 'Alero', 'Joker'] in the app)
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS team_settings JSONB DEFAULT '{}'::jsonb;

-- Optional: set default positions for existing teams
-- UPDATE public.teams SET team_settings = '{"positions": ["Base", "Alero", "Joker"]}'::jsonb WHERE team_settings = '{}'::jsonb;
