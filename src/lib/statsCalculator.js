import { formatTime } from './gameUtils';

const MIN_QUINTET_SECONDS = 10; // Quintetos con menos de 10 seg no son significativos

/**
 * Calcula todas las estadísticas de un partido.
 * Fuente única de verdad para el reporte in-app y el HTML descargable.
 */
export function calculateGameStats({
  players,
  quintetHistory,
  currentQuintet,
  eventLog = [],
  partialScores,
  scoresByQuarter,
  substitutionsByQuarter,
  ourScore,
  rivalScore,
  ourTeamName,
  rivalTeamName,
  isHomeTeam,
  gameTime = 0,
  leadChanges = 0,
  ties = 0,
  biggestLead = { us: 0, them: 0 }
}) {
  // Include current quintet if active
  let allQuintets = [...quintetHistory];
  if (currentQuintet) {
    // Use game clock if available, fall back to real time
    const durationSeconds = currentQuintet.startGameTime != null
      ? (currentQuintet.startGameTime - (gameTime || 0))
      : (Date.now() - currentQuintet.startTime) / 1000;
    const duration = Math.max(0, durationSeconds) / 60;
    allQuintets.push({
      ...currentQuintet,
      endTime: Date.now(),
      duration,
      pointsScored: ourScore - currentQuintet.startOurScore,
      pointsAllowed: rivalScore - currentQuintet.startRivalScore,
      differential: (ourScore - currentQuintet.startOurScore) - (rivalScore - currentQuintet.startRivalScore)
    });
  }

  // Include current stint for on-court players
  const enrichedPlayers = players.map(p => {
    if (p.onCourt && p.currentStintStart) {
      const currentPM = (ourScore - p.currentStintStart.ourScore) - (rivalScore - p.currentStintStart.rivalScore);
      return {
        ...p,
        stints: [...p.stints, p.currentMinutes],
        stintPlusMinus: [...p.stintPlusMinus, currentPM]
      };
    }
    return p;
  });

  return {
    playerStats: calcPlayerStats(enrichedPlayers),
    quintetStats: calcQuintetStats(allQuintets, enrichedPlayers, eventLog, isHomeTeam),
    parcials: calcParcials(partialScores, scoresByQuarter),
    foulImpact: calcFoulImpact(enrichedPlayers, ourScore, rivalScore),
    summary: calcSummary(substitutionsByQuarter, leadChanges, ties, biggestLead, ourScore, rivalScore, ourTeamName, rivalTeamName, isHomeTeam)
  };
}

// ============================================
// INDIVIDUAL PLAYER STATS
// ============================================
function calcPlayerStats(players) {
  return players
    .filter(p => p.position !== 'Unselected' && (p.stints.length > 0 || p.totalCourtTime > 0))
    .map(p => {
      const totalPM = p.stintPlusMinus.reduce((a, b) => a + b, 0);
      const minutes = p.stints.reduce((a, b) => a + b, 0) || p.totalCourtTime;

      // Shooting
      const s = p.shotStats || { pts3: { made: 0, missed: 0 }, pts2: { made: 0, missed: 0 }, pts1: { made: 0, missed: 0 } };
      const fgMade = s.pts3.made + s.pts2.made;
      const fgAttempted = fgMade + s.pts3.missed + s.pts2.missed;
      const ftMade = s.pts1.made;
      const ftAttempted = ftMade + s.pts1.missed;
      const totalAttempted = fgAttempted + ftAttempted;
      const totalMade = fgMade + ftMade;

      // Best/worst stint
      let bestStint = null;
      let worstStint = null;
      if (p.stints.length > 0) {
        p.stints.forEach((dur, i) => {
          const pm = p.stintPlusMinus[i] || 0;
          if (!bestStint || pm > bestStint.plusMinus) bestStint = { duration: dur, plusMinus: pm, index: i };
          if (!worstStint || pm < worstStint.plusMinus) worstStint = { duration: dur, plusMinus: pm, index: i };
        });
      }

      return {
        id: p.id,
        name: p.name,
        number: p.number,
        position: p.position,
        minutes,
        points: p.points,
        fouls: p.fouls,
        plusMinus: totalPM,
        shotStats: s,
        fgPct: fgAttempted > 0 ? Math.round((fgMade / fgAttempted) * 100) : null,
        ftPct: ftAttempted > 0 ? Math.round((ftMade / ftAttempted) * 100) : null,
        totalShootingPct: totalAttempted > 0 ? Math.round((totalMade / totalAttempted) * 100) : null,
        fgMade, fgAttempted, ftMade, ftAttempted,
        bestStint,
        worstStint,
        stints: p.stints.map((dur, i) => ({ duration: dur, plusMinus: p.stintPlusMinus[i] || 0 }))
      };
    })
    .sort((a, b) => b.minutes - a.minutes);
}

// ============================================
// QUINTET STATS
// ============================================
function calcQuintetStats(quintets, players, eventLog, isHomeTeam) {
  // Aggregate quintets by key
  const aggregated = {};
  quintets.forEach(q => {
    if (!aggregated[q.key]) {
      aggregated[q.key] = {
        key: q.key,
        playerIds: q.playerIds,
        totalMinutes: 0,
        pointsScored: 0,
        pointsAllowed: 0,
        occurrences: 0
      };
    }
    aggregated[q.key].totalMinutes += q.duration;
    aggregated[q.key].pointsScored += q.pointsScored;
    aggregated[q.key].pointsAllowed += q.pointsAllowed;
    aggregated[q.key].occurrences += 1;
  });

  // Compute shooting stats per quintet from eventLog
  const quintetShots = {};
  const quintet3PT = {};
  const ourTeam = isHomeTeam ? 'home' : 'away';
  eventLog.forEach(ev => {
    if (!ev.lineupOnCourt || ev.lineupOnCourt.length !== 5) return;
    const key = [...ev.lineupOnCourt].sort().join('-');

    if (!quintetShots[key]) quintetShots[key] = { made: 0, attempted: 0 };
    if (!quintet3PT[key]) quintet3PT[key] = { made: 0, attempted: 0 };

    // FG% per quintet: only our team's field goals (excludes FTs and rival shots)
    if (ev.team === ourTeam && ev.playType !== 'freeThrow') {
      if (ev.type === 'score') {
        quintetShots[key].made += 1;
        quintetShots[key].attempted += 1;
      } else if (ev.type === 'miss') {
        quintetShots[key].attempted += 1;
      }
    }

    // 3PT: only our team's shots
    if (ev.team === ourTeam) {
      if (ev.type === 'score' && ev.value === 3) {
        quintet3PT[key].made += 1;
        quintet3PT[key].attempted += 1;
      } else if (ev.type === 'miss' && ev.value === 3) {
        quintet3PT[key].attempted += 1;
      }
    }
  });

  // Build final array
  const result = Object.values(aggregated)
    .filter(q => q.totalMinutes >= MIN_QUINTET_SECONDS / 60)
    .map(q => {
      const plusMinus = q.pointsScored - q.pointsAllowed;
      const offRating = q.totalMinutes > 0 ? q.pointsScored / q.totalMinutes : 0;
      const defRating = q.totalMinutes > 0 ? q.pointsAllowed / q.totalMinutes : 0;
      const shots = quintetShots[q.key] || { made: 0, attempted: 0 };
      const shootingPct = shots.attempted > 0 ? Math.round((shots.made / shots.attempted) * 100) : null;

      const playerNames = q.playerIds.map(id => {
        const p = players.find(pl => pl.id === id);
        return p ? `#${p.number} ${p.name}` : '?';
      });

      const threes = quintet3PT[q.key] || { made: 0, attempted: 0 };
      const threePtPct = threes.attempted > 0 ? Math.round((threes.made / threes.attempted) * 100) : null;

      return {
        ...q,
        plusMinus,
        offRating: Math.round(offRating * 100) / 100,
        defRating: Math.round(defRating * 100) / 100,
        shootingPct,
        shotsMade: shots.made,
        shotsAttempted: shots.attempted,
        threePtMade: threes.made,
        threePtAttempted: threes.attempted,
        threePtPct,
        playerNames
      };
    });

  return {
    byMinutes: [...result].sort((a, b) => b.totalMinutes - a.totalMinutes),
    byPlusMinus: [...result].sort((a, b) => b.plusMinus - a.plusMinus),
    byOffense: [...result].sort((a, b) => b.offRating - a.offRating),
    byDefense: [...result].sort((a, b) => a.defRating - b.defRating), // lower is better
    byShooting: [...result].filter(q => q.shotsAttempted > 0).sort((a, b) => (b.shootingPct || 0) - (a.shootingPct || 0)),
    by3PT: [...result].filter(q => q.threePtAttempted > 0).sort((a, b) => (b.threePtPct || 0) - (a.threePtPct || 0))
  };
}

// ============================================
// PARCIALS (each 5 min and per quarter)
// ============================================
function calcParcials(partialScores, scoresByQuarter) {
  if (!partialScores) return [];

  return Object.keys(partialScores).map(Number).sort((a, b) => a - b).map(q => {
    const ps = partialScores[q] || { first: { us: 0, them: 0 }, second: { us: 0, them: 0 } };
    const quarterUs = ps.first.us + ps.second.us;
    const quarterThem = ps.first.them + ps.second.them;
    return {
      quarter: q,
      first: { us: ps.first.us, them: ps.first.them },
      second: { us: ps.second.us, them: ps.second.them },
      total: { us: quarterUs, them: quarterThem },
      diff: quarterUs - quarterThem
    };
  });
}

// ============================================
// PLAYER IMPACT (on-court vs off-court +/-)
// ============================================
function calcFoulImpact(players, ourScore, rivalScore) {
  // Simple: on-court +/- = player's total +/- (from stints)
  //         off-court +/- = game differential minus player's +/-
  const gameDiff = ourScore - rivalScore;
  const activePlayers = players.filter(p => p.position !== 'Unselected' && p.stints.length > 0);

  return activePlayers.map(p => {
    const onCourtPM = p.stintPlusMinus.reduce((a, b) => a + b, 0);
    const offCourtPM = gameDiff - onCourtPM;

    return {
      id: p.id,
      name: p.name,
      number: p.number,
      fouls: p.fouls,
      onCourtPM,
      offCourtPM
    };
  }).sort((a, b) => b.onCourtPM - a.onCourtPM);
}

// ============================================
// GAME SUMMARY
// ============================================
function calcSummary(substitutionsByQuarter, leadChanges, ties, biggestLead, ourScore, rivalScore, ourTeamName, rivalTeamName, isHomeTeam) {
  const totalSubs = Object.values(substitutionsByQuarter || {}).reduce((a, b) => a + b, 0);
  const realSubs = Math.max(0, totalSubs - 5); // Subtract initial 5

  return {
    ourScore,
    rivalScore,
    ourTeamName,
    rivalTeamName,
    isHomeTeam,
    realSubs,
    leadChanges,
    ties,
    biggestLead,
    result: ourScore > rivalScore ? 'win' : ourScore < rivalScore ? 'loss' : 'draw'
  };
}

// ============================================
// FORMATTERS (for both in-app and HTML)
// ============================================
export function formatPlusMinus(val) {
  return val >= 0 ? `+${val}` : `${val}`;
}

export function formatPct(val) {
  return val !== null && val !== undefined ? `${val}%` : '-';
}

