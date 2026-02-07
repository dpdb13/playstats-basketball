// ============================================
// FUNCIONES DE UTILIDAD DEL PARTIDO
// ============================================

export const INITIAL_PARTIAL_SCORES = {
  1: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  2: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  3: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  4: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } }
};

export const createInitialPlayerState = (player) => ({
  ...player,
  secondary_positions: player.secondary_positions || [],
  onCourt: false,
  currentMinutes: 0,
  totalCourtTime: 0,
  totalBenchTime: 0,
  fouls: 0,
  points: 0,
  lastToggle: null,
  stints: [],
  stintPlusMinus: [],
  currentStintStart: null
});

export const getFoulStatus = (fouls, quarter) => {
  if (quarter === 1) return fouls === 0 ? 'safe' : fouls === 1 ? 'warning' : 'danger';
  if (quarter === 2) return fouls <= 1 ? 'safe' : fouls === 2 ? 'warning' : 'danger';
  if (quarter === 3) return fouls <= 2 ? 'safe' : fouls === 3 ? 'warning' : 'danger';
  return fouls <= 2 ? 'safe' : fouls === 3 ? 'warning' : 'danger';
};

export const formatTime = (minutes) => {
  const mins = Math.floor(minutes);
  const secs = Math.floor((minutes % 1) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatGameTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const getFoulBgClass = (fouls, quarter) => {
  const status = getFoulStatus(fouls, quarter);
  if (fouls >= 5) return 'bg-red-800 border-2 border-red-400';
  return status === 'safe' ? 'bg-green-700 border-2 border-green-400' : status === 'warning' ? 'bg-yellow-600 border-2 border-yellow-300' : 'bg-red-700 border-2 border-red-400';
};

export const getQuintetKey = (playerIds) => [...playerIds].sort().join('-');
