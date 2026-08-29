import { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { Trophy, BarChart3, Clock, TrendingUp, ChevronDown, ChevronUp, AlertTriangle, Users } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { supabase } from '../lib/supabase';
import { backfillTeamStats, STATS_SCHEMA_VERSION } from '../lib/statsExtractor';
import { formatTime } from '../lib/gameUtils';
import { formatPlusMinus } from '../lib/statsCalculator';

// Normalize RPC row: convert string numbers (bigint from PostgREST) to JS numbers
// Skip fields that should stay as strings (names, numbers, keys, dates)
const STRING_FIELDS = new Set(['player_name', 'player_number', 'player_id', 'quintet_key', 'game_id', 'team_id', 'result', 'duration_bucket']);
function normalizeRow(row) {
  if (!row) return row;
  const result = {};
  for (const [k, v] of Object.entries(row)) {
    if (STRING_FIELDS.has(k)) {
      result[k] = v;
    } else if (typeof v === 'string' && v !== '' && !isNaN(v) && !isNaN(parseFloat(v))) {
      result[k] = Number(v);
    } else {
      result[k] = v;
    }
  }
  return result;
}

// ============================================
// REUSABLE SUB-COMPONENTS
// ============================================

function Section({ title, icon: Icon, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between py-3 px-3 bg-slate-800 rounded-lg min-h-[44px]"
      >
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-orange-400" />}
          {title}
          {badge != null && badge > 0 && <span className="text-[10px] md:text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function PMBadge({ value, size = 'sm' }) {
  const cls = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-400';
  const textSize = size === 'lg' ? 'text-base font-black' : 'text-xs font-bold';
  return <span className={`${cls} ${textSize}`}>{formatPlusMinus(value)}</span>;
}

// ============================================
// MAIN COMPONENT
// ============================================

export default function SeasonStats({ teamId, teamPlayers, canEdit = false }) {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(true);
  const [backfilling, setBackfilling] = useState(false);
  const [backfillProgress, setBackfillProgress] = useState(null);
  const backfillingRef = useRef(false);

  // Data from RPCs
  const [seasonSummary, setSeasonSummary] = useState(null);
  const [playerStats, setPlayerStats] = useState([]);
  const [quintetStats, setQuintetStats] = useState([]);
  const [stintAnalysis, setStintAnalysis] = useState([]);

  // Player stats sorting
  const [sortKey, setSortKey] = useState('total_minutes');
  const [sortAsc, setSortAsc] = useState(false);

  // Quintet sorting mode
  const [quintetSort, setQuintetSort] = useState('plus_minus');

  const loadData = useCallback(async () => {
    try {
      const [summaryRes, playerRes, quintetRes, stintRes] = await Promise.all([
        supabase.rpc('get_season_summary', { p_team_id: teamId }),
        supabase.rpc('get_season_player_stats', { p_team_id: teamId }),
        supabase.rpc('get_season_quintet_stats', { p_team_id: teamId }),
        supabase.rpc('get_stint_analysis', { p_team_id: teamId }),
      ]);

      if (summaryRes.data && summaryRes.data.length > 0) {
        setSeasonSummary(normalizeRow(summaryRes.data[0]));
      } else {
        setSeasonSummary(null);
      }
      setPlayerStats((playerRes.data || []).map(normalizeRow));
      setQuintetStats((quintetRes.data || []).map(normalizeRow));
      setStintAnalysis((stintRes.data || []).map(normalizeRow));
    } catch (err) {
      console.error('Error loading season stats:', err);
    }
  }, [teamId]);

  // Load data + check if backfill or schema upgrade is needed
  useEffect(() => {
    let cancelled = false;

    async function checkAndLoad() {
      setLoading(true);
      try {
        await loadData();

        // Only editors can write stats — viewers skip backfill
        if (!canEdit || cancelled) return;

        // Prevent concurrent backfills
        if (backfillingRef.current) return;

        // Check if we need backfill: are there completed games without stats?
        const [{ data: completedGames }, { data: existingStats }, { data: teamRow }] = await Promise.all([
          supabase.from('games').select('id').eq('team_id', teamId).eq('status', 'completed'),
          supabase.from('game_summary_stats').select('game_id').eq('team_id', teamId),
          supabase.from('teams').select('team_settings').eq('id', teamId).single(),
        ]);

        if (cancelled) return;

        const completedCount = completedGames?.length || 0;
        const statsCount = existingStats?.length || 0;
        const savedVersion = teamRow?.team_settings?.stats_version || 0;
        const needsUpgrade = savedVersion < STATS_SCHEMA_VERSION && completedCount > 0;
        const needsBackfill = completedCount > 0 && statsCount < completedCount;

        if ((needsBackfill || needsUpgrade) && !cancelled) {
          backfillingRef.current = true;
          setBackfilling(true);
          try {
            // force=true when upgrading schema (reprocess all), normal backfill otherwise
            await backfillTeamStats(teamId, (progress) => {
              if (!cancelled) setBackfillProgress(progress);
            }, needsUpgrade);
          } finally {
            backfillingRef.current = false;
            if (!cancelled) {
              setBackfilling(false);
              setBackfillProgress(null);
            }
          }

          // Update stats_version in team_settings after successful reprocess
          if (needsUpgrade && !cancelled) {
            const freshSettings = { ...(teamRow?.team_settings || {}), stats_version: STATS_SCHEMA_VERSION };
            await supabase.from('teams').update({ team_settings: freshSettings }).eq('id', teamId);
          }

          // Reload data after backfill
          if (!cancelled) await loadData();
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    checkAndLoad();
    return () => { cancelled = true; };
  }, [teamId, loadData, canEdit]);

  // ---- Sorted player stats ----
  const sortedPlayerStats = useMemo(() => {
    const sorted = [...playerStats];
    sorted.sort((a, b) => {
      const aVal = a[sortKey] ?? 0;
      const bVal = b[sortKey] ?? 0;
      return sortAsc ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  }, [playerStats, sortKey, sortAsc]);

  // ---- Sorted quintets ----
  const sortedQuintets = useMemo(() => {
    const sorted = [...quintetStats];
    if (quintetSort === 'plus_minus') sorted.sort((a, b) => b.plus_minus - a.plus_minus);
    else if (quintetSort === 'offense') sorted.sort((a, b) => {
      const aOff = a.total_minutes > 0 ? a.points_scored / a.total_minutes : 0;
      const bOff = b.total_minutes > 0 ? b.points_scored / b.total_minutes : 0;
      return bOff - aOff;
    });
    else if (quintetSort === 'defense') sorted.sort((a, b) => {
      const aDef = a.total_minutes > 0 ? a.points_allowed / a.total_minutes : 0;
      const bDef = b.total_minutes > 0 ? b.points_allowed / b.total_minutes : 0;
      return aDef - bDef;
    });
    else if (quintetSort === 'minutes') sorted.sort((a, b) => b.total_minutes - a.total_minutes);
    return sorted;
  }, [quintetStats, quintetSort]);

  // ---- Team averages for player stats table ----
  const teamAvg = useMemo(() => {
    if (playerStats.length === 0) return null;
    const n = playerStats.length;
    const sum = (key) => playerStats.reduce((acc, p) => acc + (Number(p[key]) || 0), 0);

    const totalFgMade = sum('total_fg_made');
    const totalFgAtt = sum('total_fg_attempted');
    const total3Made = sum('total_pts3_made');
    const total3Att = sum('total_pts3_attempted');
    const total2Made = totalFgMade - total3Made;
    const total2Att = totalFgAtt - total3Att;
    const totalFtMade = sum('total_ft_made');
    const totalFtAtt = sum('total_ft_attempted');

    return {
      avgMinutes: sum('avg_minutes'),
      avgPoints: Math.round(sum('avg_points') * 10) / 10,
      avgPM: Math.round(sum('avg_plus_minus') / n * 100) / 100,
      fgMade: totalFgMade, fgAtt: totalFgAtt,
      fgPct: totalFgAtt > 0 ? Math.round(totalFgMade / totalFgAtt * 1000) / 10 : null,
      pts3Made: total3Made, pts3Att: total3Att,
      pts3Pct: total3Att > 0 ? Math.round(total3Made / total3Att * 1000) / 10 : null,
      pts2Made: total2Made, pts2Att: total2Att,
      pts2Pct: total2Att > 0 ? Math.round(total2Made / total2Att * 1000) / 10 : null,
      ftMade: totalFtMade, ftAtt: totalFtAtt,
      ftPct: totalFtAtt > 0 ? Math.round(totalFtMade / totalFtAtt * 1000) / 10 : null,
      avgFouls: Math.round(sum('avg_fouls') / n * 10) / 10,
    };
  }, [playerStats]);

  // ---- Stint analysis per player ----
  const stintByPlayer = useMemo(() => {
    const map = {};
    stintAnalysis.forEach(s => {
      if (!map[s.player_id]) map[s.player_id] = [];
      map[s.player_id].push(s);
    });
    return map;
  }, [stintAnalysis]);

  // ---- Team-level stint analysis ----
  const teamStintBuckets = useMemo(() => {
    const buckets = {};
    stintAnalysis.forEach(s => {
      if (!buckets[s.duration_bucket]) {
        buckets[s.duration_bucket] = { count: 0, totalPM: 0 };
      }
      buckets[s.duration_bucket].count += Number(s.stint_count);
      buckets[s.duration_bucket].totalPM += Number(s.total_plus_minus || 0) || (Number(s.avg_plus_minus) * Number(s.stint_count));
    });

    const order = ['0-2', '2-4', '4-6', '6-8', '8+'];
    return order.map(bucket => {
      const b = buckets[bucket];
      if (!b || b.count === 0) return { bucket, count: 0, avgPM: 0 };
      const avgPM = b.totalPM / b.count;
      return {
        bucket,
        count: b.count,
        avgPM: Math.round(avgPM * 100) / 100,
      };
    });
  }, [stintAnalysis]);

  // Helper: get player name
  const getPlayerName = useCallback((playerId) => {
    const p = teamPlayers.find(tp => tp.id === playerId);
    if (p) return `#${p.number} ${p.name}`;
    const found = playerStats.find(s => s.player_id === playerId);
    if (found) return `#${found.player_number} ${found.player_name}`;
    return '?';
  }, [teamPlayers, playerStats]);

  // Helper: handle column sort
  const handleSort = (key) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  const sortIndicator = (key) => {
    if (sortKey !== key) return '';
    return sortAsc ? ' \u25B2' : ' \u25BC';
  };

  // ---- Loading state ----
  if (loading) {
    return (
      <div className="text-center py-8 text-slate-500">
        <div className="animate-spin w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-sm">{t.loading}</p>
      </div>
    );
  }

  // ---- Backfilling state ----
  if (backfilling) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin w-6 h-6 border-2 border-orange-400 border-t-transparent rounded-full mx-auto mb-2"></div>
        <p className="text-sm text-orange-400 font-bold">{t.seasonBackfilling || 'Processing game stats...'}</p>
        {backfillProgress && (
          <p className="text-xs text-slate-400 mt-1">
            {backfillProgress.current} / {backfillProgress.total}
          </p>
        )}
      </div>
    );
  }

  // ---- No data state ----
  if (!seasonSummary || seasonSummary.total_games === 0) {
    return (
      <div className="text-center py-8 text-slate-500">
        <BarChart3 className="w-10 h-10 mx-auto mb-3 opacity-30" />
        <p className="text-sm">{!canEdit ? (t.seasonNoDataViewer || 'Stats haven\'t been processed yet') : (t.seasonNoData || 'No completed games yet')}</p>
        <p className="text-xs mt-1">{!canEdit ? (t.seasonNoDataViewerHint || 'An editor needs to open this tab to process game stats') : (t.seasonNoDataHint || 'Stats will appear after finishing your first game')}</p>
      </div>
    );
  }

  const totalGames = Number(seasonSummary.total_games);
  const wins = Number(seasonSummary.wins);
  const losses = Number(seasonSummary.losses);
  const draws = Number(seasonSummary.draws);

  return (
    <div className="space-y-0">
      {/* Low sample warning */}
      {totalGames < 5 && (
        <div className="bg-amber-900/30 border border-amber-600/30 rounded-lg p-3 mb-3 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <p className="text-xs text-amber-300">{t.seasonLowSample || 'With fewer than 5 games the data may not be very representative. The more games, the more reliable the stats.'}</p>
        </div>
      )}


      {/* a) Season Summary */}
      <Section title={t.seasonSummary || 'Season Summary'} icon={Trophy} defaultOpen={true}>
        <div className="bg-slate-800 rounded-lg p-4">
          {/* Record */}
          <div className="flex justify-center gap-4 mb-3">
            <div className="text-center">
              <div className="text-2xl font-black text-emerald-400">{wins}</div>
              <div className="text-[10px] text-slate-500 uppercase">{t.seasonWins || 'W'}</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black text-red-400">{losses}</div>
              <div className="text-[10px] text-slate-500 uppercase">{t.seasonLosses || 'L'}</div>
            </div>
            {draws > 0 && (
              <div className="text-center">
                <div className="text-2xl font-black text-slate-400">{draws}</div>
                <div className="text-[10px] text-slate-500 uppercase">{t.seasonDraws || 'D'}</div>
              </div>
            )}
          </div>

          {/* Win % bar */}
          <div className="w-full h-2 bg-slate-700 rounded-full mb-3 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full"
              style={{ width: `${totalGames > 0 ? (wins / totalGames) * 100 : 0}%` }}
            />
          </div>

          {/* Averages */}
          <div className="grid grid-cols-3 gap-2">
            <div className="bg-slate-700/50 rounded-lg p-2 text-center">
              <div className="text-lg font-black text-white">{seasonSummary.avg_our_score}</div>
              <div className="text-[9px] text-slate-500 uppercase">{t.seasonAvgScored || 'Avg scored'}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-2 text-center">
              <div className="text-lg font-black text-white">{seasonSummary.avg_rival_score}</div>
              <div className="text-[9px] text-slate-500 uppercase">{t.seasonAvgAllowed || 'Avg allowed'}</div>
            </div>
            <div className="bg-slate-700/50 rounded-lg p-2 text-center">
              <div className={`text-lg font-black ${Number(seasonSummary.avg_our_score) > Number(seasonSummary.avg_rival_score) ? 'text-emerald-400' : Number(seasonSummary.avg_our_score) < Number(seasonSummary.avg_rival_score) ? 'text-red-400' : 'text-slate-400'}`}>
                {(Number(seasonSummary.avg_our_score) - Number(seasonSummary.avg_rival_score)).toFixed(1)}
              </div>
              <div className="text-[9px] text-slate-500 uppercase">{t.seasonAvgDiff || 'Avg +/-'}</div>
            </div>
          </div>

          <div className="flex justify-center gap-4 mt-3 text-[10px] text-slate-500">
            <span>{totalGames} {t.seasonGamesPlayed || 'games'}</span>
            <span>{seasonSummary.avg_substitutions} {t.seasonAvgSubs || 'avg subs'}</span>
          </div>
        </div>
      </Section>

      {/* b) Player Season Stats */}
      <Section title={t.seasonPlayerStats || 'Player Stats'} icon={BarChart3} badge={playerStats.length}>
        {playerStats.length === 0
          ? <p className="text-xs text-slate-500 px-2">{t.noData}</p>
          : (
            <div className="bg-slate-800 rounded-lg overflow-x-auto">
              <table className="text-[10px] md:text-xs" style={{ minWidth: '700px' }}>
                <thead>
                  <tr className="text-slate-500 border-b border-slate-700">
                    <th className="py-2 px-2 text-left sticky left-0 bg-slate-800 z-10">{t.player}</th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('games_played')}>
                      {t.seasonGP || 'GP'}{sortIndicator('games_played')}
                    </th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('avg_minutes')}>
                      {t.seasonMPG || 'MPG'}{sortIndicator('avg_minutes')}
                    </th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('avg_points')}>
                      {t.seasonPPG || 'PPG'}{sortIndicator('avg_points')}
                    </th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('avg_plus_minus')}>
                      +/-{sortIndicator('avg_plus_minus')}
                    </th>
                    <th className="py-2 px-1 text-center whitespace-nowrap">FG</th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('fg_pct')}>
                      FG%{sortIndicator('fg_pct')}
                    </th>
                    <th className="py-2 px-1 text-center whitespace-nowrap">3PT</th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('pts3_pct')}>
                      3PT%{sortIndicator('pts3_pct')}
                    </th>
                    <th className="py-2 px-1 text-center whitespace-nowrap">2PT</th>
                    <th className="py-2 px-1 text-center whitespace-nowrap">2PT%</th>
                    <th className="py-2 px-1 text-center whitespace-nowrap">FT</th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('ft_pct')}>
                      FT%{sortIndicator('ft_pct')}
                    </th>
                    <th className="py-2 px-1 text-center cursor-pointer whitespace-nowrap" onClick={() => handleSort('avg_fouls')}>
                      {t.seasonFPG || 'FPG'}{sortIndicator('avg_fouls')}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedPlayerStats.map(p => (
                    <PlayerStatsRow key={p.player_id} p={p} t={t} />
                  ))}
                </tbody>
                {teamAvg && (
                  <tfoot>
                    <tr className="border-t-2 border-orange-500/50 bg-slate-700/50">
                      <td className="py-2 px-2 sticky left-0 bg-slate-700/50 z-10">
                        <span className="text-orange-400 font-black text-[10px] whitespace-nowrap">{t.seasonTeamAvg || 'TEAM'}</span>
                      </td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">-</td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">{formatTime(teamAvg.avgMinutes)}</td>
                      <td className="py-2 px-1 text-center text-orange-400 font-bold">{teamAvg.avgPoints}</td>
                      <td className="py-2 px-1 text-center"><PMBadge value={teamAvg.avgPM} /></td>
                      <td className="py-2 px-1 text-center text-slate-400 whitespace-nowrap">{teamAvg.fgMade}/{teamAvg.fgAtt}</td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">{teamAvg.fgPct != null ? `${teamAvg.fgPct}%` : '-'}</td>
                      <td className="py-2 px-1 text-center text-indigo-400 whitespace-nowrap">{teamAvg.pts3Made}/{teamAvg.pts3Att}</td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">{teamAvg.pts3Pct != null ? `${teamAvg.pts3Pct}%` : '-'}</td>
                      <td className="py-2 px-1 text-center text-sky-400 whitespace-nowrap">{teamAvg.pts2Made}/{teamAvg.pts2Att}</td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">{teamAvg.pts2Pct != null ? `${teamAvg.pts2Pct}%` : '-'}</td>
                      <td className="py-2 px-1 text-center text-emerald-400 whitespace-nowrap">{teamAvg.ftMade}/{teamAvg.ftAtt}</td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">{teamAvg.ftPct != null ? `${teamAvg.ftPct}%` : '-'}</td>
                      <td className="py-2 px-1 text-center text-orange-300 font-bold">{teamAvg.avgFouls}</td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}
      </Section>

      {/* c) Stint Analysis */}
      <Section title={t.seasonStintAnalysis || 'Stint Analysis'} icon={Clock}>
        {/* Team-level buckets */}
        <div className="bg-slate-800 rounded-lg p-3 mb-2">
          <div className="text-xs font-bold text-slate-400 mb-2">{t.seasonTeamByDuration || 'Team avg +/- by stint duration'}</div>
          {teamStintBuckets.every(b => b.count === 0)
            ? <p className="text-xs text-slate-500 px-2">{t.seasonNoData || 'No data'}</p>
            : <div className="flex gap-1.5">
            {teamStintBuckets.map(b => {
              if (b.count === 0) return null;
              const bgColor = b.avgPM > 0 ? 'bg-emerald-900/40' : b.avgPM < 0 ? 'bg-red-900/40' : 'bg-slate-700';
              return (
                <div key={b.bucket} className={`flex-1 ${bgColor} rounded-lg p-2 text-center`}>
                  <div className="text-[10px] text-slate-400 font-bold">{b.bucket}'</div>
                  <div className={`text-sm font-black ${b.avgPM > 0 ? 'text-emerald-400' : b.avgPM < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                    {b.avgPM > 0 ? '+' : ''}{b.avgPM}
                  </div>
                  <div className="text-[9px] text-slate-500">{b.count} stints</div>
                </div>
              );
            })}
          </div>}
        </div>

        {/* Per-player stint breakdown */}
        {playerStats.length > 0 && (
          <div className="space-y-1.5">
            {sortedPlayerStats.map(p => {
              const buckets = stintByPlayer[p.player_id];
              if (!buckets || buckets.length === 0) return null;
              return (
                <PlayerStintRow
                  key={p.player_id}
                  player={p}
                  buckets={buckets}
                  t={t}
                />
              );
            })}
          </div>
        )}

        {/* Rotation insights */}
        <RotationInsights
          stintByPlayer={stintByPlayer}
          playerStats={sortedPlayerStats}
          teamStintBuckets={teamStintBuckets}
          totalGames={totalGames}
          t={t}
        />
      </Section>

      {/* d) Best Lineups */}
      <Section title={t.seasonBestLineups || 'Best Lineups'} icon={Users} badge={quintetStats.length}>
        {quintetStats.length === 0
          ? <p className="text-xs text-slate-500 px-2">{t.noData}</p>
          : (
            <>
              {/* Sort tabs */}
              <div className="flex gap-1 mb-2">
                {[
                  { key: 'plus_minus', label: '+/-' },
                  { key: 'offense', label: t.seasonOffense || 'OFF' },
                  { key: 'defense', label: t.seasonDefense || 'DEF' },
                  { key: 'minutes', label: t.seasonMinutes || 'MIN' },
                ].map(opt => (
                  <button
                    key={opt.key}
                    onClick={() => setQuintetSort(opt.key)}
                    className={`px-2 py-1 rounded text-[10px] font-bold ${quintetSort === opt.key ? 'bg-orange-600 text-white' : 'bg-slate-700 text-slate-400'}`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>

              <div className="space-y-2">
                {sortedQuintets.slice(0, 10).map((q, i) => {
                  const offRating = q.total_minutes > 0 ? (q.points_scored / q.total_minutes).toFixed(2) : '0';
                  const defRating = q.total_minutes > 0 ? (q.points_allowed / q.total_minutes).toFixed(2) : '0';
                  const playerNames = (q.player_ids || []).map(id => getPlayerName(id)).join(', ');

                  return (
                    <div key={q.quintet_key} className="bg-slate-800 rounded-lg p-3">
                      <div className="flex items-start justify-between mb-1">
                        <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
                        <div className="text-right">
                          {quintetSort === 'plus_minus' && <PMBadge value={q.plus_minus} size="lg" />}
                          {quintetSort === 'offense' && <span className="text-sm font-black text-orange-400">{offRating} pts/min</span>}
                          {quintetSort === 'defense' && <span className="text-sm font-black text-blue-400">{defRating} pts/min</span>}
                          {quintetSort === 'minutes' && <span className="text-sm font-black text-white">{formatTime(q.total_minutes)}</span>}
                        </div>
                      </div>
                      <div className="text-[11px] md:text-xs text-slate-300 leading-relaxed">{playerNames}</div>
                      <div className="flex gap-3 mt-1 text-[10px] md:text-xs text-slate-500">
                        <span>{formatTime(q.total_minutes)}</span>
                        <span>{q.points_scored} {t.scored}</span>
                        <span>{q.points_allowed} {t.allowed}</span>
                        {quintetSort !== 'plus_minus' && <PMBadge value={q.plus_minus} />}
                        <span>{q.games_count}G</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          )}
      </Section>

      {/* e) Player Impact */}
      <Section title={t.seasonPlayerImpact || 'Player Impact'} icon={TrendingUp}>
        {playerStats.length === 0
          ? <p className="text-xs text-slate-500 px-2">{t.noData}</p>
          : (
            <div className="space-y-1">
              <div className="grid grid-cols-[1fr_auto_auto] gap-1 text-[10px] md:text-xs text-slate-500 px-3 mb-1">
                <span>{t.player}</span>
                <span className="text-center w-16">{t.onCourtPM || 'On +/-'}</span>
                <span className="text-center w-16">{t.offCourtPM || 'Off +/-'}</span>
              </div>
              {[...playerStats]
                .map(p => {
                  const onPM = Number(p.total_on_court_pm) || 0;
                  const offPM = Number(p.total_off_court_pm) || 0;
                  return { ...p, onPM, offPM };
                })
                .sort((a, b) => b.onPM - a.onPM)
                .map(p => (
                  <div key={p.player_id} className="grid grid-cols-[1fr_auto_auto] gap-1 bg-slate-800 rounded px-3 py-2 text-xs items-center">
                    <span className="text-slate-300 truncate">#{p.player_number} {p.player_name}</span>
                    <span className="text-center w-16"><PMBadge value={p.onPM} /></span>
                    <span className="text-center w-16"><PMBadge value={p.offPM} /></span>
                  </div>
                ))}
              <div className="bg-slate-700/30 rounded-lg p-2.5 mt-2 text-[10px] md:text-xs text-slate-500">
                <p>{t.seasonImpactSimpleExplain || 'Score change across the season when this player is on court vs off court.'}</p>
              </div>
            </div>
          )}
      </Section>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function PlayerStatsRow({ p, t }) {
  const [expanded, setExpanded] = useState(false);

  // Compute 2PT from FG - 3PT
  const pts2Made = (p.total_fg_made || 0) - (p.total_pts3_made || 0);
  const pts2Attempted = (p.total_fg_attempted || 0) - (p.total_pts3_attempted || 0);
  const pts2Pct = pts2Attempted > 0 ? Math.round(pts2Made / pts2Attempted * 1000) / 10 : null;

  return (
    <>
      <tr
        className="border-b border-slate-700/50 cursor-pointer hover:bg-slate-700/30"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="py-2 px-2 sticky left-0 bg-slate-800 z-10">
          <span className="text-slate-300 font-bold whitespace-nowrap">#{p.player_number} {p.player_name}</span>
        </td>
        <td className="py-2 px-1 text-center text-white">{p.games_played}</td>
        <td className="py-2 px-1 text-center text-white">{formatTime(p.avg_minutes)}</td>
        <td className="py-2 px-1 text-center text-orange-400 font-bold">{p.avg_points}</td>
        <td className="py-2 px-1 text-center"><PMBadge value={p.avg_plus_minus} /></td>
        <td className="py-2 px-1 text-center text-slate-400 whitespace-nowrap">{p.total_fg_made}/{p.total_fg_attempted}</td>
        <td className="py-2 px-1 text-center text-slate-300">{p.fg_pct != null ? `${p.fg_pct}%` : '-'}</td>
        <td className="py-2 px-1 text-center text-indigo-400 whitespace-nowrap">{p.total_pts3_made}/{p.total_pts3_attempted}</td>
        <td className="py-2 px-1 text-center text-indigo-300">{p.pts3_pct != null ? `${p.pts3_pct}%` : '-'}</td>
        <td className="py-2 px-1 text-center text-sky-400 whitespace-nowrap">{pts2Made}/{pts2Attempted}</td>
        <td className="py-2 px-1 text-center text-sky-300">{pts2Pct != null ? `${pts2Pct}%` : '-'}</td>
        <td className="py-2 px-1 text-center text-emerald-400 whitespace-nowrap">{p.total_ft_made}/{p.total_ft_attempted}</td>
        <td className="py-2 px-1 text-center text-emerald-300">{p.ft_pct != null ? `${p.ft_pct}%` : '-'}</td>
        <td className="py-2 px-1 text-center text-slate-300">{p.avg_fouls}</td>
      </tr>
      {expanded && (
        <tr>
          <td colSpan={14} className="px-2 py-2 bg-slate-700">
            <div className="grid grid-cols-3 gap-2 text-[10px] text-slate-400">
              <div>
                <span className="text-slate-500">{t.seasonTotalPts || 'Total pts'}: </span>
                <span className="text-white font-bold">{p.total_points}</span>
              </div>
              <div>
                <span className="text-slate-500">{t.bestStintLabel || 'Best stint'}: </span>
                <span className="text-emerald-400 font-bold">{p.best_stint_pm != null ? formatPlusMinus(p.best_stint_pm) : '-'}</span>
              </div>
              <div>
                <span className="text-slate-500">{t.worstStintLabel || 'Worst stint'}: </span>
                <span className="text-red-400 font-bold">{p.worst_stint_pm != null ? formatPlusMinus(p.worst_stint_pm) : '-'}</span>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}

function PlayerStintRow({ player, buckets, t }) {
  const [expanded, setExpanded] = useState(false);

  // Optimal = bucket with highest avg +/- (no minimum stint count)
  // Fatigue = first bucket where avg +/- drops >2 points vs previous bucket
  const ordered = ['0-2', '2-4', '4-6', '6-8', '8+'];
  const bucketMap = {};
  buckets.forEach(b => { bucketMap[b.duration_bucket] = b; });

  let fatigueAt = null;
  let optimalBucket = null;
  let bestAvgPM = -Infinity;

  ordered.forEach((bucket, i) => {
    const b = bucketMap[bucket];
    if (!b) return;

    const avgPM = Number(b.avg_plus_minus) ?? 0;

    if (avgPM > bestAvgPM) {
      bestAvgPM = avgPM;
      optimalBucket = bucket;
    }

    if (i > 0 && !fatigueAt) {
      const prevBucket = bucketMap[ordered[i - 1]];
      if (prevBucket) {
        const prevAvgPM = Number(prevBucket.avg_plus_minus) ?? 0;
        if (prevAvgPM - avgPM > 2) {
          fatigueAt = bucket;
        }
      }
    }
  });

  return (
    <div className="bg-slate-800 rounded-lg p-2.5">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between min-h-[36px]"
      >
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-bold text-white">#{player.player_number} {player.player_name}</span>
          {optimalBucket && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-emerald-900/40 text-emerald-400 font-bold">
              {t.seasonOptimal || 'Optimal'}: {optimalBucket}'
            </span>
          )}
          {fatigueAt && (
            <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-900/40 text-amber-400 font-bold">
              {t.seasonFatigue || 'Fatigue'}: {fatigueAt}'
            </span>
          )}
        </div>
        {expanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-500" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-500" />}
      </button>

      {expanded && (
        <div className="flex gap-1.5 mt-2">
          {ordered.map(bucket => {
            const b = bucketMap[bucket];
            if (!b) return (
              <div key={bucket} className="flex-1 bg-slate-700/30 rounded p-1.5 text-center opacity-30">
                <div className="text-[9px] text-slate-500">{bucket}'</div>
                <div className="text-xs text-slate-600">-</div>
              </div>
            );

            const avgPM = Number(b.avg_plus_minus) ?? 0;
            const stintCount = Number(b.stint_count) ?? 0;
            const bgColor = avgPM > 0 ? 'bg-emerald-900/40' : avgPM < 0 ? 'bg-red-900/40' : 'bg-slate-700';
            const isOptimal = bucket === optimalBucket;
            const isFatigue = bucket === fatigueAt;
            const border = isOptimal ? 'border border-emerald-500' : isFatigue ? 'border border-amber-500' : '';

            return (
              <div key={bucket} className={`flex-1 ${bgColor} ${border} rounded p-1.5 text-center`}>
                <div className="text-[9px] text-slate-400 font-bold">{bucket}'</div>
                <div className={`text-xs font-black ${avgPM > 0 ? 'text-emerald-400' : avgPM < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {avgPM > 0 ? '+' : ''}{avgPM}
                </div>
                <div className="text-[9px] text-slate-500">{stintCount}x</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RotationInsights({ stintByPlayer, playerStats, teamStintBuckets, totalGames, t }) {
  const isEs = (t.seasonOptimal || '') === 'Óptimo';
  const ordered = ['0-2', '2-4', '4-6', '6-8', '8+'];
  const shortBuckets = new Set(['0-2', '2-4']);
  const longBuckets = new Set(['6-8', '8+']);

  const sparkPlugs = [];
  const marathoners = [];
  const fatigueRisk = [];
  const consistent = [];

  playerStats.forEach(p => {
    const buckets = stintByPlayer[p.player_id];
    if (!buckets || buckets.length === 0) return;

    const bucketMap = {};
    buckets.forEach(b => { bucketMap[b.duration_bucket] = b; });

    let bestBucket = null;
    let bestPM = -Infinity;
    let totalStints = 0;
    const pmValues = [];

    ordered.forEach((bucket) => {
      const b = bucketMap[bucket];
      if (!b) return;
      const avgPM = Number(b.avg_plus_minus) ?? 0;
      const count = Number(b.stint_count) ?? 0;
      totalStints += count;
      pmValues.push(avgPM);
      if (avgPM > bestPM) {
        bestPM = avgPM;
        bestBucket = bucket;
      }
    });

    if (totalStints < 2 || !bestBucket) return;

    const name = p.player_name;
    const num = p.player_number;

    if (shortBuckets.has(bestBucket) && bestPM > 0) {
      sparkPlugs.push({ name, num, bucket: bestBucket, pm: bestPM, stints: totalStints });
    }

    if (longBuckets.has(bestBucket) && bestPM > 0) {
      marathoners.push({ name, num, bucket: bestBucket, pm: bestPM, stints: totalStints });
    }

    let hasFatigue = false;
    ordered.forEach((bucket, i) => {
      if (i === 0 || hasFatigue) return;
      const curr = bucketMap[bucket];
      const prev = bucketMap[ordered[i - 1]];
      if (curr && prev) {
        const prevPM = Number(prev.avg_plus_minus) ?? 0;
        const currPM = Number(curr.avg_plus_minus) ?? 0;
        const drop = prevPM - currPM;
        if (drop > 2) {
          fatigueRisk.push({ name, num, from: ordered[i - 1], to: bucket, drop: Math.round(drop * 10) / 10, prevPM: Math.round(prevPM * 10) / 10, currPM: Math.round(currPM * 10) / 10 });
          hasFatigue = true;
        }
      }
    });

    if (pmValues.length >= 2) {
      const range = Math.max(...pmValues) - Math.min(...pmValues);
      if (range <= 3 && totalStints >= 5) {
        consistent.push({ name, num, range: Math.round(range * 10) / 10, stints: totalStints });
      }
    }
  });

  // Team-level: find best team bucket
  const bestTeamBucket = teamStintBuckets.reduce((best, b) => {
    if (b.count === 0) return best;
    if (!best || b.avgPM > best.avgPM) return b;
    return best;
  }, null);

  const hasInsights = sparkPlugs.length > 0 || marathoners.length > 0 || fatigueRisk.length > 0 || consistent.length > 0 || bestTeamBucket;
  if (!hasInsights) return null;

  const pm = (v) => `${v > 0 ? '+' : ''}${v}`;

  // Build narrative paragraphs
  const paragraphs = [];

  // 1. Team-level insight
  if (bestTeamBucket) {
    const bucket = bestTeamBucket.bucket;
    if (isEs) {
      paragraphs.push({
        color: 'text-orange-400',
        text: `En ${totalGames} partido${totalGames !== 1 ? 's' : ''}, el equipo rinde mejor con stints de ${bucket} minutos (${pm(bestTeamBucket.avgPM)} de media en ${bestTeamBucket.count} stints).`
      });
    } else {
      paragraphs.push({
        color: 'text-orange-400',
        text: `Across ${totalGames} game${totalGames !== 1 ? 's' : ''}, the team performs best with ${bucket}' stints (${pm(bestTeamBucket.avgPM)} avg across ${bestTeamBucket.count} stints).`
      });
    }
  }

  // 2. Marathoners
  if (marathoners.length > 0) {
    const names = marathoners.map(p => p.name).join(', ');
    if (marathoners.length === 1) {
      const p = marathoners[0];
      if (isEs) {
        paragraphs.push({
          color: 'text-emerald-400',
          text: `${p.name} rinde claramente mejor en stints largos de ${p.bucket}' (${pm(p.pm)} de media). Dale confianza con minutos extendidos.`
        });
      } else {
        paragraphs.push({
          color: 'text-emerald-400',
          text: `${p.name} clearly performs best in long ${p.bucket}' stints (${pm(p.pm)} avg). Trust them with extended minutes.`
        });
      }
    } else {
      const details = marathoners.map(p => `${p.name} (${p.bucket}', ${pm(p.pm)})`).join(', ');
      if (isEs) {
        paragraphs.push({
          color: 'text-emerald-400',
          text: `Jugadores de confianza en stints largos: ${details}. Priorízalos para periodos extendidos.`
        });
      } else {
        paragraphs.push({
          color: 'text-emerald-400',
          text: `Trust with long stints: ${details}. Prioritize them for extended periods.`
        });
      }
    }
  }

  // 3. Spark plugs
  if (sparkPlugs.length > 0) {
    if (sparkPlugs.length === 1) {
      const p = sparkPlugs[0];
      if (isEs) {
        paragraphs.push({
          color: 'text-sky-400',
          text: `${p.name} es un revulsivo desde el banquillo: su mejor rendimiento es en stints cortos de ${p.bucket}' (${pm(p.pm)}). Ideal para cambiar el ritmo del partido.`
        });
      } else {
        paragraphs.push({
          color: 'text-sky-400',
          text: `${p.name} is a spark plug off the bench: best in short ${p.bucket}' stints (${pm(p.pm)}). Use them to change the pace.`
        });
      }
    } else {
      const details = sparkPlugs.map(p => `${p.name} (${p.bucket}', ${pm(p.pm)})`).join(', ');
      if (isEs) {
        paragraphs.push({
          color: 'text-sky-400',
          text: `Revulsivos desde el banquillo: ${details}. Úsalos en rotaciones cortas para dar energía al equipo.`
        });
      } else {
        paragraphs.push({
          color: 'text-sky-400',
          text: `Energy off the bench: ${details}. Use them in short rotations to energize the team.`
        });
      }
    }
  }

  // 4. Fatigue
  if (fatigueRisk.length > 0) {
    fatigueRisk.forEach(p => {
      if (isEs) {
        paragraphs.push({
          color: 'text-amber-400',
          text: `Cuidado con ${p.name} a partir de ${p.to}': su +/- cae de ${pm(p.prevPM)} a ${pm(p.currPM)} (${p.drop} puntos). Considera cambiarlo antes.`
        });
      } else {
        paragraphs.push({
          color: 'text-amber-400',
          text: `Watch ${p.name} past ${p.to}': +/- drops from ${pm(p.prevPM)} to ${pm(p.currPM)} (${p.drop} pts). Consider subbing earlier.`
        });
      }
    });
  }

  // 5. Consistent
  if (consistent.length > 0) {
    const names = consistent.map(p => p.name).join(', ');
    if (isEs) {
      paragraphs.push({
        color: 'text-slate-400',
        text: `${names} ${consistent.length === 1 ? 'mantiene' : 'mantienen'} un rendimiento estable independientemente de la duración del stint. ${consistent.length === 1 ? 'Fiable' : 'Fiables'} en cualquier situación.`
      });
    } else {
      paragraphs.push({
        color: 'text-slate-400',
        text: `${names} ${consistent.length === 1 ? 'maintains' : 'maintain'} stable performance regardless of stint duration. Reliable in any situation.`
      });
    }
  }

  // 6. Sample size note
  if (totalGames < 5) {
    if (isEs) {
      paragraphs.push({
        color: 'text-slate-600',
        text: `Basado en ${totalGames} partido${totalGames !== 1 ? 's' : ''}. Estos datos serán más fiables a partir de 5 partidos.`
      });
    } else {
      paragraphs.push({
        color: 'text-slate-600',
        text: `Based on ${totalGames} game${totalGames !== 1 ? 's' : ''}. Data becomes more reliable after 5 games.`
      });
    }
  }

  return (
    <div className="bg-slate-800 border border-slate-700 rounded-lg p-3 mt-3">
      <div className="text-xs font-bold text-orange-400 mb-2">{t.rotationInsightsTitle || 'Rotation Insights'}</div>
      <div className="space-y-2">
        {paragraphs.map((p, i) => (
          <p key={i} className={`text-[11px] leading-relaxed ${p.color}`}>{p.text}</p>
        ))}
      </div>
    </div>
  );
}
