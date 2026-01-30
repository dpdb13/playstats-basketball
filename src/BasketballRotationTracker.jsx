import React, { useState, useEffect, useRef, useCallback, useMemo, memo } from 'react';
import { Clock, Users, Play, Pause, AlertTriangle, XCircle, Settings, Download, Target, Undo2, RefreshCw, Bell, Edit3, Check, X } from 'lucide-react';
import PlayStatsIcon from './components/PlayStatsIcon';

// ============================================
// CONSTANTES
// ============================================
const STORAGE_KEY = 'basketball-rotation-app-state'; // Legacy - para migración
const GAMES_LIST_KEY = 'basketball-rotation-games-list';
const GAME_DATA_PREFIX = 'basketball-rotation-game-';
const AUTOSAVE_INTERVAL = 5000; // Guardar cada 5 segundos

// Generar ID único para cada partido
const generateGameId = () => `game_${Date.now()}`;

// ============================================
// FUNCIONES DE GESTIÓN DE PARTIDOS (localStorage)
// ============================================
const getGamesList = () => {
  try {
    const data = localStorage.getItem(GAMES_LIST_KEY);
    return data ? JSON.parse(data).games || [] : [];
  } catch {
    return [];
  }
};

const saveGamesList = (games) => {
  localStorage.setItem(GAMES_LIST_KEY, JSON.stringify({ games }));
};

const addGameToList = (gameInfo) => {
  const games = getGamesList();
  games.push(gameInfo);
  saveGamesList(games);
};

const updateGameInList = (gameInfo) => {
  const games = getGamesList();
  const index = games.findIndex(g => g.id === gameInfo.id);
  if (index >= 0) {
    games[index] = { ...games[index], ...gameInfo };
  }
  saveGamesList(games);
};

const removeGameFromList = (gameId) => {
  const games = getGamesList().filter(g => g.id !== gameId);
  saveGamesList(games);
  localStorage.removeItem(`${GAME_DATA_PREFIX}${gameId}`);
};

const loadGameData = (gameId) => {
  try {
    const data = localStorage.getItem(`${GAME_DATA_PREFIX}${gameId}`);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
};

const saveGameData = (gameId, data) => {
  localStorage.setItem(`${GAME_DATA_PREFIX}${gameId}`, JSON.stringify(data));
};

const INITIAL_PLAYERS = [
  { id: 1, name: 'David', number: '2', position: 'Base' },
  { id: 2, name: 'Coco', number: '4', position: 'Base' },
  { id: 3, name: 'Clemen', number: '5', position: 'Base' },
  { id: 4, name: 'Hugo', number: '12', position: 'Base' },
  { id: 5, name: 'Lucas', number: '10', position: 'Base' },
  { id: 6, name: 'Pablo', number: '9', position: 'Alero' },
  { id: 7, name: 'Tommy', number: '3', position: 'Alero' },
  { id: 8, name: 'Miguel', number: '11', position: 'Alero' },
  { id: 9, name: 'Unai', number: '8', position: 'Joker' },
  { id: 10, name: 'Nico', number: '6', position: 'Joker' },
  { id: 11, name: 'Jorge', number: '7', position: 'Joker' },
  { id: 12, name: 'Jugador 12', number: '0', position: 'Unselected' },
];

const createInitialPlayerState = (player) => ({
  ...player,
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

const INITIAL_PARTIAL_SCORES = {
  1: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  2: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  3: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } },
  4: { first: { us: 0, them: 0, locked: false }, second: { us: 0, them: 0, locked: false } }
};

// ============================================
// FUNCIONES AUXILIARES (fuera del componente)
// ============================================
const getFoulStatus = (fouls, quarter) => {
  if (quarter === 1) return fouls === 0 ? 'safe' : fouls === 1 ? 'warning' : 'danger';
  if (quarter === 2) return fouls <= 1 ? 'safe' : fouls === 2 ? 'warning' : 'danger';
  if (quarter === 3) return fouls <= 2 ? 'safe' : fouls === 3 ? 'warning' : 'danger';
  return fouls <= 2 ? 'safe' : fouls === 3 ? 'warning' : 'danger';
};

const formatTime = (minutes) => {
  const mins = Math.floor(minutes);
  const secs = Math.floor((minutes % 1) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const formatGameTime = (seconds) => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

const getFoulBgClass = (fouls, quarter) => {
  const status = getFoulStatus(fouls, quarter);
  if (fouls >= 5) return 'bg-red-800 border-2 border-red-400';
  return status === 'safe' ? 'bg-green-700 border-2 border-green-400' : status === 'warning' ? 'bg-yellow-600 border-2 border-yellow-300' : 'bg-red-700 border-2 border-red-400';
};

const getQuintetKey = (playerIds) => [...playerIds].sort((a, b) => a - b).join('-');

// ============================================
// COMPONENTE PLAYERCARD (memo para optimización)
// ============================================
const PlayerCard = memo(({
  player,
  isRosterView,
  currentQuarter,
  editingPlayer,
  editingStats,
  editForm,
  statsForm,
  onEditFormChange,
  onStatsFormChange,
  onStartEditing,
  onStartEditingStats,
  onSaveEdit,
  onSaveStats,
  onCancelEdit,
  onToggleCourt,
  getCourtTimeStatus,
  getBenchTimeStatus
}) => {
  const isFouledOut = player.fouls >= 5;
  const isUnselected = player.position === 'Unselected';
  const isEditing = editingPlayer === player.id;
  const isEditingStatsMode = editingStats === player.id;
  const foulBgClass = getFoulBgClass(player.fouls, currentQuarter);
  const longPressTimer = useRef(null);

  // Calcular el borde según tiempo
  const getTimeBorderClass = () => {
    if (isUnselected) return 'border-gray-500';
    if (player.onCourt) {
      const status = getCourtTimeStatus(player);
      return status === 'green' ? 'border-green-500' : status === 'yellow' ? 'border-yellow-500' : 'border-red-500';
    } else {
      const status = getBenchTimeStatus(player);
      return status === 'green' ? 'border-green-500' : status === 'yellow' ? 'border-yellow-500' : 'border-red-500';
    }
  };

  const borderClass = getTimeBorderClass();
  const dimClass = isRosterView && player.onCourt ? 'opacity-25' : '';

  // Long press handlers para el botón de editar
  const handleEditMouseDown = () => {
    longPressTimer.current = setTimeout(() => {
      onStartEditingStats(player);
    }, 600);
  };

  const handleEditMouseUp = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      // Si no fue long press, hacer edición normal
      if (!isEditingStatsMode) {
        onStartEditing(player);
      }
    }
  };

  const handleEditMouseLeave = () => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
    }
  };

  // Modo edición de stats (long press)
  if (isEditingStatsMode) {
    return (
      <div className="rounded-lg p-2 border-2 border-orange-500 bg-orange-900">
        <div className="text-xs font-bold text-orange-300 mb-2 text-center">Editar Stats</div>
        <div className="space-y-1">
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-300 w-12">🏀 Pista:</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={statsForm.totalCourtTime}
              onChange={(e) => onStatsFormChange({...statsForm, totalCourtTime: parseFloat(e.target.value) || 0})}
              className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-300 w-12">💺 Banco:</span>
            <input
              type="number"
              min="0"
              step="0.1"
              value={statsForm.totalBenchTime}
              onChange={(e) => onStatsFormChange({...statsForm, totalBenchTime: parseFloat(e.target.value) || 0})}
              className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-300 w-12">Faltas:</span>
            <input
              type="number"
              min="0"
              max="5"
              value={statsForm.fouls}
              onChange={(e) => onStatsFormChange({...statsForm, fouls: parseInt(e.target.value) || 0})}
              className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-xs"
            />
          </div>
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-300 w-12">Puntos:</span>
            <input
              type="number"
              min="0"
              value={statsForm.points}
              onChange={(e) => onStatsFormChange({...statsForm, points: parseInt(e.target.value) || 0})}
              className="flex-1 bg-gray-800 text-white px-2 py-1 rounded text-xs"
            />
          </div>
        </div>
        <div className="flex gap-1 mt-2">
          <button onClick={onSaveStats} className="flex-1 py-1 bg-green-600 rounded text-xs font-bold">✓ Guardar</button>
          <button onClick={onCancelEdit} className="flex-1 py-1 bg-red-600 rounded text-xs font-bold">✗ Cancelar</button>
        </div>
      </div>
    );
  }

  // Modo edición normal (click corto)
  if (isEditing) {
    return (
      <div className="rounded-lg p-2 border-2 border-purple-500 bg-purple-900">
        <input
          type="text"
          value={editForm.name}
          onChange={(e) => onEditFormChange({...editForm, name: e.target.value})}
          className="w-full bg-gray-800 text-white px-2 py-1 rounded text-xs mb-1"
          placeholder="Nombre"
        />
        <input
          type="text"
          value={editForm.number}
          onChange={(e) => onEditFormChange({...editForm, number: e.target.value})}
          className="w-full bg-gray-800 text-white px-2 py-1 rounded text-xs mb-1"
          placeholder="#"
        />
        <select
          value={editForm.position}
          onChange={(e) => onEditFormChange({...editForm, position: e.target.value})}
          className="w-full bg-gray-800 text-white px-2 py-1 rounded text-xs mb-1"
        >
          <option value="Base">Base</option>
          <option value="Alero">Alero</option>
          <option value="Joker">Joker</option>
          <option value="Unselected">No</option>
        </select>
        <div className="flex gap-1">
          <button onClick={onSaveEdit} className="flex-1 py-1 bg-green-600 rounded text-xs font-bold">✓</button>
          <button onClick={onCancelEdit} className="flex-1 py-1 bg-red-600 rounded text-xs font-bold">✗</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`rounded-lg p-1.5 sm:p-2 border-3 ${borderClass} ${player.onCourt ? 'bg-blue-700' : isUnselected ? 'bg-gray-700 opacity-50' : 'bg-gray-800'} ${dimClass}`}>
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-xs font-black text-white bg-black/30 px-1 rounded">#{player.number}</span>
          <span className="text-xs font-bold text-white truncate">{player.name}</span>
        </div>
        <button
          onMouseDown={handleEditMouseDown}
          onMouseUp={handleEditMouseUp}
          onMouseLeave={handleEditMouseLeave}
          onTouchStart={handleEditMouseDown}
          onTouchEnd={handleEditMouseUp}
          className="p-0.5 ml-1 flex-shrink-0"
        >
          <Edit3 className="w-3 h-3 text-gray-400" />
        </button>
      </div>

      {isFouledOut && <div className="bg-red-500 text-white text-center py-0.5 rounded mb-1 text-xs font-bold">OUT</div>}

      <div className="flex gap-1 mb-1">
        <div className="flex-1 bg-black/30 rounded px-1 py-1 text-center min-w-0">
          <div className="text-sm sm:text-base font-black text-white tabular-nums">{formatTime(player.currentMinutes)}</div>
        </div>
        <div className={`${foulBgClass} rounded px-2 py-1 flex items-center justify-center min-w-[32px]`}>
          <span className="text-sm sm:text-base font-black text-white">{player.fouls}</span>
        </div>
      </div>

      <div className="flex gap-1 mb-1">
        <div className="flex-1 bg-black/20 rounded px-1 py-1 text-center min-w-0">
          <div className="text-sm leading-none mb-0.5">🏀</div>
          <div className="text-xs font-bold text-gray-300 tabular-nums">{formatTime(player.totalCourtTime)}</div>
        </div>
        <div className="flex-1 bg-black/20 rounded px-1 py-1 text-center min-w-0">
          <div className="text-sm leading-none mb-0.5">💺</div>
          <div className="text-xs font-bold text-gray-300 tabular-nums">{formatTime(player.totalBenchTime)}</div>
        </div>
      </div>

      <div className="bg-orange-600/50 border border-orange-400 rounded px-1 py-0.5 mb-1 text-center">
        <span className="text-xs font-bold text-orange-200">{player.points} pts</span>
      </div>

      <button
        onClick={() => onToggleCourt(player.id)}
        disabled={isFouledOut || isUnselected || (isRosterView && player.onCourt)}
        className={`w-full py-1.5 rounded font-bold text-xs ${isFouledOut || isUnselected || (isRosterView && player.onCourt) ? 'bg-gray-600 opacity-50' : player.onCourt ? 'bg-orange-600 active:bg-orange-500' : 'bg-green-600 active:bg-green-500'}`}
      >
        {isUnselected ? 'N/A' : player.onCourt ? 'OUT' : 'IN'}
      </button>
    </div>
  );
});

PlayerCard.displayName = 'PlayerCard';

// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function BasketballRotationTracker({ initialPlayers, onExit, onGameSaved, savedGameData }) {
  // Jugadores: usar initialPlayers prop o los hardcoded por defecto
  const effectivePlayers = initialPlayers || INITIAL_PLAYERS;

  // Estado para saber si ya cargamos datos guardados
  const [isInitialized, setIsInitialized] = useState(false);

  // Estados de navegación
  // Si nos pasan savedGameData, ir directo al partido; si no, a seleccion de equipo
  const [currentScreen, setCurrentScreen] = useState(() => savedGameData ? 'game' : 'team-selection');
  const [currentGameId, setCurrentGameId] = useState(() => savedGameData?.id || null);
  const [showExitModal, setShowExitModal] = useState(false);

  // Estados principales del juego
  const [gameStarted, setGameStarted] = useState(() => savedGameData?.gameStarted ?? false);
  const [isHomeTeam, setIsHomeTeam] = useState(() => savedGameData?.isHomeTeam ?? null);
  const [players, setPlayers] = useState(() => {
    if (savedGameData?.players) return savedGameData.players;
    return effectivePlayers.map(createInitialPlayerState);
  });
  const [gameRunning, setGameRunning] = useState(false);
  const [gameTime, setGameTime] = useState(() => savedGameData?.gameTime ?? 600);
  const [currentQuarter, setCurrentQuarter] = useState(() => savedGameData?.currentQuarter ?? 1);

  // Estados de UI
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showQuarterSelector, setShowQuarterSelector] = useState(false);
  const [showIntervalsModal, setShowIntervalsModal] = useState(false);
  const [showScoreModal, setShowScoreModal] = useState(false);
  const [showFoulModal, setShowFoulModal] = useState(false);
  const [showFouledOutModal, setShowFouledOutModal] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState(null);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingScore, setEditingScore] = useState(null);
  const [editingGameTime, setEditingGameTime] = useState(false);
  const [editGameTimeForm, setEditGameTimeForm] = useState({ minutes: 0, seconds: 0 });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editingStats, setEditingStats] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', number: '', position: '' });
  const [statsForm, setStatsForm] = useState({ totalCourtTime: 0, totalBenchTime: 0, fouls: 0, points: 0 });
  const [isLongPress, setIsLongPress] = useState(false);
  const [fouledOutPlayer, setFouledOutPlayer] = useState(null);

  // Configuración
  const [intervals, setIntervals] = useState(() => savedGameData?.intervals || { green: { minutes: 3, seconds: 0 }, yellow: { minutes: 4, seconds: 30 } });
  const [benchIntervals, setBenchIntervals] = useState(() => savedGameData?.benchIntervals || { red: { minutes: 3, seconds: 0 }, yellow: { minutes: 4, seconds: 30 } });

  // Equipos y marcador
  const [homeTeam, setHomeTeam] = useState(() => savedGameData?.homeTeam || 'Home');
  const [awayTeam, setAwayTeam] = useState(() => savedGameData?.awayTeam || 'Away');
  const [homeScore, setHomeScore] = useState(() => savedGameData?.homeScore ?? 0);
  const [awayScore, setAwayScore] = useState(() => savedGameData?.awayScore ?? 0);

  // Historial y estadísticas
  const [rotationHistory, setRotationHistory] = useState(() => savedGameData?.rotationHistory || []);
  const [actionHistory, setActionHistory] = useState(() => savedGameData?.actionHistory || []);
  const [quintetHistory, setQuintetHistory] = useState(() => savedGameData?.quintetHistory || []);
  const [currentQuintet, setCurrentQuintet] = useState(() => savedGameData?.currentQuintet || null);
  const [substitutionsByQuarter, setSubstitutionsByQuarter] = useState(() => savedGameData?.substitutionsByQuarter || { 1: 0, 2: 0, 3: 0, 4: 0 });
  const [scoresByQuarter, setScoresByQuarter] = useState(() => savedGameData?.scoresByQuarter || { 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } });
  const [leadChanges, setLeadChanges] = useState(() => savedGameData?.leadChanges ?? 0);
  const [ties, setTies] = useState(() => savedGameData?.ties ?? 0);
  const [biggestLead, setBiggestLead] = useState(() => savedGameData?.biggestLead || { us: 0, them: 0 });
  const [partialScores, setPartialScores] = useState(() => savedGameData?.partialScores || INITIAL_PARTIAL_SCORES);

  // Refs
  const longPressTimer = useRef(null);
  const lastSaveTime = useRef(Date.now());

  // ============================================
  // AUTOGUARDADO Y RECUPERACIÓN
  // ============================================

  // Migrar datos antiguos y configurar pantalla inicial
  useEffect(() => {
    try {
      // Verificar si hay datos en formato antiguo (migración)
      const oldData = localStorage.getItem(STORAGE_KEY);
      if (oldData) {
        const parsed = JSON.parse(oldData);

        // Si tiene datos de un partido, migrarlo al nuevo formato
        if (parsed.gameStarted) {
          const newId = generateGameId();
          const gameData = { ...parsed, id: newId };
          saveGameData(newId, gameData);

          addGameToList({
            id: newId,
            createdAt: parsed.savedAt || new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            status: 'in_progress',
            homeTeam: parsed.homeTeam || 'Home',
            awayTeam: parsed.awayTeam || 'Away',
            homeScore: parsed.homeScore || 0,
            awayScore: parsed.awayScore || 0,
            isHomeTeam: parsed.isHomeTeam,
            currentQuarter: parsed.currentQuarter || 1
          });

          console.log('✅ Datos migrados al nuevo formato');
        }

        // Eliminar formato antiguo
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch (error) {
      console.error('Error en migración:', error);
    }

    setIsInitialized(true);
  }, []);

  // Función para cargar un partido completo
  const loadGame = useCallback((gameId) => {
    const data = loadGameData(gameId);
    if (!data) return;

    setCurrentGameId(gameId);
    setGameStarted(data.gameStarted ?? false);
    setIsHomeTeam(data.isHomeTeam);
    setPlayers(data.players || effectivePlayers.map(createInitialPlayerState));
    setGameRunning(false); // Siempre pausado al cargar
    setGameTime(data.gameTime ?? 600);
    setCurrentQuarter(data.currentQuarter ?? 1);
    setIntervals(data.intervals || { green: { minutes: 3, seconds: 0 }, yellow: { minutes: 4, seconds: 30 } });
    setBenchIntervals(data.benchIntervals || { red: { minutes: 3, seconds: 0 }, yellow: { minutes: 4, seconds: 30 } });
    setHomeTeam(data.homeTeam || 'Home');
    setAwayTeam(data.awayTeam || 'Away');
    setHomeScore(data.homeScore ?? 0);
    setAwayScore(data.awayScore ?? 0);
    setRotationHistory(data.rotationHistory || []);
    setActionHistory(data.actionHistory || []);
    setQuintetHistory(data.quintetHistory || []);
    setCurrentQuintet(data.currentQuintet || null);
    setSubstitutionsByQuarter(data.substitutionsByQuarter || { 1: 0, 2: 0, 3: 0, 4: 0 });
    setScoresByQuarter(data.scoresByQuarter || { 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } });
    setLeadChanges(data.leadChanges ?? 0);
    setTies(data.ties ?? 0);
    setBiggestLead(data.biggestLead || { us: 0, them: 0 });
    setPartialScores(data.partialScores || INITIAL_PARTIAL_SCORES);

    setCurrentScreen('game');
    console.log('✅ Partido cargado:', gameId);
  }, []);

  // Función para crear nuevo partido
  const createNewGame = useCallback((isHome) => {
    const newId = generateGameId();

    // Reset estados a valores iniciales
    setCurrentGameId(newId);
    setGameStarted(true);
    setIsHomeTeam(isHome);
    setPlayers(effectivePlayers.map(createInitialPlayerState));
    setGameRunning(false);
    setGameTime(600);
    setCurrentQuarter(1);
    setHomeTeam('Home');
    setAwayTeam('Away');
    setHomeScore(0);
    setAwayScore(0);
    setRotationHistory([]);
    setActionHistory([]);
    setQuintetHistory([]);
    setCurrentQuintet(null);
    setSubstitutionsByQuarter({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setScoresByQuarter({ 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } });
    setLeadChanges(0);
    setTies(0);
    setBiggestLead({ us: 0, them: 0 });
    setPartialScores(INITIAL_PARTIAL_SCORES);

    // Añadir a la lista de partidos (localStorage legacy)
    addGameToList({
      id: newId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      status: 'in_progress',
      homeTeam: 'Home',
      awayTeam: 'Away',
      homeScore: 0,
      awayScore: 0,
      isHomeTeam: isHome,
      currentQuarter: 1
    });

    setCurrentScreen('game');
  }, [effectivePlayers]);

  // Función para guardar estado del partido actual
  const saveState = useCallback(() => {
    if (!isInitialized || !currentGameId) return;

    try {
      const stateToSave = {
        id: currentGameId,
        gameStarted,
        isHomeTeam,
        players,
        gameRunning,
        gameTime,
        currentQuarter,
        intervals,
        benchIntervals,
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        rotationHistory,
        actionHistory,
        quintetHistory,
        currentQuintet,
        substitutionsByQuarter,
        scoresByQuarter,
        leadChanges,
        ties,
        biggestLead,
        partialScores,
        savedAt: Date.now()
      };

      // Guardar datos completos del partido
      saveGameData(currentGameId, stateToSave);

      // Actualizar info en la lista
      updateGameInList({
        id: currentGameId,
        updatedAt: new Date().toISOString(),
        homeTeam,
        awayTeam,
        homeScore,
        awayScore,
        currentQuarter
      });

      lastSaveTime.current = Date.now();
    } catch (error) {
      console.error('Error guardando estado:', error);
    }
  }, [
    isInitialized, currentGameId, gameStarted, isHomeTeam, players, gameRunning, gameTime, currentQuarter,
    intervals, benchIntervals, homeTeam, awayTeam, homeScore, awayScore,
    rotationHistory, actionHistory, quintetHistory, currentQuintet,
    substitutionsByQuarter, scoresByQuarter, leadChanges, ties, biggestLead, partialScores
  ]);

  // Obtener estado completo del partido para sincronizar
  const getFullGameState = useCallback(() => ({
    id: currentGameId,
    gameStarted,
    isHomeTeam,
    players,
    gameRunning: false,
    gameTime,
    currentQuarter,
    intervals,
    benchIntervals,
    homeTeam,
    awayTeam,
    homeScore,
    awayScore,
    rotationHistory,
    actionHistory,
    quintetHistory,
    currentQuintet,
    substitutionsByQuarter,
    scoresByQuarter,
    leadChanges,
    ties,
    biggestLead,
    partialScores,
    savedAt: Date.now()
  }), [
    currentGameId, gameStarted, isHomeTeam, players, gameTime, currentQuarter,
    intervals, benchIntervals, homeTeam, awayTeam, homeScore, awayScore,
    rotationHistory, actionHistory, quintetHistory, currentQuintet,
    substitutionsByQuarter, scoresByQuarter, leadChanges, ties, biggestLead, partialScores
  ]);

  // Guardar y volver
  const saveAndExit = useCallback(() => {
    saveState();
    const gameState = getFullGameState();
    gameState.status = 'in_progress';
    if (onGameSaved) onGameSaved(gameState);
    setShowExitModal(false);
    if (onExit) {
      onExit();
    } else {
      setCurrentScreen('home');
      setCurrentGameId(null);
      setGameStarted(false);
    }
  }, [saveState, getFullGameState, onExit, onGameSaved]);

  // Finalizar partido y volver
  const finishGame = useCallback(() => {
    saveState();
    const gameState = getFullGameState();
    gameState.status = 'completed';
    if (onGameSaved) onGameSaved(gameState);

    // Marcar como completado en localStorage legacy
    updateGameInList({
      id: currentGameId,
      status: 'completed',
      updatedAt: new Date().toISOString()
    });

    setShowExitModal(false);
    if (onExit) {
      onExit();
    } else {
      setCurrentScreen('home');
      setCurrentGameId(null);
      setGameStarted(false);
    }
  }, [saveState, getFullGameState, currentGameId, onExit, onGameSaved]);

  // Eliminar partido del historial
  const deleteGame = useCallback((gameId) => {
    removeGameFromList(gameId);
  }, []);

  // Autoguardado periódico
  useEffect(() => {
    if (!isInitialized || !currentGameId || currentScreen !== 'game') return;

    const interval = setInterval(() => {
      saveState();
      // Sincronizar con Supabase via callback
      if (onGameSaved) {
        const state = getFullGameState();
        state.status = 'in_progress';
        onGameSaved(state);
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [isInitialized, currentGameId, currentScreen, saveState, onGameSaved, getFullGameState]);

  // Guardar al cerrar ventana o cambiar de pestaña
  useEffect(() => {
    if (!isInitialized || !currentGameId || currentScreen !== 'game') return;

    // Guardar cuando el usuario cierra la ventana/pestaña
    const handleBeforeUnload = (e) => {
      saveState();
      // Algunos navegadores requieren esto para mostrar diálogo de confirmación
      e.preventDefault();
      e.returnValue = '';
    };

    // Guardar cuando el usuario cambia de pestaña (útil en móviles)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveState();
      }
    };

    // Guardar cuando la app pierde el foco (útil en móviles)
    const handleBlur = () => {
      saveState();
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isInitialized, currentGameId, currentScreen, saveState]);

  // Guardar al cambiar estados importantes
  useEffect(() => {
    if (isInitialized && currentGameId && currentScreen === 'game') {
      // Debounce: solo guardar si pasaron más de 1 segundo desde el último guardado
      const now = Date.now();
      if (now - lastSaveTime.current > 1000) {
        saveState();
      }
    }
  }, [homeScore, awayScore, players, currentQuarter, gameTime, isInitialized, currentGameId, currentScreen, saveState]);

  // ============================================
  // FUNCIONES MEMOIZADAS
  // ============================================

  const getCurrentScores = useCallback(() => ({
    ourScore: isHomeTeam ? homeScore : awayScore,
    rivalScore: isHomeTeam ? awayScore : homeScore
  }), [isHomeTeam, homeScore, awayScore]);

  const getCourtTimeStatus = useCallback((player) => {
    const currentMins = player.currentMinutes;
    const greenLimit = intervals.green.minutes + intervals.green.seconds / 60;
    const yellowLimit = intervals.yellow.minutes + intervals.yellow.seconds / 60;
    if (currentMins < greenLimit) return 'green';
    if (currentMins < yellowLimit) return 'yellow';
    return 'red';
  }, [intervals]);

  const getBenchTimeStatus = useCallback((player) => {
    const currentMins = player.currentMinutes;
    const redLimit = benchIntervals.red.minutes + benchIntervals.red.seconds / 60;
    const yellowLimit = benchIntervals.yellow.minutes + benchIntervals.yellow.seconds / 60;
    if (currentMins < redLimit) return 'red';
    if (currentMins < yellowLimit) return 'yellow';
    return 'green';
  }, [benchIntervals]);

  const getPreviousQuartersTotal = useCallback((team) => {
    let total = 0;
    for (let q = 1; q < currentQuarter; q++) {
      total += scoresByQuarter[q][team === 'us' ? 'us' : 'them'];
    }
    return total;
  }, [currentQuarter, scoresByQuarter]);

  // ============================================
  // TIMER OPTIMIZADO
  // ============================================
  useEffect(() => {
    if (!gameRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // Actualizar tiempo de juego
      setGameTime(prev => {
        if (prev <= 0) {
          setGameRunning(false);
          if (currentQuarter < 4) {
            setCurrentQuarter(q => q + 1);
            return 600;
          }
          return 0;
        }
        return prev - 1;
      });

      // Actualizar tiempo de jugadores - OPTIMIZADO
      setPlayers(prev => {
        let hasChanges = false;
        const updated = prev.map(p => {
          if (p.lastToggle) {
            hasChanges = true;
            const elapsed = (now - p.lastToggle) / 1000 / 60;
            return {
              ...p,
              currentMinutes: p.currentMinutes + elapsed,
              totalCourtTime: p.onCourt ? p.totalCourtTime + elapsed : p.totalCourtTime,
              totalBenchTime: !p.onCourt ? p.totalBenchTime + elapsed : p.totalBenchTime,
              lastToggle: now
            };
          }
          return p;
        });

        // Solo retornar nuevo array si hubo cambios
        return hasChanges ? updated : prev;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [gameRunning, currentQuarter]);

  // ============================================
  // EFECTOS PARA PARCIALES
  // ============================================
  useEffect(() => {
    if (!gameStarted) return;

    const { ourScore, rivalScore } = getCurrentScores();

    if (gameTime <= 300 && !partialScores[currentQuarter].first.locked) {
      setPartialScores(prev => ({
        ...prev,
        [currentQuarter]: {
          ...prev[currentQuarter],
          first: {
            us: ourScore - getPreviousQuartersTotal('us'),
            them: rivalScore - getPreviousQuartersTotal('them'),
            locked: true
          }
        }
      }));
    }

    if (gameTime <= 0 && !partialScores[currentQuarter].second.locked) {
      const firstHalfUs = partialScores[currentQuarter].first.us;
      const firstHalfThem = partialScores[currentQuarter].first.them;
      const quarterTotalUs = ourScore - getPreviousQuartersTotal('us');
      const quarterTotalThem = rivalScore - getPreviousQuartersTotal('them');

      setPartialScores(prev => ({
        ...prev,
        [currentQuarter]: {
          ...prev[currentQuarter],
          second: {
            us: quarterTotalUs - firstHalfUs,
            them: quarterTotalThem - firstHalfThem,
            locked: true
          }
        }
      }));
    }
  }, [gameTime, currentQuarter, gameStarted, getCurrentScores, getPreviousQuartersTotal, partialScores]);

  // ============================================
  // VALORES CALCULADOS (MEMOIZADOS)
  // ============================================
  const onCourtPlayers = useMemo(() => players.filter(p => p.onCourt), [players]);
  const onCourtCount = onCourtPlayers.length;

  const warningPlayers = useMemo(() =>
    players.filter(p => getFoulStatus(p.fouls, currentQuarter) === 'warning' && p.position !== 'Unselected'),
    [players, currentQuarter]
  );

  const dangerPlayers = useMemo(() =>
    players.filter(p => getFoulStatus(p.fouls, currentQuarter) === 'danger' && p.fouls < 5 && p.position !== 'Unselected'),
    [players, currentQuarter]
  );

  const ourTeamName = isHomeTeam ? homeTeam : awayTeam;
  const rivalTeamName = isHomeTeam ? awayTeam : homeTeam;

  const { bases, aleros, jokers, unselected } = useMemo(() => ({
    bases: players.filter(p => p.position === 'Base'),
    aleros: players.filter(p => p.position === 'Alero'),
    jokers: players.filter(p => p.position === 'Joker'),
    unselected: players.filter(p => p.position === 'Unselected')
  }), [players]);

  // Recomendaciones de cambio - MEMOIZADO
  const subRecommendations = useMemo(() => {
    const recommendations = [];
    const benchPlayers = players.filter(p => !p.onCourt && p.fouls < 5 && getFoulStatus(p.fouls, currentQuarter) === 'safe' && p.position !== 'Unselected');
    const jokersOnCourt = onCourtPlayers.filter(p => p.position === 'Joker').length;
    const flexibleJokers = ['Jorge', 'Unai'];

    onCourtPlayers.forEach(player => {
      const courtStatus = getCourtTimeStatus(player);
      const foulStatus = getFoulStatus(player.fouls, currentQuarter);
      const needsSubForStint = courtStatus === 'red';
      const needsSubForFouls = foulStatus === 'danger' || foulStatus === 'warning';

      if (needsSubForFouls || needsSubForStint) {
        let samePositionBench = benchPlayers.filter(p => p.position === player.position);
        let crossPositionSuggestions = [];

        if (player.position === 'Alero') {
          const flexibleJokersOnBench = benchPlayers.filter(p =>
            p.position === 'Joker' && flexibleJokers.includes(p.name)
          );

          if (jokersOnCourt >= 1) {
            crossPositionSuggestions = flexibleJokersOnBench.map(p => ({
              ...p,
              isPlayingOutOfPosition: true,
              originalPosition: 'Joker',
              playingAs: 'Alero'
            }));
          }
        }

        if (samePositionBench.length > 0 || crossPositionSuggestions.length > 0) {
          const statusOrder = { green: 0, yellow: 1, red: 2 };
          const sortedSamePosition = [...samePositionBench].sort((a, b) =>
            statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]
          );
          const sortedCrossPosition = [...crossPositionSuggestions].sort((a, b) =>
            statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]
          );
          const allSuggestions = [...sortedSamePosition, ...sortedCrossPosition];

          let reason = '', priority = 0, isFoulIssue = false;

          if (foulStatus === 'danger') {
            reason = `FALTAS (${player.fouls}/5 en Q${currentQuarter})`;
            priority = 4;
            isFoulIssue = true;
          } else if (foulStatus === 'warning') {
            reason = `Faltas (${player.fouls}/5 en Q${currentQuarter})`;
            priority = 3;
            isFoulIssue = true;
          } else if (needsSubForStint) {
            reason = `DESCANSO (${formatTime(player.currentMinutes)} seguidos)`;
            priority = 1;
          }

          recommendations.push({ out: player, suggestions: allSuggestions, reason, priority, isFoulIssue });
        }
      }
    });

    return recommendations.sort((a, b) => b.priority - a.priority);
  }, [players, onCourtPlayers, currentQuarter, getCourtTimeStatus, getBenchTimeStatus]);

  const fouledOutReplacements = useMemo(() => {
    if (!fouledOutPlayer) return [];
    const benchPlayers = players.filter(p => !p.onCourt && p.fouls < 5 && getFoulStatus(p.fouls, currentQuarter) === 'safe' && p.position !== 'Unselected');
    const statusOrder = { green: 0, yellow: 1, red: 2 };
    return benchPlayers
      .filter(p => p.position === fouledOutPlayer.position)
      .sort((a, b) => statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]);
  }, [fouledOutPlayer, players, currentQuarter, getBenchTimeStatus]);

  const getCurrentPartialScores = useCallback(() => {
    const { ourScore, rivalScore } = getCurrentScores();
    const result = {};

    for (let q = 1; q <= 4; q++) {
      const qScores = partialScores[q];

      if (q < currentQuarter) {
        result[q] = {
          first: { us: qScores.first.us, them: qScores.first.them },
          second: { us: qScores.second.us, them: qScores.second.them }
        };
      } else if (q === currentQuarter) {
        const prevUs = getPreviousQuartersTotal('us');
        const prevThem = getPreviousQuartersTotal('them');
        const quarterUs = ourScore - prevUs;
        const quarterThem = rivalScore - prevThem;

        if (qScores.first.locked) {
          result[q] = {
            first: { us: qScores.first.us, them: qScores.first.them },
            second: { us: quarterUs - qScores.first.us, them: quarterThem - qScores.first.them }
          };
        } else {
          result[q] = {
            first: { us: quarterUs, them: quarterThem },
            second: { us: 0, them: 0 }
          };
        }
      } else {
        result[q] = {
          first: { us: 0, them: 0 },
          second: { us: 0, them: 0 }
        };
      }
    }
    return result;
  }, [getCurrentScores, currentQuarter, partialScores, getPreviousQuartersTotal]);

  // ============================================
  // FUNCIONES DE QUINTETO
  // ============================================
  const startNewQuintet = useCallback((playerIds, ourScore, rivalScore) => {
    setCurrentQuintet({
      key: getQuintetKey(playerIds),
      playerIds: [...playerIds],
      startTime: Date.now(),
      startOurScore: ourScore,
      startRivalScore: rivalScore,
      quarter: currentQuarter
    });
  }, [currentQuarter]);

  const endCurrentQuintet = useCallback((ourScore, rivalScore) => {
    setCurrentQuintet(prev => {
      if (prev) {
        const duration = (Date.now() - prev.startTime) / 1000 / 60;
        setQuintetHistory(h => [...h, {
          ...prev,
          endTime: Date.now(),
          duration,
          pointsScored: ourScore - prev.startOurScore,
          pointsAllowed: rivalScore - prev.startRivalScore,
          differential: (ourScore - prev.startOurScore) - (rivalScore - prev.startRivalScore)
        }]);
      }
      return null;
    });
  }, []);

  const updateGameFlow = useCallback((newOurScore, newRivalScore) => {
    const { ourScore, rivalScore } = getCurrentScores();
    const prevDiff = ourScore - rivalScore;
    const newDiff = newOurScore - newRivalScore;

    if (newDiff === 0 && prevDiff !== 0) setTies(prev => prev + 1);
    if ((prevDiff > 0 && newDiff < 0) || (prevDiff < 0 && newDiff > 0)) setLeadChanges(prev => prev + 1);
    if (newDiff > biggestLead.us) setBiggestLead(prev => ({ ...prev, us: newDiff }));
    if (-newDiff > biggestLead.them) setBiggestLead(prev => ({ ...prev, them: -newDiff }));
  }, [getCurrentScores, biggestLead]);

  // ============================================
  // FUNCIONES DE ACCIONES
  // ============================================
  const toggleCourt = useCallback((playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player || player.fouls >= 5 || player.position === 'Unselected') return;

    const currentOnCourtCount = players.filter(p => p.onCourt).length;
    if (!player.onCourt && currentOnCourtCount >= 5) return;

    // Pausar cronómetro al hacer cambios
    setGameRunning(false);

    const now = Date.now();
    const { ourScore, rivalScore } = getCurrentScores();

    if (currentOnCourtCount === 5) {
      endCurrentQuintet(ourScore, rivalScore);
    }

    setActionHistory(prev => [...prev, {
      type: 'substitution',
      playerId,
      wasOnCourt: player.onCourt,
      scoreAtAction: { ourScore, rivalScore }
    }]);

    setSubstitutionsByQuarter(prev => ({
      ...prev,
      [currentQuarter]: prev[currentQuarter] + 1
    }));

    setPlayers(prev => {
      const newPlayers = prev.map(p => {
        if (p.id === playerId) {
          if (p.onCourt) {
            const stintPM = p.currentStintStart
              ? (ourScore - p.currentStintStart.ourScore) - (rivalScore - p.currentStintStart.rivalScore)
              : 0;
            setRotationHistory(h => [...h, {
              time: `Q${currentQuarter}`,
              type: 'OUT',
              player: `#${p.number} ${p.name}`
            }]);
            return {
              ...p,
              onCourt: false,
              currentMinutes: 0,
              lastToggle: gameRunning ? now : null,
              stints: [...p.stints, p.currentMinutes],
              stintPlusMinus: [...p.stintPlusMinus, stintPM],
              currentStintStart: null
            };
          } else {
            setRotationHistory(h => [...h, {
              time: `Q${currentQuarter}`,
              type: 'IN',
              player: `#${p.number} ${p.name}`
            }]);
            return {
              ...p,
              onCourt: true,
              currentMinutes: 0,
              lastToggle: gameRunning ? now : null,
              currentStintStart: { ourScore, rivalScore }
            };
          }
        }
        return p;
      });

      const newOnCourt = newPlayers.filter(p => p.onCourt);
      if (newOnCourt.length === 5) {
        startNewQuintet(newOnCourt.map(p => p.id), ourScore, rivalScore);
      }
      return newPlayers;
    });
  }, [players, getCurrentScores, endCurrentQuintet, startNewQuintet, currentQuarter, gameRunning]);

  const toggleGameRunning = useCallback(() => {
    const currentOnCourtCount = players.filter(p => p.onCourt).length;
    if (!gameRunning && currentOnCourtCount !== 5) return;

    const { ourScore, rivalScore } = getCurrentScores();

    if (!gameRunning) {
      setPlayers(prev => prev.map(p => ({ ...p, lastToggle: Date.now() })));
      const onCourt = players.filter(p => p.onCourt);
      if (onCourt.length === 5 && !currentQuintet) {
        startNewQuintet(onCourt.map(p => p.id), ourScore, rivalScore);
      }
    } else {
      endCurrentQuintet(ourScore, rivalScore);
    }
    setGameRunning(!gameRunning);
  }, [players, gameRunning, getCurrentScores, currentQuintet, startNewQuintet, endCurrentQuintet]);

  const addFoulToPlayer = useCallback((playerId) => {
    const player = players.find(p => p.id === playerId);
    if (!player || player.fouls >= 5) return;

    const newFouls = player.fouls + 1;
    const { ourScore, rivalScore } = getCurrentScores();

    setActionHistory(prev => [...prev, {
      type: 'foul',
      playerId,
      delta: 1,
      previousFouls: player.fouls,
      wasOnCourt: player.onCourt,
      scoreAtAction: { ourScore, rivalScore }
    }]);

    if (newFouls >= 5 && player.onCourt) {
      endCurrentQuintet(ourScore, rivalScore);

      setPlayers(prev => prev.map(p => {
        if (p.id === playerId) {
          const stintPM = p.currentStintStart
            ? (ourScore - p.currentStintStart.ourScore) - (rivalScore - p.currentStintStart.rivalScore)
            : 0;
          return {
            ...p,
            fouls: newFouls,
            onCourt: false,
            currentMinutes: 0,
            lastToggle: gameRunning ? Date.now() : null,
            stints: [...p.stints, p.currentMinutes],
            stintPlusMinus: [...p.stintPlusMinus, stintPM],
            currentStintStart: null
          };
        }
        return p;
      }));

      setRotationHistory(h => [...h, {
        time: `Q${currentQuarter}`,
        type: 'FOULED OUT',
        player: `#${player.number} ${player.name}`
      }]);
      setFouledOutPlayer({...player, fouls: newFouls});
      setShowFoulModal(false);
      setShowFouledOutModal(true);
    } else {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, fouls: newFouls } : p));
      setShowFoulModal(false);
    }
  }, [players, getCurrentScores, endCurrentQuintet, currentQuarter, gameRunning]);

  const undoLastAction = useCallback(() => {
    if (actionHistory.length === 0) return;

    const lastAction = actionHistory[actionHistory.length - 1];

    if (lastAction.type === 'score') {
      if (lastAction.isOurTeam) {
        if (isHomeTeam) setHomeScore(prev => prev - lastAction.points);
        else setAwayScore(prev => prev - lastAction.points);
        if (lastAction.playerId) {
          setPlayers(prev => prev.map(p =>
            p.id === lastAction.playerId ? { ...p, points: p.points - lastAction.points } : p
          ));
        }
        setScoresByQuarter(prev => ({
          ...prev,
          [currentQuarter]: {
            ...prev[currentQuarter],
            us: prev[currentQuarter].us - lastAction.points
          }
        }));
      } else {
        if (isHomeTeam) setAwayScore(prev => prev - lastAction.points);
        else setHomeScore(prev => prev - lastAction.points);
        setScoresByQuarter(prev => ({
          ...prev,
          [currentQuarter]: {
            ...prev[currentQuarter],
            them: prev[currentQuarter].them - lastAction.points
          }
        }));
      }
    } else if (lastAction.type === 'foul') {
      setPlayers(prev => prev.map(p =>
        p.id === lastAction.playerId
          ? { ...p, fouls: lastAction.previousFouls, onCourt: lastAction.wasOnCourt !== undefined ? lastAction.wasOnCourt : p.onCourt }
          : p
      ));
      if (lastAction.previousFouls === 4 && lastAction.wasOnCourt) {
        setRotationHistory(prev => prev.slice(0, -1));
        setFouledOutPlayer(null);
        setShowFouledOutModal(false);
      }
    } else if (lastAction.type === 'substitution') {
      setPlayers(prev => prev.map(p =>
        p.id === lastAction.playerId ? { ...p, onCourt: lastAction.wasOnCourt, currentMinutes: 0 } : p
      ));
      setRotationHistory(prev => prev.slice(0, -1));
      setSubstitutionsByQuarter(prev => ({
        ...prev,
        [currentQuarter]: Math.max(0, prev[currentQuarter] - 1)
      }));
    } else if (lastAction.type === 'swap') {
      setPlayers(prev => prev.map(p => {
        if (p.id === lastAction.outId) return { ...p, onCourt: true, currentMinutes: 0 };
        if (p.id === lastAction.inId) return { ...p, onCourt: false, currentMinutes: 0 };
        return p;
      }));
      setRotationHistory(prev => prev.slice(0, -2));
      setSubstitutionsByQuarter(prev => ({
        ...prev,
        [currentQuarter]: Math.max(0, prev[currentQuarter] - 2)
      }));
    }

    setActionHistory(prev => prev.slice(0, -1));
  }, [actionHistory, isHomeTeam, currentQuarter]);

  const handleResetMouseDown = useCallback(() => {
    setIsLongPress(false);
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setShowResetConfirm(true);
    }, 800);
  }, []);

  const handleResetMouseUp = useCallback(() => {
    clearTimeout(longPressTimer.current);
    if (!isLongPress) undoLastAction();
  }, [isLongPress, undoLastAction]);

  const handleResetMouseLeave = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const confirmReset = useCallback(() => {
    // Eliminar el partido actual del historial
    if (currentGameId) {
      removeGameFromList(currentGameId);
    }

    // Resetear todos los estados
    setPlayers(effectivePlayers.map(createInitialPlayerState));
    setGameTime(600);
    setCurrentQuarter(1);
    setGameRunning(false);
    setShowResetConfirm(false);
    setRotationHistory([]);
    setHomeTeam('Home');
    setAwayTeam('Away');
    setHomeScore(0);
    setAwayScore(0);
    setGameStarted(false);
    setIsHomeTeam(null);
    setActionHistory([]);
    setFouledOutPlayer(null);
    setShowFouledOutModal(false);
    setQuintetHistory([]);
    setCurrentQuintet(null);
    setSubstitutionsByQuarter({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setScoresByQuarter({ 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } });
    setLeadChanges(0);
    setTies(0);
    setBiggestLead({ us: 0, them: 0 });
    setPartialScores(INITIAL_PARTIAL_SCORES);

    // Volver
    setCurrentGameId(null);
    if (onExit) {
      onExit();
    } else {
      setCurrentScreen('home');
    }
  }, [currentGameId, effectivePlayers, onExit]);

  const addPoints = useCallback((playerId) => {
    const { ourScore, rivalScore } = getCurrentScores();
    updateGameFlow(ourScore + selectedPoints, rivalScore);

    setActionHistory(prev => [...prev, {
      type: 'score',
      playerId,
      points: selectedPoints,
      isOurTeam: true
    }]);
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? { ...p, points: p.points + selectedPoints } : p
    ));

    if (isHomeTeam) setHomeScore(prev => prev + selectedPoints);
    else setAwayScore(prev => prev + selectedPoints);

    setScoresByQuarter(prev => ({
      ...prev,
      [currentQuarter]: {
        ...prev[currentQuarter],
        us: prev[currentQuarter].us + selectedPoints
      }
    }));
    setShowScoreModal(false);
    setSelectedPoints(null);
  }, [getCurrentScores, updateGameFlow, selectedPoints, isHomeTeam, currentQuarter]);

  const addRivalPoints = useCallback(() => {
    const { ourScore, rivalScore } = getCurrentScores();
    updateGameFlow(ourScore, rivalScore + selectedPoints);

    setActionHistory(prev => [...prev, {
      type: 'score',
      playerId: null,
      points: selectedPoints,
      isOurTeam: false
    }]);

    if (isHomeTeam) setAwayScore(prev => prev + selectedPoints);
    else setHomeScore(prev => prev + selectedPoints);

    setScoresByQuarter(prev => ({
      ...prev,
      [currentQuarter]: {
        ...prev[currentQuarter],
        them: prev[currentQuarter].them + selectedPoints
      }
    }));
    setShowScoreModal(false);
    setSelectedPoints(null);
  }, [getCurrentScores, updateGameFlow, selectedPoints, isHomeTeam, currentQuarter]);

  const executeSub = useCallback((outId, inId) => {
    const outPlayer = players.find(p => p.id === outId);
    const inPlayer = players.find(p => p.id === inId);
    if (!outPlayer || !inPlayer) return;

    // Pausar cronómetro al hacer cambios
    setGameRunning(false);

    const now = Date.now();
    const { ourScore, rivalScore } = getCurrentScores();
    endCurrentQuintet(ourScore, rivalScore);

    setActionHistory(prev => [...prev, {
      type: 'swap',
      outId,
      inId,
      scoreAtAction: { ourScore, rivalScore }
    }]);
    setSubstitutionsByQuarter(prev => ({
      ...prev,
      [currentQuarter]: prev[currentQuarter] + 2
    }));

    setPlayers(prev => {
      const newPlayers = prev.map(p => {
        if (p.id === outId) {
          const stintPM = p.currentStintStart
            ? (ourScore - p.currentStintStart.ourScore) - (rivalScore - p.currentStintStart.rivalScore)
            : 0;
          return {
            ...p,
            onCourt: false,
            currentMinutes: 0,
            lastToggle: gameRunning ? now : null,
            stints: [...p.stints, p.currentMinutes],
            stintPlusMinus: [...p.stintPlusMinus, stintPM],
            currentStintStart: null
          };
        }
        if (p.id === inId) {
          return {
            ...p,
            onCourt: true,
            currentMinutes: 0,
            lastToggle: gameRunning ? now : null,
            currentStintStart: { ourScore, rivalScore }
          };
        }
        return p;
      });

      const newOnCourt = newPlayers.filter(p => p.onCourt);
      if (newOnCourt.length === 5) {
        startNewQuintet(newOnCourt.map(p => p.id), ourScore, rivalScore);
      }
      return newPlayers;
    });

    setRotationHistory(h => [...h,
      { time: `Q${currentQuarter}`, type: 'OUT', player: `#${outPlayer.number} ${outPlayer.name}` },
      { time: `Q${currentQuarter}`, type: 'IN', player: `#${inPlayer.number} ${inPlayer.name}` }
    ]);
  }, [players, getCurrentScores, endCurrentQuintet, startNewQuintet, currentQuarter, gameRunning]);

  const subInPlayer = useCallback((playerId) => {
    toggleCourt(playerId);
    setFouledOutPlayer(null);
    setShowFouledOutModal(false);
  }, [toggleCourt]);

  const startEditingPlayer = useCallback((player) => {
    setEditingPlayer(player.id);
    setEditForm({ name: player.name, number: player.number, position: player.position });
  }, []);

  const savePlayerEdit = useCallback(() => {
    setPlayers(prev => prev.map(p =>
      p.id === editingPlayer
        ? { ...p, name: editForm.name, number: editForm.number, position: editForm.position }
        : p
    ));
    setEditingPlayer(null);
  }, [editingPlayer, editForm]);

  const cancelPlayerEdit = useCallback(() => {
    setEditingPlayer(null);
    setEditingStats(null);
    setEditForm({ name: '', number: '', position: '' });
    setStatsForm({ totalCourtTime: 0, totalBenchTime: 0, fouls: 0, points: 0 });
  }, []);

  const startEditingStats = useCallback((player) => {
    // Pausar el cronómetro al editar stats
    setGameRunning(false);
    setEditingStats(player.id);
    setStatsForm({
      totalCourtTime: player.totalCourtTime,
      totalBenchTime: player.totalBenchTime,
      fouls: player.fouls,
      points: player.points
    });
  }, []);

  const saveStatsEdit = useCallback(() => {
    setPlayers(prev => prev.map(p =>
      p.id === editingStats
        ? {
            ...p,
            totalCourtTime: statsForm.totalCourtTime,
            totalBenchTime: statsForm.totalBenchTime,
            fouls: Math.min(5, Math.max(0, statsForm.fouls)),
            points: Math.max(0, statsForm.points)
          }
        : p
    ));
    setEditingStats(null);
    setStatsForm({ totalCourtTime: 0, totalBenchTime: 0, fouls: 0, points: 0 });
    // El cronómetro queda pausado - el usuario debe darle a play para continuar
  }, [editingStats, statsForm]);

  // ============================================
  // GENERAR REPORTE
  // ============================================
  const generateReport = useCallback(() => {
    const { ourScore, rivalScore } = getCurrentScores();
    if (currentQuintet && gameRunning) endCurrentQuintet(ourScore, rivalScore);

    const playersWithCurrentStint = players.map(p => {
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

    const quintetStats = {};
    quintetHistory.forEach(q => {
      if (!quintetStats[q.key]) {
        quintetStats[q.key] = { playerIds: q.playerIds, totalTime: 0, totalPointsScored: 0, totalPointsAllowed: 0, occurrences: 0 };
      }
      quintetStats[q.key].totalTime += q.duration;
      quintetStats[q.key].totalPointsScored += q.pointsScored;
      quintetStats[q.key].totalPointsAllowed += q.pointsAllowed;
      quintetStats[q.key].occurrences += 1;
    });

    const quintetArray = Object.values(quintetStats).map(q => ({
      ...q,
      differential: q.totalPointsScored - q.totalPointsAllowed,
      playerNames: q.playerIds.map(id => {
        const p = players.find(pl => pl.id === id);
        return p ? `#${p.number} ${p.name}` : 'Unknown';
      })
    }));

    const byTime = [...quintetArray].sort((a, b) => b.totalTime - a.totalTime);
    const byDifferential = [...quintetArray].sort((a, b) => b.differential - a.differential);

    const playerStintStats = playersWithCurrentStint.filter(p => p.position !== 'Unselected' && p.stints.length > 0).map(p => {
      const totalPM = p.stintPlusMinus.reduce((a, b) => a + b, 0);
      return {
        name: `#${p.number} ${p.name}`,
        position: p.position,
        stintCount: p.stints.length,
        stints: p.stints,
        avgStint: p.stints.reduce((a, b) => a + b, 0) / p.stints.length,
        totalTime: p.stints.reduce((a, b) => a + b, 0),
        totalPlusMinus: totalPM
      };
    });

    const totalSubs = Object.values(substitutionsByQuarter).reduce((a, b) => a + b, 0);
    const realSubs = Math.max(0, totalSubs - 5);

    const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report - ${ourTeamName} vs ${rivalTeamName}</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px;max-width:900px;margin:0 auto}
h1{color:#f97316;border-bottom:3px solid #f97316;padding-bottom:10px;font-size:24px}
h2{color:#3b82f6;margin-top:30px;border-bottom:2px solid #3b82f6;padding-bottom:5px;font-size:16px}
table{width:100%;border-collapse:collapse;margin:15px 0;font-size:11px}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background-color:#1f2937;color:white}
tr:nth-child(even){background-color:#f3f4f6}
.score-box{display:inline-block;padding:15px 25px;background:linear-gradient(135deg,#1f2937,#374151);color:white;border-radius:10px;margin:5px;font-size:28px;font-weight:bold}
.positive{color:#16a34a;font-weight:bold}
.negative{color:#dc2626;font-weight:bold}
.section{margin-bottom:30px}
.stat-box{display:inline-block;background:#f3f4f6;padding:15px 20px;border-radius:8px;margin:10px;text-align:center}
.stat-value{font-size:28px;font-weight:bold;color:#1f2937}
.stat-label{font-size:11px;color:#6b7280;text-transform:uppercase;margin-top:5px}
.stint-times{font-size:10px;color:#666}
@media print{.section{page-break-inside:avoid}}
</style></head><body>
<h1>🏀 Game Report</h1>
<div style="text-align:center;margin:20px 0">
<div class="score-box">${ourTeamName}<br/>${ourScore}</div>
<span style="font-size:24px;margin:0 15px;vertical-align:middle">VS</span>
<div class="score-box">${rivalTeamName}<br/>${rivalScore}</div>
</div>
<div style="text-align:center;margin:30px 0">
<div class="stat-box">
<div class="stat-value">${realSubs}</div>
<div class="stat-label">Cambios en el partido</div>
</div>
</div>
<div class="section">
<h2>👥 Quintetos - Tiempo compartido en pista</h2>
<table>
<tr><th>#</th><th>Jugadores</th><th>Tiempo juntos</th></tr>
${byTime.map((q,i)=>`<tr><td>${i+1}</td><td>${q.playerNames.join(', ')}</td><td><strong>${formatTime(q.totalTime)}</strong></td></tr>`).join('')}
</table>
</div>
<div class="section">
<h2>📊 Quintetos - +/- en pista</h2>
<table>
<tr><th>#</th><th>Jugadores</th><th>Tiempo</th><th>A favor</th><th>En contra</th><th>+/-</th></tr>
${byDifferential.map((q,i)=>`<tr><td>${i+1}</td><td>${q.playerNames.join(', ')}</td><td>${formatTime(q.totalTime)}</td><td>${q.totalPointsScored}</td><td>${q.totalPointsAllowed}</td><td class="${q.differential>=0?'positive':'negative'}" style="font-size:14px">${q.differential>=0?'+':''}${q.differential}</td></tr>`).join('')}
</table>
</div>
<div class="section">
<h2>⏱️ Stints por jugador</h2>
<table>
<tr><th>Jugador</th><th>Pos</th><th>Nº Stints</th><th>Duración de cada stint</th><th>Media</th><th>Total</th></tr>
${playerStintStats.sort((a,b)=>b.totalTime-a.totalTime).map(p=>`<tr><td><strong>${p.name}</strong></td><td>${p.position}</td><td style="text-align:center">${p.stintCount}</td><td class="stint-times">${p.stints.map(s => formatTime(s)).join(' → ')}</td><td><strong>${formatTime(p.avgStint)}</strong></td><td>${formatTime(p.totalTime)}</td></tr>`).join('')}
</table>
</div>
<div style="margin-top:40px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:15px">
<p>Basketball Rotation Tracker - ${new Date().toLocaleString()}</p>
</div>
</body></html>`;

    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `report-${ourTeamName}-vs-${rivalTeamName}-${new Date().toISOString().split('T')[0]}.html`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }, [getCurrentScores, currentQuintet, gameRunning, endCurrentQuintet, players, quintetHistory, substitutionsByQuarter, ourTeamName, rivalTeamName]);

  // ============================================
  // RENDER - PANTALLA DE CARGA
  // ============================================
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p>Cargando...</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - PANTALLA HOME (solo en modo legacy sin onExit)
  // ============================================
  if (currentScreen === 'home' && !onExit) {
    const gamesList = getGamesList();
    const inProgressGame = gamesList.find(g => g.status === 'in_progress');

    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-6 sm:p-8 border-2 border-orange-500 max-w-md w-full">
          <div className="flex items-center justify-center gap-2 mb-8">
            <PlayStatsIcon className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-black text-orange-400">PlayStats Basketball</h1>
          </div>

          {inProgressGame && (
            <button
              onClick={() => loadGame(inProgressGame.id)}
              className="w-full mb-4 bg-yellow-700 hover:bg-yellow-600 active:bg-yellow-500 rounded-xl p-4 border-2 border-yellow-400 text-left"
            >
              <div className="text-lg font-black flex items-center gap-2">
                <Play className="w-5 h-5" /> CONTINUAR PARTIDO
              </div>
              <div className="text-sm text-yellow-200 mt-1">
                {inProgressGame.homeTeam} {inProgressGame.homeScore} - {inProgressGame.awayScore} {inProgressGame.awayTeam}
                <span className="ml-2 opacity-75">• Q{inProgressGame.currentQuarter}</span>
              </div>
            </button>
          )}

          <button
            onClick={() => setCurrentScreen('team-selection')}
            className="w-full mb-4 bg-green-700 hover:bg-green-600 active:bg-green-500 rounded-xl p-6 border-2 border-green-400"
          >
            <div className="text-3xl mb-2">🏀</div>
            <div className="text-xl font-black">NUEVO PARTIDO</div>
            <div className="text-sm text-green-300">Empezar a trackear</div>
          </button>

          <button
            onClick={() => setCurrentScreen('history')}
            className="w-full bg-blue-700 hover:bg-blue-600 active:bg-blue-500 rounded-xl p-6 border-2 border-blue-400"
          >
            <div className="text-3xl mb-2">📋</div>
            <div className="text-xl font-black">VER PARTIDOS ({gamesList.length})</div>
            <div className="text-sm text-blue-300">Historial guardado</div>
          </button>
        </div>
      </div>
    );
  }

  // Si estamos en home pero tenemos onExit, volver al TeamDetail
  if (currentScreen === 'home' && onExit) {
    onExit();
    return null;
  }

  // ============================================
  // RENDER - PANTALLA SELECCIÓN DE EQUIPO
  // ============================================
  if (currentScreen === 'team-selection') {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center p-4">
        <div className="bg-gray-800 rounded-2xl p-6 sm:p-8 border-2 border-orange-500 max-w-md w-full">
          <button
            onClick={() => onExit ? onExit() : setCurrentScreen('home')}
            className="mb-4 text-gray-400 hover:text-white flex items-center gap-2"
          >
            ← Volver
          </button>
          <div className="flex items-center justify-center gap-2 mb-6">
            <PlayStatsIcon className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-black text-orange-400">Nuevo Partido</h1>
          </div>
          <h2 className="text-lg font-bold text-center mb-6 text-gray-300">Your team plays as...</h2>
          <div className="grid grid-cols-2 gap-4">
            <button onClick={() => createNewGame(true)} className="bg-blue-700 hover:bg-blue-600 active:bg-blue-500 rounded-xl p-4 sm:p-6 font-black text-center border-2 border-blue-400">
              <div className="text-3xl sm:text-4xl mb-2">🏠</div>
              <div className="text-lg sm:text-xl">HOME</div>
            </button>
            <button onClick={() => createNewGame(false)} className="bg-red-700 hover:bg-red-600 active:bg-red-500 rounded-xl p-4 sm:p-6 font-black text-center border-2 border-red-400">
              <div className="text-3xl sm:text-4xl mb-2">✈️</div>
              <div className="text-lg sm:text-xl">AWAY</div>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - PANTALLA HISTORIAL (solo en modo legacy sin onExit)
  // ============================================
  if (currentScreen === 'history' && !onExit) {
    const gamesList = getGamesList().sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    return (
      <div className="min-h-screen bg-gray-900 text-white p-4">
        <div className="max-w-md mx-auto">
          <div className="flex items-center gap-4 mb-6">
            <button
              onClick={() => setCurrentScreen('home')}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              ←
            </button>
            <h1 className="text-xl font-black text-orange-400">📋 Historial de Partidos</h1>
          </div>

          {gamesList.length === 0 ? (
            <div className="text-center text-gray-500 py-8">
              <div className="text-4xl mb-4">🏀</div>
              <p>No hay partidos guardados</p>
              <button
                onClick={() => setCurrentScreen('team-selection')}
                className="mt-4 bg-green-700 hover:bg-green-600 px-4 py-2 rounded-lg font-bold"
              >
                Crear primer partido
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {gamesList.map(game => {
                const isInProgress = game.status === 'in_progress';
                const ourScore = game.isHomeTeam ? game.homeScore : game.awayScore;
                const theirScore = game.isHomeTeam ? game.awayScore : game.homeScore;
                const didWin = ourScore > theirScore;
                const didLose = ourScore < theirScore;

                return (
                  <div
                    key={game.id}
                    className={`bg-gray-800 rounded-xl p-4 border-2 ${isInProgress ? 'border-yellow-500' : 'border-gray-600'} relative`}
                  >
                    <div className="flex justify-between items-start mb-2">
                      <div className="text-xs text-gray-400">
                        📅 {new Date(game.updatedAt).toLocaleDateString('es-ES', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                      <div className={`text-xs px-2 py-0.5 rounded font-bold ${isInProgress ? 'bg-yellow-600' : 'bg-green-600'}`}>
                        {isInProgress ? '⏸️ En progreso' : '✅ Finalizado'}
                      </div>
                    </div>

                    <div className="text-lg font-bold mb-2">
                      <span className={game.isHomeTeam ? (didWin ? 'text-green-400' : didLose ? 'text-red-400' : 'text-white') : 'text-white'}>
                        {game.homeTeam} {game.homeScore}
                      </span>
                      <span className="text-gray-500"> - </span>
                      <span className={!game.isHomeTeam ? (didWin ? 'text-green-400' : didLose ? 'text-red-400' : 'text-white') : 'text-white'}>
                        {game.awayScore} {game.awayTeam}
                      </span>
                    </div>

                    <div className="text-xs text-gray-500 mb-3">
                      Q{game.currentQuarter} {isInProgress ? '- En progreso' : '- Completado'}
                      {game.isHomeTeam ? ' • Home' : ' • Away'}
                    </div>

                    <div className="flex gap-2">
                      <button
                        onClick={() => loadGame(game.id)}
                        className="flex-1 bg-blue-600 hover:bg-blue-500 active:bg-blue-400 py-2 rounded-lg font-bold text-sm"
                      >
                        {isInProgress ? '▶️ Continuar' : '👁️ Ver'}
                      </button>
                      <button
                        onClick={() => {
                          const data = loadGameData(game.id);
                          if (data) {
                            // Cargar temporalmente para generar reporte
                            loadGame(game.id);
                            setTimeout(() => generateReport(), 100);
                          }
                        }}
                        className="bg-purple-600 hover:bg-purple-500 active:bg-purple-400 px-3 py-2 rounded-lg font-bold text-sm"
                        title="Descargar reporte"
                      >
                        📥
                      </button>
                      <button
                        onClick={() => {
                          if (confirm('¿Eliminar este partido?')) {
                            deleteGame(game.id);
                            setCurrentScreen('history'); // Forzar re-render
                          }
                        }}
                        className="bg-red-600 hover:bg-red-500 active:bg-red-400 px-3 py-2 rounded-lg font-bold text-sm"
                        title="Eliminar"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - PANTALLA PRINCIPAL DEL PARTIDO
  // ============================================
  return (
    <>
    {/* Modal de salida */}
    {showExitModal && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
        <div className="bg-gray-800 rounded-xl p-6 border-2 border-orange-500 max-w-sm w-full">
          <h3 className="text-xl font-black text-center mb-4 text-orange-400">¿Qué quieres hacer?</h3>
          <div className="space-y-3">
            <button
              onClick={saveAndExit}
              className="w-full bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 py-3 rounded-lg font-bold"
            >
              💾 GUARDAR Y SALIR
              <div className="text-xs font-normal opacity-75">Podrás continuar después</div>
            </button>
            <button
              onClick={finishGame}
              className="w-full bg-green-600 hover:bg-green-500 active:bg-green-400 py-3 rounded-lg font-bold"
            >
              ✅ FINALIZAR PARTIDO
              <div className="text-xs font-normal opacity-75">Se guarda en el historial</div>
            </button>
            <button
              onClick={() => setShowExitModal(false)}
              className="w-full bg-gray-600 hover:bg-gray-500 active:bg-gray-400 py-3 rounded-lg font-bold"
            >
              ❌ CANCELAR
            </button>
          </div>
        </div>
      </div>
    )}
    <div className="min-h-screen bg-gray-900 text-white p-2 sm:p-4">
      <div className="max-w-7xl mx-auto space-y-2 sm:space-y-3">

        {/* FOUL WARNINGS */}
        <div className="bg-gray-800 rounded-lg p-2 sm:p-3 border border-gray-700">
          <h3 className="font-black text-sm mb-2 text-yellow-400 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />FALTAS - Q{currentQuarter}
          </h3>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-yellow-900/30 border border-yellow-600 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <AlertTriangle className="w-3 h-3 text-yellow-400" />
                <span className="font-bold text-yellow-400 text-xs">WARNING</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {warningPlayers.map(p => (
                  <span key={p.id} className="text-xs font-semibold text-white bg-yellow-800/60 px-2 py-0.5 rounded">
                    #{p.number} {p.name}
                  </span>
                ))}
                {warningPlayers.length === 0 && <span className="text-xs text-gray-500">-</span>}
              </div>
            </div>
            <div className="bg-red-900/30 border border-red-600 rounded-lg p-2">
              <div className="flex items-center gap-1 mb-1">
                <XCircle className="w-3 h-3 text-red-400" />
                <span className="font-bold text-red-400 text-xs">DANGER</span>
              </div>
              <div className="flex flex-wrap gap-1">
                {dangerPlayers.map(p => (
                  <span key={p.id} className="text-xs font-semibold text-white bg-red-800/60 px-2 py-0.5 rounded">
                    #{p.number} {p.name}
                  </span>
                ))}
                {dangerPlayers.length === 0 && <span className="text-xs text-gray-500">-</span>}
              </div>
            </div>
          </div>
        </div>

        {/* SUB RECOMMENDATIONS */}
        <div className="bg-gray-800 rounded-lg p-2 sm:p-3 border border-cyan-700">
          <h3 className="font-black text-sm mb-2 text-cyan-400 flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />RECOMENDACIONES DE CAMBIO
          </h3>
          {subRecommendations.length > 0 ? (
            <div className="space-y-3">
              {subRecommendations.map((rec, idx) => (
                <div key={idx} className={`${rec.isFoulIssue ? 'bg-orange-900/30 border-orange-600' : 'bg-cyan-900/30 border-cyan-600'} border rounded-xl p-3`}>
                  <div className="flex flex-wrap items-center gap-2 mb-3">
                    <span className="text-sm font-black text-white bg-gray-700 px-3 py-1 rounded">
                      #{rec.out.number} {rec.out.name}
                    </span>
                    <span className={`text-xs font-bold px-2 py-1 rounded ${rec.isFoulIssue ? 'bg-orange-600 text-white' : 'bg-cyan-600 text-white'}`}>
                      {rec.reason}
                    </span>
                    <span className="text-red-400 font-black text-sm">→ SACAR</span>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-green-400 font-black text-xs">METER:</span>
                    {rec.suggestions.map(s => {
                      const benchStatus = getBenchTimeStatus(s);
                      const statusColor = benchStatus === 'green'
                        ? 'bg-green-600 border-green-400 hover:bg-green-500'
                        : benchStatus === 'yellow'
                        ? 'bg-yellow-600 border-yellow-400 hover:bg-yellow-500'
                        : 'bg-red-600 border-red-400 hover:bg-red-500';
                      const isOutOfPosition = s.isPlayingOutOfPosition;
                      return (
                        <button
                          key={s.id}
                          onClick={() => executeSub(rec.out.id, s.id)}
                          className={`text-xs font-bold text-white ${isOutOfPosition ? 'bg-purple-600 border-purple-400 hover:bg-purple-500' : statusColor} border-2 px-3 py-1.5 rounded cursor-pointer transition-colors active:opacity-80`}
                        >
                          #{s.number} {s.name} (💺{formatTime(s.currentMinutes)} | {s.fouls}F)
                          {isOutOfPosition && <span className="ml-1 text-yellow-300">⚠️ Joker→Alero</span>}
                        </button>
                      );
                    })}
                    {rec.suggestions.length === 0 && (
                      <span className="text-xs text-gray-400">No hay jugadores disponibles en esta posición sin problemas de faltas</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-gray-500 text-sm">✓ No hay recomendaciones de cambio en este momento</div>
          )}
        </div>

        {/* SCOREBOARD & CONTROLS */}
        <div className="bg-gray-800 rounded-lg p-2 sm:p-3 border border-gray-700">
          {/* Score */}
          <div className="grid grid-cols-3 gap-2 mb-2">
            <div className={`${isHomeTeam ? 'bg-blue-800 border-blue-400' : 'bg-blue-900/50 border-blue-600'} border-2 rounded-lg p-2 text-center`}>
              {editingTeam === 'home' ? (
                <input type="text" defaultValue={homeTeam} onBlur={(e) => { setHomeTeam(e.target.value || 'Home'); setEditingTeam(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setHomeTeam(e.target.value || 'Home'); setEditingTeam(null); }}} className="bg-gray-900 px-2 py-1.5 rounded text-center font-bold text-white w-full text-sm" autoFocus />
              ) : (
                <div className="text-xs sm:text-sm text-blue-300 truncate cursor-pointer py-1" onClick={() => setEditingTeam('home')}>{homeTeam}</div>
              )}
              {editingScore === 'home' ? (
                <input type="number" min="0" defaultValue={homeScore} onBlur={(e) => { setHomeScore(parseInt(e.target.value) || 0); setEditingScore(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setHomeScore(parseInt(e.target.value) || 0); setEditingScore(null); }}} className="bg-gray-900 px-2 py-2 rounded text-center font-black text-white w-full text-2xl" autoFocus />
              ) : (
                <div className="text-2xl sm:text-3xl font-black cursor-pointer" onClick={() => setEditingScore('home')}>{homeScore}</div>
              )}
            </div>
            <div className="flex flex-col items-center justify-center">
              <div onClick={() => setShowQuarterSelector(!showQuarterSelector)} className="text-sm font-bold text-orange-400 cursor-pointer">Q{currentQuarter}</div>
              {editingGameTime ? (
                <div className="flex flex-col items-center gap-2">
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="10"
                      value={editGameTimeForm.minutes}
                      onChange={(e) => setEditGameTimeForm({...editGameTimeForm, minutes: parseInt(e.target.value) || 0})}
                      className="w-12 sm:w-14 bg-gray-900 px-2 py-2 rounded text-center font-black text-white text-lg"
                      autoFocus
                    />
                    <span className="font-black text-xl">:</span>
                    <input
                      type="number"
                      min="0"
                      max="59"
                      value={editGameTimeForm.seconds}
                      onChange={(e) => setEditGameTimeForm({...editGameTimeForm, seconds: Math.min(59, parseInt(e.target.value) || 0)})}
                      className="w-12 sm:w-14 bg-gray-900 px-2 py-2 rounded text-center font-black text-white text-lg"
                    />
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        const newTime = (editGameTimeForm.minutes * 60) + editGameTimeForm.seconds;
                        setGameTime(Math.max(0, Math.min(600, newTime)));
                        setEditingGameTime(false);
                      }}
                      className="bg-green-600 px-4 py-2 rounded text-sm font-bold active:bg-green-500"
                    >
                      ✓
                    </button>
                    <button
                      onClick={() => setEditingGameTime(false)}
                      className="bg-red-600 px-4 py-2 rounded text-sm font-bold active:bg-red-500"
                    >
                      ✗
                    </button>
                  </div>
                </div>
              ) : (
                <div
                  className="text-xl sm:text-2xl font-black cursor-pointer"
                  onClick={() => {
                    setGameRunning(false);
                    setEditGameTimeForm({
                      minutes: Math.floor(gameTime / 60),
                      seconds: gameTime % 60
                    });
                    setEditingGameTime(true);
                  }}
                >
                  {formatGameTime(gameTime)}
                </div>
              )}
              {showQuarterSelector && (
                <div className="absolute mt-16 bg-gray-800 rounded-lg shadow-xl z-20 p-1 flex gap-1">
                  {[1,2,3,4].map(q => (
                    <button key={q} onClick={() => {setCurrentQuarter(q); setShowQuarterSelector(false);}} className={`px-3 py-1 rounded text-sm font-bold ${currentQuarter === q ? 'bg-orange-600' : 'bg-gray-700'}`}>
                      {q}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <div className={`${!isHomeTeam ? 'bg-red-800 border-red-400' : 'bg-red-900/50 border-red-600'} border-2 rounded-lg p-2 text-center`}>
              {editingTeam === 'away' ? (
                <input type="text" defaultValue={awayTeam} onBlur={(e) => { setAwayTeam(e.target.value || 'Away'); setEditingTeam(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setAwayTeam(e.target.value || 'Away'); setEditingTeam(null); }}} className="bg-gray-900 px-2 py-1.5 rounded text-center font-bold text-white w-full text-sm" autoFocus />
              ) : (
                <div className="text-xs sm:text-sm text-red-300 truncate cursor-pointer py-1" onClick={() => setEditingTeam('away')}>{awayTeam}</div>
              )}
              {editingScore === 'away' ? (
                <input type="number" min="0" defaultValue={awayScore} onBlur={(e) => { setAwayScore(parseInt(e.target.value) || 0); setEditingScore(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setAwayScore(parseInt(e.target.value) || 0); setEditingScore(null); }}} className="bg-gray-900 px-2 py-2 rounded text-center font-black text-white w-full text-2xl" autoFocus />
              ) : (
                <div className="text-2xl sm:text-3xl font-black cursor-pointer" onClick={() => setEditingScore('away')}>{awayScore}</div>
              )}
            </div>
          </div>

          {/* Partial Scores */}
          {(() => {
            const partials = getCurrentPartialScores();
            const getPartialColor = (us, them) => {
              if (us === 0 && them === 0) return 'bg-gray-700 text-gray-400';
              if (us > them) return 'bg-green-700 text-green-100';
              if (us < them) return 'bg-red-700 text-red-100';
              return 'bg-orange-600 text-orange-100';
            };
            const currentHalf = gameTime > 300 ? 'first' : 'second';
            return (
              <div className="grid grid-cols-4 gap-1 mb-2">
                {[1, 2, 3, 4].map(q => {
                  const qPartials = partials[q];
                  const firstColor = getPartialColor(qPartials.first.us, qPartials.first.them);
                  const secondColor = getPartialColor(qPartials.second.us, qPartials.second.them);
                  const isCurrentQ = q === currentQuarter;
                  const isFirstHalfCurrent = isCurrentQ && currentHalf === 'first';
                  const isSecondHalfCurrent = isCurrentQ && currentHalf === 'second';
                  return (
                    <div key={q} className="rounded p-1">
                      <div className="text-xs text-center text-gray-400 font-bold mb-0.5">Q{q}</div>
                      <div className="flex gap-0.5">
                        <div className={`flex-1 ${firstColor} rounded px-1 py-0.5 text-center ${isFirstHalfCurrent ? 'ring-2 ring-orange-400' : ''}`}>
                          <span className="text-xs font-bold">{qPartials.first.us}-{qPartials.first.them}</span>
                        </div>
                        <div className={`flex-1 ${secondColor} rounded px-1 py-0.5 text-center ${isSecondHalfCurrent ? 'ring-2 ring-orange-400' : ''}`}>
                          <span className="text-xs font-bold">{qPartials.second.us}-{qPartials.second.them}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Control buttons */}
          <div className="flex flex-wrap gap-1.5 mb-2">
            <button onClick={toggleGameRunning} className={`flex-1 min-w-[60px] px-2 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1 ${gameRunning ? 'bg-orange-600' : 'bg-green-600'}`}>
              {gameRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              <span className="hidden sm:inline">{gameRunning ? 'PAUSE' : 'PLAY'}</span>
            </button>
            <button
              onMouseDown={handleResetMouseDown}
              onMouseUp={handleResetMouseUp}
              onMouseLeave={handleResetMouseLeave}
              onTouchStart={handleResetMouseDown}
              onTouchEnd={handleResetMouseUp}
              className={`px-2 py-2 rounded-lg font-bold text-sm flex items-center justify-center ${actionHistory.length > 0 ? 'bg-red-600' : 'bg-gray-600'}`}
            >
              <Undo2 className="w-4 h-4" />
            </button>
            <button onClick={() => setShowIntervalsModal(true)} className="px-2 py-2 bg-gray-600 rounded-lg">
              <Settings className="w-4 h-4" />
            </button>
            <button onClick={generateReport} className="px-2 py-2 bg-blue-600 rounded-lg">
              <Download className="w-4 h-4" />
            </button>
            <button onClick={() => setShowExitModal(true)} className="px-2 py-2 bg-orange-600 rounded-lg" title="Salir del partido">
              <XCircle className="w-4 h-4" />
            </button>
            <div className="flex items-center bg-gray-700 rounded-lg px-2 py-1">
              <Users className="w-4 h-4 text-blue-400" />
              <span className={`text-sm font-bold ml-1 ${onCourtCount === 5 ? 'text-green-400' : 'text-red-400'}`}>{onCourtCount}/5</span>
            </div>
          </div>

          {/* Scoring buttons */}
          <div className="grid grid-cols-4 gap-1.5">
            <button onClick={() => { setSelectedPoints(3); setShowScoreModal(true); }} className="py-2.5 bg-purple-600 active:bg-purple-500 rounded-lg font-black text-sm">+3</button>
            <button onClick={() => { setSelectedPoints(2); setShowScoreModal(true); }} className="py-2.5 bg-blue-600 active:bg-blue-500 rounded-lg font-black text-sm">+2</button>
            <button onClick={() => { setSelectedPoints(1); setShowScoreModal(true); }} className="py-2.5 bg-green-600 active:bg-green-500 rounded-lg font-black text-sm">+1</button>
            <button onClick={() => setShowFoulModal(true)} className="py-2.5 bg-yellow-600 active:bg-yellow-500 rounded-lg font-black text-sm flex items-center justify-center">
              <Bell className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* PLAYERS GRID */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2 sm:gap-3">
          {/* ON COURT */}
          <div className="bg-blue-900/30 rounded-lg p-2 border border-blue-700">
            <div className="flex items-center gap-2 mb-2">
              <span className="bg-blue-600 px-2 py-0.5 rounded text-xs font-bold">EN PISTA</span>
              <span className="text-xs font-bold">{onCourtCount}/5</span>
            </div>
            <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
              {onCourtPlayers.length === 0 ? (
                <div className="col-span-3 sm:col-span-5 text-center py-4 text-gray-500 text-sm">Selecciona 5 jugadores</div>
              ) : (
                onCourtPlayers.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isRosterView={false}
                    currentQuarter={currentQuarter}
                    editingPlayer={editingPlayer}
                    editingStats={editingStats}
                    editForm={editForm}
                    statsForm={statsForm}
                    onEditFormChange={setEditForm}
                    onStatsFormChange={setStatsForm}
                    onStartEditing={startEditingPlayer}
                    onStartEditingStats={startEditingStats}
                    onSaveEdit={savePlayerEdit}
                    onSaveStats={saveStatsEdit}
                    onCancelEdit={cancelPlayerEdit}
                    onToggleCourt={toggleCourt}
                    getCourtTimeStatus={getCourtTimeStatus}
                    getBenchTimeStatus={getBenchTimeStatus}
                  />
                ))
              )}
            </div>
          </div>

          {/* BENCH */}
          <div className="bg-gray-800/50 rounded-lg p-2 border border-gray-700">
            <div className="mb-2">
              <span className="bg-gray-600 px-2 py-0.5 rounded text-xs font-bold">BANQUILLO</span>
            </div>

            {/* Bases */}
            <div className="mb-2">
              <div className="text-xs font-bold text-blue-400 mb-1">BASES</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {bases.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isRosterView={true}
                    currentQuarter={currentQuarter}
                    editingPlayer={editingPlayer}
                    editingStats={editingStats}
                    editForm={editForm}
                    statsForm={statsForm}
                    onEditFormChange={setEditForm}
                    onStatsFormChange={setStatsForm}
                    onStartEditing={startEditingPlayer}
                    onStartEditingStats={startEditingStats}
                    onSaveEdit={savePlayerEdit}
                    onSaveStats={saveStatsEdit}
                    onCancelEdit={cancelPlayerEdit}
                    onToggleCourt={toggleCourt}
                    getCourtTimeStatus={getCourtTimeStatus}
                    getBenchTimeStatus={getBenchTimeStatus}
                  />
                ))}
              </div>
            </div>

            {/* Aleros */}
            <div className="mb-2">
              <div className="text-xs font-bold text-green-400 mb-1">ALEROS</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {aleros.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isRosterView={true}
                    currentQuarter={currentQuarter}
                    editingPlayer={editingPlayer}
                    editingStats={editingStats}
                    editForm={editForm}
                    statsForm={statsForm}
                    onEditFormChange={setEditForm}
                    onStatsFormChange={setStatsForm}
                    onStartEditing={startEditingPlayer}
                    onStartEditingStats={startEditingStats}
                    onSaveEdit={savePlayerEdit}
                    onSaveStats={saveStatsEdit}
                    onCancelEdit={cancelPlayerEdit}
                    onToggleCourt={toggleCourt}
                    getCourtTimeStatus={getCourtTimeStatus}
                    getBenchTimeStatus={getBenchTimeStatus}
                  />
                ))}
              </div>
            </div>

            {/* Jokers */}
            <div className="mb-2">
              <div className="text-xs font-bold text-purple-400 mb-1">JOKER</div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                {jokers.map(p => (
                  <PlayerCard
                    key={p.id}
                    player={p}
                    isRosterView={true}
                    currentQuarter={currentQuarter}
                    editingPlayer={editingPlayer}
                    editingStats={editingStats}
                    editForm={editForm}
                    statsForm={statsForm}
                    onEditFormChange={setEditForm}
                    onStatsFormChange={setStatsForm}
                    onStartEditing={startEditingPlayer}
                    onStartEditingStats={startEditingStats}
                    onSaveEdit={savePlayerEdit}
                    onSaveStats={saveStatsEdit}
                    onCancelEdit={cancelPlayerEdit}
                    onToggleCourt={toggleCourt}
                    getCourtTimeStatus={getCourtTimeStatus}
                    getBenchTimeStatus={getBenchTimeStatus}
                  />
                ))}
              </div>
            </div>

            {/* Unselected */}
            {unselected.length > 0 && (
              <div>
                <div className="text-xs font-bold text-gray-400 mb-1">NO CONV.</div>
                <div className="grid grid-cols-3 sm:grid-cols-5 gap-1.5">
                  {unselected.map(p => (
                    <PlayerCard
                      key={p.id}
                      player={p}
                      isRosterView={true}
                      currentQuarter={currentQuarter}
                      editingPlayer={editingPlayer}
                      editingStats={editingStats}
                      editForm={editForm}
                      statsForm={statsForm}
                      onEditFormChange={setEditForm}
                      onStatsFormChange={setStatsForm}
                      onStartEditing={startEditingPlayer}
                      onStartEditingStats={startEditingStats}
                      onSaveEdit={savePlayerEdit}
                      onSaveStats={saveStatsEdit}
                      onCancelEdit={cancelPlayerEdit}
                      onToggleCourt={toggleCourt}
                      getCourtTimeStatus={getCourtTimeStatus}
                      getBenchTimeStatus={getBenchTimeStatus}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* MODALS */}
        {showFouledOutModal && fouledOutPlayer && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 border-2 border-red-500 max-w-sm w-full">
              <div className="text-center mb-3">
                <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
                <h3 className="text-xl font-black text-red-400">FOULED OUT</h3>
                <p className="font-bold">#{fouledOutPlayer.number} {fouledOutPlayer.name}</p>
              </div>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {fouledOutReplacements.map(s => (
                  <button key={s.id} onClick={() => subInPlayer(s.id)} className="bg-green-600 active:bg-green-500 rounded-lg p-3 font-bold text-left">
                    <div>#{s.number} {s.name}</div>
                    <div className="text-xs opacity-80">{formatTime(s.currentMinutes)}</div>
                  </button>
                ))}
              </div>
              <button onClick={() => { setShowFouledOutModal(false); setFouledOutPlayer(null); }} className="w-full py-2 bg-gray-600 rounded-lg font-bold">CERRAR</button>
            </div>
          </div>
        )}

        {showFoulModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 border-2 border-yellow-500 max-w-sm w-full">
              <h3 className="text-lg font-black mb-3 text-yellow-400 text-center">¿Quién hizo falta?</h3>
              <div className="grid grid-cols-2 gap-2 mb-3">
                {onCourtPlayers.map(player => (
                  <button key={player.id} onClick={() => addFoulToPlayer(player.id)} className="bg-yellow-700 active:bg-yellow-600 rounded-lg p-3 font-bold text-left">
                    <div className="flex justify-between items-center">
                      <span>#{player.number} {player.name}</span>
                      <span className={`${getFoulBgClass(player.fouls, currentQuarter)} px-2 py-0.5 rounded text-sm`}>{player.fouls}</span>
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setShowFoulModal(false)} className="w-full py-2 bg-gray-600 rounded-lg font-bold">CANCELAR</button>
            </div>
          </div>
        )}

        {showScoreModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500 max-w-sm w-full">
              <h3 className="text-lg font-black mb-3 text-orange-400 text-center">¿Quién anotó {selectedPoints}?</h3>
              <div className="mb-3">
                <div className="text-xs font-bold text-blue-400 mb-1">{ourTeamName}</div>
                <div className="grid grid-cols-2 gap-2">
                  {onCourtPlayers.map(player => (
                    <button key={player.id} onClick={() => addPoints(player.id)} className="bg-blue-700 active:bg-blue-600 rounded-lg p-2 font-bold text-sm">
                      #{player.number} {player.name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={addRivalPoints} className="w-full py-2 bg-red-700 active:bg-red-600 rounded-lg font-bold mb-2">
                +{selectedPoints} {rivalTeamName}
              </button>
              <button onClick={() => { setShowScoreModal(false); setSelectedPoints(null); }} className="w-full py-2 bg-gray-600 rounded-lg font-bold">CANCELAR</button>
            </div>
          </div>
        )}

        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 border-2 border-red-500 max-w-xs w-full">
              <h3 className="text-lg font-black mb-2 text-red-400 text-center">⚠️ RESET</h3>
              <p className="text-center text-gray-300 mb-4">¿Resetear todo?</p>
              <div className="flex gap-2">
                <button onClick={confirmReset} className="flex-1 py-2 bg-red-600 rounded-lg font-bold">SÍ</button>
                <button onClick={() => setShowResetConfirm(false)} className="flex-1 py-2 bg-gray-600 rounded-lg font-bold">NO</button>
              </div>
            </div>
          </div>
        )}

        {showIntervalsModal && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-4 border-2 border-gray-500 max-w-xs w-full">
              <h3 className="text-lg font-black mb-3 text-center">Configurar Stints</h3>
              <div className="space-y-3 mb-4">
                <div>
                  <div className="text-xs font-bold text-blue-400 mb-1">🏀 EN PISTA</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-green-400">Verde→Amarillo</label>
                      <div className="flex gap-1">
                        <input type="number" min="0" max="10" value={intervals.green.minutes} onChange={(e) => setIntervals({...intervals, green: {...intervals.green, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                        <input type="number" min="0" max="59" value={intervals.green.seconds} onChange={(e) => setIntervals({...intervals, green: {...intervals.green, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                      </div>
                    </div>
                    <div>
                      <label className="text-yellow-400">Amarillo→Rojo</label>
                      <div className="flex gap-1">
                        <input type="number" min="0" max="10" value={intervals.yellow.minutes} onChange={(e) => setIntervals({...intervals, yellow: {...intervals.yellow, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                        <input type="number" min="0" max="59" value={intervals.yellow.seconds} onChange={(e) => setIntervals({...intervals, yellow: {...intervals.yellow, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <div className="text-xs font-bold text-gray-400 mb-1">💺 BANQUILLO</div>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <label className="text-red-400">Rojo→Amarillo</label>
                      <div className="flex gap-1">
                        <input type="number" min="0" max="10" value={benchIntervals.red.minutes} onChange={(e) => setBenchIntervals({...benchIntervals, red: {...benchIntervals.red, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                        <input type="number" min="0" max="59" value={benchIntervals.red.seconds} onChange={(e) => setBenchIntervals({...benchIntervals, red: {...benchIntervals.red, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                      </div>
                    </div>
                    <div>
                      <label className="text-yellow-400">Amarillo→Verde</label>
                      <div className="flex gap-1">
                        <input type="number" min="0" max="10" value={benchIntervals.yellow.minutes} onChange={(e) => setBenchIntervals({...benchIntervals, yellow: {...benchIntervals.yellow, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                        <input type="number" min="0" max="59" value={benchIntervals.yellow.seconds} onChange={(e) => setBenchIntervals({...benchIntervals, yellow: {...benchIntervals.yellow, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-gray-700 px-2 py-1 rounded" />
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              <button onClick={() => setShowIntervalsModal(false)} className="w-full py-2 bg-gray-600 rounded-lg font-bold">CERRAR</button>
            </div>
          </div>
        )}
      </div>
    </div>
    </>
  );
}
