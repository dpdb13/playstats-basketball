import { supabase } from './supabase';
import { calculateGameStats } from './statsCalculator';
import { getQuarterDuration } from './gameUtils';

// Bump this number whenever the stats schema changes (new columns, new logic, etc.)
// SeasonStats will auto-reprocess all games when it detects a lower version in team_settings.
export const STATS_SCHEMA_VERSION = 4;

/**
 * Convierte minutos decimales a un bucket de duración para análisis de stints.
 */
function getDurationBucket(minutes) {
  if (minutes < 2) return '0-2';
  if (minutes < 4) return '2-4';
  if (minutes < 6) return '4-6';
  if (minutes < 8) return '6-8';
  return '8+';
}

/**
 * Splits stints that cross halftime (Q2→Q3) into two separate stints.
 * Uses actionHistory to detect which players were on court at halftime,
 * then estimates the split point based on when the stint started.
 *
 * For future games this is handled live in the tracker; this function
 * fixes historical data that was saved before the live fix existed.
 */
function splitHalftimeStints(players, actionHistory) {
  if (!actionHistory || actionHistory.length === 0) return players;

  // 1. Walk actionHistory to find who was on court at end of Q2
  //    and count completed stints (OUT events) per player in Q1+Q2
  const playerOnCourt = {};
  const outsBeforeHalftime = {};
  const lastInQuarter = {}; // quarter of last IN event per player

  players.forEach(p => {
    playerOnCourt[p.id] = false;
    outsBeforeHalftime[p.id] = 0;
    lastInQuarter[p.id] = 0;
  });

  for (const event of actionHistory) {
    if (event.type !== 'substitution') continue;
    if (event.quarter > 2) break; // past halftime

    if (event.wasOnCourt) {
      // Player went OFF court → completed a stint
      playerOnCourt[event.playerId] = false;
      outsBeforeHalftime[event.playerId] = (outsBeforeHalftime[event.playerId] || 0) + 1;
    } else {
      // Player went ON court
      playerOnCourt[event.playerId] = true;
      lastInQuarter[event.playerId] = event.quarter;
    }
  }

  // 2. For each player on court at halftime, split their cross-halftime stint
  return players.map(p => {
    if (!playerOnCourt[p.id]) return p; // not on court at halftime

    const stintIdx = outsBeforeHalftime[p.id] ?? 0;

    // The cross-halftime stint can be in two places:
    // a) In stints[stintIdx] — player was subbed OFF at some point after halftime
    // b) In currentMinutes — player is STILL on court at game end (never subbed off)
    let totalDuration;
    let totalPM;
    let isCurrentStint = false; // stint lives in currentMinutes, not stints[]

    if (p.stints && stintIdx < p.stints.length) {
      totalDuration = p.stints[stintIdx];
      totalPM = p.stintPlusMinus?.[stintIdx] ?? 0;
    } else if (p.onCourt && p.currentMinutes > 0) {
      // Player never subbed off — stint is in currentMinutes
      totalDuration = p.currentMinutes;
      totalPM = p.currentStintStart
        ? 0 // will be recalculated by calculateGameStats enrichment anyway
        : 0;
      isCurrentStint = true;
    } else {
      return p;
    }

    if (totalDuration <= 0) return p;

    // Estimate Q2 portion based on when the stint started
    const prevCourt = (p.stints || []).slice(0, stintIdx).reduce((a, b) => a + b, 0);
    const inQuarter = lastInQuarter[p.id] || 1;
    // Best estimate of game-minute when stint started:
    // - At minimum, sum of previous stints (court time only, no bench)
    // - At minimum, start of the quarter where the IN event happened
    const minGameTime = Math.max(prevCourt, (inQuarter - 1) * 10);
    let q2Portion = 20 - minGameTime;

    // Caps: can't exceed total duration, can't be negative
    q2Portion = Math.max(0, Math.min(q2Portion, totalDuration));
    const q3Portion = totalDuration - q2Portion;

    // If one portion is negligible (<0.1 min = 6 seconds), don't split
    if (q2Portion < 0.1 || q3Portion < 0.1) return p;

    if (isCurrentStint) {
      // Move Q2 portion into stints[], leave Q3 portion in currentMinutes
      // calculateGameStats will later add currentMinutes as an additional stint
      const q2PM = Math.round(totalPM * (q2Portion / totalDuration));
      return {
        ...p,
        stints: [...(p.stints || []), q2Portion],
        stintPlusMinus: [...(p.stintPlusMinus || []), q2PM],
        currentMinutes: q3Portion
        // currentStintStart stays — calculateGameStats will compute the Q3 +/- from it
      };
    }

    // Split +/- proportionally by duration
    const q2PM = Math.round(totalPM * (q2Portion / totalDuration));
    const q3PM = totalPM - q2PM;

    // Replace the single stint with two stints at the same index
    const newStints = [...p.stints];
    newStints.splice(stintIdx, 1, q2Portion, q3Portion);

    const newPM = [...(p.stintPlusMinus || [])];
    // Guard: ensure PM array is long enough before splicing
    while (newPM.length <= stintIdx) newPM.push(0);
    newPM.splice(stintIdx, 1, q2PM, q3PM);

    return { ...p, stints: newStints, stintPlusMinus: newPM };
  });
}

/**
 * Associates eventLog events (shots, fouls) with individual player stints.
 * Tracks each player's stint index by observing lineupOnCourt changes.
 * Returns: { [playerId]: { [stintIdx]: { fgMade, fgAttempted, fouls } } }
 */
function computeStintEvents(playerStats, eventLog, isHomeTeam) {
  const ourTeam = isHomeTeam ? 'home' : 'away';
  const result = {};

  // Initialize trackers for each player
  const trackers = {};
  playerStats.forEach(p => {
    trackers[p.id] = { stintIdx: -1, wasOnCourt: false };
    result[p.id] = {};
  });

  // Walk eventLog chronologically
  for (const ev of eventLog) {
    if (!ev.lineupOnCourt || ev.lineupOnCourt.length !== 5) continue;
    const onCourt = new Set(ev.lineupOnCourt);

    // Update stint indices by detecting on/off transitions
    for (const pid of Object.keys(trackers)) {
      const t = trackers[pid];
      const isNowOn = onCourt.has(pid);
      if (isNowOn && !t.wasOnCourt) {
        // Player appeared on court → new stint
        t.stintIdx++;
        result[pid][t.stintIdx] = { fgMade: 0, fgAttempted: 0, fouls: 0 };
      }
      t.wasOnCourt = isNowOn;
    }

    // Attribute shots to the specific player who shot
    if (ev.playerId && trackers[ev.playerId] && trackers[ev.playerId].wasOnCourt) {
      const pid = ev.playerId;
      const stintData = result[pid]?.[trackers[pid].stintIdx];
      if (!stintData) continue;

      if (ev.team === ourTeam) {
        const isFT = ev.playType === 'freeThrow' || ev.value === 1;
        if (ev.type === 'score' && !isFT) {
          stintData.fgMade++;
          stintData.fgAttempted++;
        } else if (ev.type === 'miss' && !isFT) {
          stintData.fgAttempted++;
        }
      }

      // Fouls: attribute regardless of team (it's the player's foul)
      if (ev.type === 'foul') {
        stintData.fouls++;
      }
    }
  }

  return result;
}

/**
 * Extrae stats de un partido y las guarda en las 4 tablas de stats.
 * Idempotente: DELETE + INSERT (re-ejecutar no crea duplicados).
 */
export async function extractAndSaveGameStats(gameRecord) {
  const gameId = gameRecord.id;
  const teamId = gameRecord.team_id;
  const gd = gameRecord.game_data || gameRecord;

  // Solo procesar partidos completados con datos
  if (gameRecord.status !== 'completed') return;
  if (!gd.players || gd.players.length === 0) return;

  // Skip games with non-UUID player IDs (pre-BUG-2 legacy data)
  const hasValidIds = gd.players.every(p => typeof p.id === 'string' && /^[0-9a-f]{8}-/.test(p.id));
  if (!hasValidIds) {
    console.warn(`Skipping game ${gameId}: non-UUID player IDs (legacy format)`);
    return;
  }

  const isHome = gd.isHomeTeam !== false;
  const ourScore = isHome ? (gd.homeScore || 0) : (gd.awayScore || 0);
  const rivalScore = isHome ? (gd.awayScore || 0) : (gd.homeScore || 0);
  const ourTeamName = isHome ? (gd.homeTeam || 'Home') : (gd.awayTeam || 'Away');
  const rivalTeamName = isHome ? (gd.awayTeam || 'Away') : (gd.homeTeam || 'Home');
  const result = ourScore > rivalScore ? 'win' : ourScore < rivalScore ? 'loss' : 'draw';

  // Fix historical quintetHistory entries broken by two bugs:
  // BUG A: (startGameTime || 600) treats startGameTime=0 as falsy → duration inflated to 10 min
  //   Fix: entries with startGameTime=0 should have ~0 duration (created at end of quarter)
  // BUG B: auto-advance reset gameTime to 600 before endCurrentQuintet → duration = 0
  //   Fix: duration = startGameTime / 60 (they lasted from startGameTime to 0)
  //   Exception: 0-scored/0-allowed with duration=0 are phantom entries, leave at 0
  const fixedQuintetHistory = (gd.quintetHistory || []).map(q => {
    // BUG A: startGameTime=0 + (0||600) gave fake 10-min duration
    if (q.startGameTime === 0 && q.duration > 1) {
      return { ...q, duration: 0 }; // will be filtered by MIN_QUINTET_SECONDS
    }
    // BUG B: stale gameTime=600 gave duration=0 for real quintets
    if (q.duration === 0 && q.startGameTime > 0) {
      if (q.pointsScored === 0 && q.pointsAllowed === 0) {
        return q; // phantom entry — will be filtered out
      }
      return { ...q, duration: q.startGameTime / 60 };
    }
    return q;
  });

  // Fix historical stints that cross halftime (Q2→Q3) without a break
  const fixedPlayers = splitHalftimeStints(gd.players || [], gd.actionHistory || []);

  // Reusar statsCalculator (fuente única)
  const stats = calculateGameStats({
    players: fixedPlayers,
    quintetHistory: fixedQuintetHistory,
    currentQuintet: gd.currentQuintet || null,
    eventLog: gd.eventLog || [],
    partialScores: gd.partialScores || {},
    scoresByQuarter: gd.scoresByQuarter || {},
    substitutionsByQuarter: gd.substitutionsByQuarter || {},
    ourScore,
    rivalScore,
    ourTeamName,
    rivalTeamName,
    isHomeTeam: isHome,
    gameTime: gd.gameTime || 0,
    leadChanges: gd.leadChanges || 0,
    ties: gd.ties || 0,
    biggestLead: gd.biggestLead || { us: 0, them: 0 }
  });

  const gameDate = gd.customDate || gameRecord.updated_at || gameRecord.created_at || new Date().toISOString();

  // ---- Borrar datos previos (idempotente) ----
  const deleteResults = await Promise.all([
    supabase.from('player_game_stats').delete().eq('game_id', gameId),
    supabase.from('player_game_stints').delete().eq('game_id', gameId),
    supabase.from('game_quintet_stats').delete().eq('game_id', gameId),
    supabase.from('game_summary_stats').delete().eq('game_id', gameId),
  ]);

  // Abort if any DELETE failed (e.g. RLS rejection for viewers)
  const deleteError = deleteResults.find(r => r.error);
  if (deleteError?.error) {
    console.error('Stats extraction aborted - DELETE failed:', deleteError.error);
    return;
  }

  // ---- 1. player_game_stats ----
  const gameDiff = ourScore - rivalScore;
  // gameTime is a countdown (600→0 for regular quarters, 300→0 for OT), NOT elapsed time.
  // Sum completed quarter durations + elapsed in current quarter.
  const currentQuarter = gd.currentQuarter || 4;
  const elapsedInCurrentQuarter = (getQuarterDuration(currentQuarter) - (gd.gameTime || 0)) / 60;
  let totalGameMinutes = 0;
  for (let q = 1; q < currentQuarter; q++) {
    totalGameMinutes += getQuarterDuration(q) / 60; // 10 min for Q1-Q4, 5 min for OT
  }
  totalGameMinutes += elapsedInCurrentQuarter;
  const playerRows = stats.playerStats.map(p => {
    const s = p.shotStats || { pts3: { made: 0, missed: 0 }, pts2: { made: 0, missed: 0 }, pts1: { made: 0, missed: 0 } };
    const playerMinutes = Math.min(Math.round(p.minutes * 100) / 100, totalGameMinutes);
    const offMinutes = Math.round(Math.max(0, totalGameMinutes - playerMinutes) * 100) / 100;
    return {
      game_id: gameId,
      team_id: teamId,
      player_id: p.id,
      player_name: p.name,
      player_number: p.number || '',
      minutes: playerMinutes,
      stint_count: p.stints ? p.stints.length : 0,
      points: p.points,
      fg_made: p.fgMade,
      fg_attempted: p.fgAttempted,
      ft_made: p.ftMade,
      ft_attempted: p.ftAttempted,
      pts3_made: s.pts3.made,
      pts3_attempted: s.pts3.made + s.pts3.missed,
      pts2_made: s.pts2.made,
      pts2_attempted: s.pts2.made + s.pts2.missed,
      plus_minus: p.plusMinus,
      fouls: p.fouls,
      best_stint_pm: p.bestStint ? p.bestStint.plusMinus : null,
      worst_stint_pm: p.worstStint ? p.worstStint.plusMinus : null,
      on_court_pm: p.plusMinus,
      off_court_pm: gameDiff - p.plusMinus,
      on_court_minutes: playerMinutes,
      off_court_minutes: offMinutes,
      game_date: gameDate,
      our_score: ourScore,
      rival_score: rivalScore,
      result
    };
  });

  if (playerRows.length > 0) {
    const { error } = await supabase.from('player_game_stats').insert(playerRows);
    if (error) console.error('Error inserting player_game_stats:', error);
  }

  // ---- 2. player_game_stints ----
  const stintEvents = computeStintEvents(stats.playerStats, gd.eventLog || [], isHome);
  const stintRows = [];
  stats.playerStats.forEach(p => {
    if (!p.stints) return;
    p.stints.forEach((s, i) => {
      const ev = stintEvents[p.id]?.[i] || { fgMade: 0, fgAttempted: 0, fouls: 0 };
      stintRows.push({
        game_id: gameId,
        team_id: teamId,
        player_id: p.id,
        stint_index: i,
        duration: Math.round(s.duration * 100) / 100,
        plus_minus: s.plusMinus,
        duration_bucket: getDurationBucket(s.duration),
        fg_made: ev.fgMade,
        fg_attempted: ev.fgAttempted,
        fouls: ev.fouls
      });
    });
  });

  if (stintRows.length > 0) {
    const { error } = await supabase.from('player_game_stints').insert(stintRows);
    if (error) console.error('Error inserting player_game_stints:', error);
  }

  // ---- 3. game_quintet_stats ----
  const quintetsByPM = stats.quintetStats.byPlusMinus || [];
  const quintetRows = quintetsByPM.map(q => ({
    game_id: gameId,
    team_id: teamId,
    quintet_key: q.key,
    player_ids: q.playerIds,
    total_minutes: Math.round(q.totalMinutes * 100) / 100,
    points_scored: q.pointsScored,
    points_allowed: q.pointsAllowed,
    plus_minus: q.plusMinus,
    occurrences: q.occurrences,
    fg_made: q.shotsMade || 0,
    fg_attempted: q.shotsAttempted || 0,
    threept_made: q.threePtMade || 0,
    threept_attempted: q.threePtAttempted || 0
  }));

  if (quintetRows.length > 0) {
    const { error } = await supabase.from('game_quintet_stats').insert(quintetRows);
    if (error) console.error('Error inserting game_quintet_stats:', error);
  }

  // ---- 4. game_summary_stats ----
  const summary = stats.summary;
  const totalSubs = summary.realSubs;
  const summaryRow = {
    game_id: gameId,
    team_id: teamId,
    game_date: gameDate,
    our_score: ourScore,
    rival_score: rivalScore,
    our_team_name: ourTeamName,
    rival_team_name: rivalTeamName,
    is_home: isHome,
    result,
    substitutions: totalSubs,
    lead_changes: summary.leadChanges || 0,
    ties: summary.ties || 0,
    biggest_lead_us: summary.biggestLead?.us || 0,
    biggest_lead_them: summary.biggestLead?.them || 0,
    partial_scores: gd.partialScores || {},
    phase: gd.phase || null,
    matchday: gd.matchday ? Number(gd.matchday) : null
  };

  const { error: summaryError } = await supabase.from('game_summary_stats').insert(summaryRow);
  if (summaryError) console.error('Error inserting game_summary_stats:', summaryError);
}

/**
 * Backfill: procesa partidos completados que aún no tienen stats extraídas.
 * Con force=true, re-procesa TODOS los partidos (útil tras cambios de lógica).
 * extractAndSaveGameStats es idempotente (DELETE+INSERT), así que re-procesar es seguro.
 * Retorna { processed, skipped, total }.
 */
export async function backfillTeamStats(teamId, onProgress, force = false) {
  // Cargar partidos completados
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('*')
    .eq('team_id', teamId)
    .eq('status', 'completed')
    .order('updated_at', { ascending: true });

  if (gamesError) {
    console.error('Error loading games for backfill:', gamesError);
    return { processed: 0, skipped: 0, total: 0 };
  }

  if (!games || games.length === 0) {
    return { processed: 0, skipped: 0, total: 0 };
  }

  // Cargar game_ids que ya tienen stats
  const { data: existing } = await supabase
    .from('game_summary_stats')
    .select('game_id')
    .eq('team_id', teamId);

  const existingIds = new Set((existing || []).map(e => e.game_id));

  let processed = 0;
  let skipped = 0;

  for (let i = 0; i < games.length; i++) {
    const game = games[i];
    if (!force && existingIds.has(game.id)) {
      skipped++;
      continue;
    }

    try {
      await extractAndSaveGameStats(game);
      processed++;
    } catch (err) {
      console.error(`Backfill failed for game ${game.id}:`, err);
    }

    if (onProgress) {
      onProgress({ processed, skipped, current: i + 1, total: games.length });
    }
  }

  return { processed, skipped, total: games.length };
}
