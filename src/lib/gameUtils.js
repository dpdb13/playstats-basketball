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

// ============================================
// COLORES DE EQUIPO
// ============================================
export const TEAM_COLORS = [
  { id: 'orange', label: 'colorOrange', bg: 'bg-orange-500', bgDark: 'bg-orange-800', border: 'border-orange-400', borderMuted: 'border-orange-600', text: 'text-orange-300', ring: 'ring-orange-400', swatch: 'bg-orange-500' },
  { id: 'sky', label: 'colorBlue', bg: 'bg-sky-500', bgDark: 'bg-sky-800', border: 'border-sky-400', borderMuted: 'border-sky-600', text: 'text-sky-300', ring: 'ring-sky-400', swatch: 'bg-sky-500' },
  { id: 'red', label: 'colorRed', bg: 'bg-red-500', bgDark: 'bg-red-800', border: 'border-red-400', borderMuted: 'border-red-600', text: 'text-red-300', ring: 'ring-red-400', swatch: 'bg-red-500' },
  { id: 'emerald', label: 'colorGreen', bg: 'bg-emerald-500', bgDark: 'bg-emerald-800', border: 'border-emerald-400', borderMuted: 'border-emerald-600', text: 'text-emerald-300', ring: 'ring-emerald-400', swatch: 'bg-emerald-500' },
  { id: 'purple', label: 'colorPurple', bg: 'bg-purple-500', bgDark: 'bg-purple-800', border: 'border-purple-400', borderMuted: 'border-purple-600', text: 'text-purple-300', ring: 'ring-purple-400', swatch: 'bg-purple-500' },
  { id: 'pink', label: 'colorPink', bg: 'bg-pink-500', bgDark: 'bg-pink-800', border: 'border-pink-400', borderMuted: 'border-pink-600', text: 'text-pink-300', ring: 'ring-pink-400', swatch: 'bg-pink-500' },
  { id: 'amber', label: 'colorYellow', bg: 'bg-amber-500', bgDark: 'bg-amber-800', border: 'border-amber-400', borderMuted: 'border-amber-600', text: 'text-amber-300', ring: 'ring-amber-400', swatch: 'bg-amber-500' },
  { id: 'slate', label: 'colorBlack', bg: 'bg-slate-500', bgDark: 'bg-slate-800', border: 'border-slate-400', borderMuted: 'border-slate-600', text: 'text-slate-300', ring: 'ring-slate-400', swatch: 'bg-slate-600' },
  { id: 'white', label: 'colorWhite', bg: 'bg-white', bgDark: 'bg-slate-200', border: 'border-white', borderMuted: 'border-slate-300', text: 'text-slate-800', ring: 'ring-white', swatch: 'bg-white' },
  { id: 'gray', label: 'colorGray', bg: 'bg-gray-500', bgDark: 'bg-gray-700', border: 'border-gray-400', borderMuted: 'border-gray-600', text: 'text-gray-300', ring: 'ring-gray-400', swatch: 'bg-gray-500' },
];

export const getTeamColor = (colorId) => TEAM_COLORS.find(c => c.id === colorId) || TEAM_COLORS[0];

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
  shotStats: { pts3: { made: 0, missed: 0 }, pts2: { made: 0, missed: 0 }, pts1: { made: 0, missed: 0 } },
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
