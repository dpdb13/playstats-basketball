// ============================================
// FUNCIONES DE UTILIDAD DEL PARTIDO
// ============================================

export const createInitialPartialScores = () => ({
  1: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  2: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  3: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  4: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } }
});

// Backward compatibility — prefer createInitialPartialScores() for fresh objects
export const INITIAL_PARTIAL_SCORES = createInitialPartialScores();

export const createInitialPlayerState = (player) => ({
  ...player,
  secondary_positions: player.secondary_positions || [],
  onCourt: false,
  currentMinutes: 0,
  totalCourtTime: 0,
  totalBenchTime: 0,
  fouls: 0,
  points: 0,
  missedShots: 0,
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
  return status === 'safe' ? 'bg-emerald-700 border-2 border-emerald-400' : status === 'warning' ? 'bg-amber-600 border-2 border-amber-300' : 'bg-red-700 border-2 border-red-400';
};

export const getQuintetKey = (playerIds) => [...playerIds].sort().join('-');

// ============================================
// POSICIONES CONFIGURABLES
// ============================================
export const DEFAULT_POSITIONS = ['Base', 'Alero', 'Joker'];

// Full Tailwind class maps for dynamic positions (explicit to avoid purge issues)
const POSITION_COLOR_CLASSES = [
  { active: 'bg-blue-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-blue-600/40 text-blue-300', text: 'text-blue-400', initial: 'B' },
  { active: 'bg-emerald-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-emerald-600/40 text-emerald-300', text: 'text-emerald-400', initial: 'A' },
  { active: 'bg-purple-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-purple-600/40 text-purple-300', text: 'text-purple-400', initial: 'J' },
  { active: 'bg-amber-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-amber-600/40 text-amber-300', text: 'text-amber-400', initial: '4' },
  { active: 'bg-rose-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-rose-600/40 text-rose-300', text: 'text-rose-400', initial: '5' },
  { active: 'bg-blue-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-blue-600/40 text-blue-300', text: 'text-blue-400', initial: '6' },
  { active: 'bg-teal-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-teal-600/40 text-teal-300', text: 'text-teal-400', initial: '7' },
  { active: 'bg-indigo-600 text-white', inactive: 'bg-slate-700 text-slate-400 hover:bg-slate-600', badge: 'bg-indigo-600/40 text-indigo-300', text: 'text-indigo-400', initial: '8' },
];

export const getTeamPositions = (team) => {
  return team?.team_settings?.positions || DEFAULT_POSITIONS;
};

// Get color classes for a position by its index in the team's positions array
export const getPositionClasses = (posIndex) => {
  return POSITION_COLOR_CLASSES[posIndex % POSITION_COLOR_CLASSES.length];
};

// Get color classes for a specific position name given the team positions array
export const getPositionClassesByName = (posName, teamPositions) => {
  const positions = teamPositions || DEFAULT_POSITIONS;
  const idx = positions.indexOf(posName);
  if (idx === -1) return POSITION_COLOR_CLASSES[0]; // fallback
  return POSITION_COLOR_CLASSES[idx % POSITION_COLOR_CLASSES.length];
};
