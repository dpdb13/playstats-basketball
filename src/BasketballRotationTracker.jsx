import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Users, Play, Pause, AlertTriangle, XCircle, Settings, Download, Undo2, RefreshCw, Bell, ChevronDown, ChevronUp, Eye, EyeOff } from 'lucide-react';
import PlayStatsIcon from './components/PlayStatsIcon';
import { addToQueue } from './lib/syncManager';
import { formatTime, formatGameTime, getFoulStatus, getFoulBgClass, getQuintetKey, createInitialPlayerState, createInitialPartialScores, TEAM_COLORS, getTeamColor } from './lib/gameUtils';
import { generateReport as generateReportHTML } from './lib/generateReport';
import PlayerCard from './components/PlayerCard';
import { useTranslation } from './context/LanguageContext';

// ============================================
// CONSTANTES
// ============================================
const AUTOSAVE_INTERVAL = 5000; // Guardar cada 5 segundos

// Generar ID único para cada partido (formato UUID para compatibilidad con Supabase)
const generateGameId = () => crypto.randomUUID();


// ============================================
// COMPONENTE PRINCIPAL
// ============================================
export default function BasketballRotationTracker({ initialPlayers, onExit, onGameSaved, savedGameData, teamId, userId, showExitConfirm, onDismissExitConfirm, teamName }) {
  // Jugadores: usar initialPlayers prop
  const effectivePlayers = initialPlayers || [];

  // Estado para saber si ya cargamos datos guardados
  const [isInitialized, setIsInitialized] = useState(false);

  // Estados de navegación
  // Si nos pasan savedGameData, ir directo al partido; si no, a seleccion de equipo
  const [currentScreen, setCurrentScreen] = useState(() => savedGameData ? 'game' : 'team-selection');
  const [currentGameId, setCurrentGameId] = useState(() => savedGameData?.id || null);
  // Modal activo (null = ninguno, 'exit', 'reset', 'quarter', 'intervals', 'score', 'foul', 'fouledOut')
  const [activeModal, setActiveModal] = useState(null);

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
  const [showQuarterSelector, setShowQuarterSelector] = useState(false);
  const [selectedPoints, setSelectedPoints] = useState(null);
  const [selectedScorePlayer, setSelectedScorePlayer] = useState(null); // {id, isRival} for 2-step scoring
  const [editingTeam, setEditingTeam] = useState(null);
  const [editingScore, setEditingScore] = useState(null);
  const [editingGameTime, setEditingGameTime] = useState(false);
  const [editGameTimeForm, setEditGameTimeForm] = useState({ minutes: 0, seconds: 0 });
  const [editingPlayer, setEditingPlayer] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', number: '', position: '' });
  const [isLongPress, setIsLongPress] = useState(false);
  const [fouledOutPlayer, setFouledOutPlayer] = useState(null);
  const [courtWarning, setCourtWarning] = useState(null);
  const [pendingReplacement, setPendingReplacement] = useState(null); // {outPlayer} when 5→4 substitution

  // Configuración
  const [intervals, setIntervals] = useState(() => savedGameData?.intervals || { green: { minutes: 3, seconds: 0 }, yellow: { minutes: 4, seconds: 30 } });
  const [benchIntervals, setBenchIntervals] = useState(() => savedGameData?.benchIntervals || { red: { minutes: 3, seconds: 0 }, yellow: { minutes: 4, seconds: 30 } });

  // Equipos y marcador
  const [homeTeam, setHomeTeam] = useState(() => savedGameData?.homeTeam || 'Home');
  const [awayTeam, setAwayTeam] = useState(() => savedGameData?.awayTeam || 'Away');
  const [ourTeamColorId, setOurTeamColorId] = useState(() => savedGameData?.ourTeamColorId || 'orange');
  const [rivalTeamColorId, setRivalTeamColorId] = useState(() => savedGameData?.rivalTeamColorId || 'sky');
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
  const [partialScores, setPartialScores] = useState(() => savedGameData?.partialScores || createInitialPartialScores());
  const [eventLog, setEventLog] = useState(() => savedGameData?.eventLog || []);

  // Refs
  const longPressTimer = useRef(null);
  const gameStateRef = useRef(null);

  // i18n + UI states
  const { t, language, toggleLanguage } = useTranslation();
  const [courtExpanded, setCourtExpanded] = useState(false);
  const [benchExpanded, setBenchExpanded] = useState(false);
  const [showFouls, setShowFouls] = useState(false);
  const [freeThrowCount, setFreeThrowCount] = useState(null);
  const [expandedCrossPosition, setExpandedCrossPosition] = useState({});

  // Game setup flow states
  const [setupStep, setSetupStep] = useState(1); // 1=home/away, 2=our color, 3=rival name, 4=rival color
  const [setupIsHome, setSetupIsHome] = useState(null);
  const [setupOurColor, setSetupOurColor] = useState('orange');
  const [setupRivalColor, setSetupRivalColor] = useState('sky');
  const [setupRivalName, setSetupRivalName] = useState('');

  // Rival scoring step
  const [rivalScoringStep, setRivalScoringStep] = useState(null); // null or 'madeMissed'

  // Show exit modal when back button/gesture triggers from App
  useEffect(() => {
    if (showExitConfirm) {
      setActiveModal('exit');
      setPendingReplacement(null);
      onDismissExitConfirm();
    }
  }, [showExitConfirm, onDismissExitConfirm]);

  // ============================================
  // AUTOGUARDADO Y RECUPERACIÓN
  // ============================================

  // Inicialización
  useEffect(() => {
    setIsInitialized(true);
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
    const resolvedHomeTeam = isHome ? (teamName || t.home) : t.home;
    const resolvedAwayTeam = isHome ? t.away : (teamName || t.away);
    setHomeTeam(resolvedHomeTeam);
    setAwayTeam(resolvedAwayTeam);
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
    setPartialScores(createInitialPartialScores());
    setEventLog([]);

    setCurrentScreen('game');

    // Bug 1 fix: Guardar en Supabase inmediatamente al crear partido
    if (onGameSaved) {
      const initialState = {
        id: newId,
        gameStarted: true,
        isHomeTeam: isHome,
        players: effectivePlayers.map(createInitialPlayerState),
        gameRunning: false,
        gameTime: 600,
        currentQuarter: 1,
        homeTeam: resolvedHomeTeam,
        awayTeam: resolvedAwayTeam,
        ourTeamColorId: 'orange',
        rivalTeamColorId: 'sky',
        homeScore: 0,
        awayScore: 0,
        rotationHistory: [],
        actionHistory: [],
        quintetHistory: [],
        currentQuintet: null,
        substitutionsByQuarter: { 1: 0, 2: 0, 3: 0, 4: 0 },
        scoresByQuarter: { 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } },
        leadChanges: 0,
        ties: 0,
        biggestLead: { us: 0, them: 0 },
        partialScores: createInitialPartialScores(),
        eventLog: [],
        version: 2,
        status: 'in_progress',
        savedAt: Date.now()
      };
      onGameSaved(initialState).catch(err => console.error('Error saving new game to Supabase:', err));
    }
  }, [effectivePlayers, onGameSaved, t, teamName]);

  const createNewGameWithColors = useCallback((isHome, ourColorId, rivalColorId, ourName, rivalName) => {
    const newId = generateGameId();

    setCurrentGameId(newId);
    setGameStarted(true);
    setIsHomeTeam(isHome);
    setPlayers(effectivePlayers.map(createInitialPlayerState));
    setGameRunning(false);
    setGameTime(600);
    setCurrentQuarter(1);

    const resolvedHomeTeam = isHome ? ourName : rivalName;
    const resolvedAwayTeam = isHome ? rivalName : ourName;
    setHomeTeam(resolvedHomeTeam);
    setAwayTeam(resolvedAwayTeam);
    setOurTeamColorId(ourColorId);
    setRivalTeamColorId(rivalColorId);
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
    setPartialScores(createInitialPartialScores());
    setEventLog([]);
    // Reset setup state
    setSetupStep(1);
    setSetupIsHome(null);
    setSetupOurColor('orange');
    setSetupRivalColor('sky');
    setSetupRivalName('');

    setCurrentScreen('game');

    if (onGameSaved) {
      const initialState = {
        id: newId,
        gameStarted: true,
        isHomeTeam: isHome,
        players: effectivePlayers.map(createInitialPlayerState),
        gameRunning: false,
        gameTime: 600,
        currentQuarter: 1,
        homeTeam: resolvedHomeTeam,
        awayTeam: resolvedAwayTeam,
        ourTeamColorId: ourColorId,
        rivalTeamColorId: rivalColorId,
        homeScore: 0,
        awayScore: 0,
        rotationHistory: [],
        actionHistory: [],
        quintetHistory: [],
        currentQuintet: null,
        substitutionsByQuarter: { 1: 0, 2: 0, 3: 0, 4: 0 },
        scoresByQuarter: { 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } },
        leadChanges: 0,
        ties: 0,
        biggestLead: { us: 0, them: 0 },
        partialScores: createInitialPartialScores(),
        eventLog: [],
        version: 2,
        status: 'in_progress',
        savedAt: Date.now()
      };
      onGameSaved(initialState).catch(err => console.error('Error saving new game to Supabase:', err));
    }
  }, [effectivePlayers, onGameSaved, t, teamName]);

  // Obtener estado completo del partido para sincronizar
  const getFullGameState = useCallback(() => ({
    version: 2,
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
    ourTeamColorId,
    rivalTeamColorId,
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
    eventLog,
    savedAt: Date.now()
  }), [
    currentGameId, gameStarted, isHomeTeam, players, gameTime, currentQuarter,
    intervals, benchIntervals, homeTeam, awayTeam, ourTeamColorId, rivalTeamColorId,
    homeScore, awayScore,
    rotationHistory, actionHistory, quintetHistory, currentQuintet,
    substitutionsByQuarter, scoresByQuarter, leadChanges, ties, biggestLead, partialScores,
    eventLog
  ]);

  // Keep gameStateRef in sync with latest state
  useEffect(() => {
    gameStateRef.current = getFullGameState;
  }, [getFullGameState]);

  // Guardar y volver
  const saveAndExit = useCallback(async () => {
    const gameState = getFullGameState();
    gameState.status = 'in_progress';
    if (onGameSaved) await onGameSaved(gameState);
    setActiveModal(null);
    if (onExit) {
      onExit();
    } else {
      setCurrentScreen('team-selection');
      setCurrentGameId(null);
      setGameStarted(false);
    }
  }, [getFullGameState, onExit, onGameSaved]);

  // Finalizar partido y volver
  const finishGame = useCallback(async () => {
    const gameState = getFullGameState();
    gameState.status = 'completed';
    if (onGameSaved) await onGameSaved(gameState);

    setActiveModal(null);
    if (onExit) {
      onExit();
    } else {
      setCurrentScreen('team-selection');
      setCurrentGameId(null);
      setGameStarted(false);
    }
  }, [getFullGameState, onExit, onGameSaved]);

  // Autoguardado periódico (solo Supabase)
  // Uses gameStateRef to avoid resetting the interval on every state change
  useEffect(() => {
    if (!isInitialized || !currentGameId || currentScreen !== 'game') return;

    const interval = setInterval(() => {
      if (onGameSaved && gameStateRef.current) {
        const state = gameStateRef.current();
        state.status = 'in_progress';
        onGameSaved(state).catch(err => console.error('Error in autosave to Supabase:', err));
      }
    }, AUTOSAVE_INTERVAL);

    return () => clearInterval(interval);
  }, [isInitialized, currentGameId, currentScreen, onGameSaved]);

  // Guardar al cerrar ventana o cambiar de pestaña
  useEffect(() => {
    if (!isInitialized || !currentGameId || currentScreen !== 'game') return;

    // Helper para guardar en Supabase con encolado como respaldo
    let lastCloudSave = 0;
    const saveToCloud = (reason) => {
      const now = Date.now();
      // Debounce: no guardar en la nube más de una vez cada 2 segundos
      if (now - lastCloudSave < 2000) return;
      lastCloudSave = now;

      if (onGameSaved) {
        const state = getFullGameState();
        state.status = 'in_progress';
        onGameSaved(state).catch(err => {
          console.error(`Error saving to Supabase (${reason}):`, err);
        });
      }
    };

    // Guardar cuando el usuario cierra la ventana/pestaña
    const handleBeforeUnload = (e) => {
      // Intentar guardar en Supabase (fire-and-forget, puede no completar)
      saveToCloud('beforeunload');
      // Encolar en syncManager como respaldo (se procesará al reabrir la app)
      if (currentGameId && teamId && userId) {
        const state = getFullGameState();
        addToQueue({
          type: 'upsert_game',
          data: {
            id: currentGameId,
            team_id: teamId,
            created_by: userId,
            status: 'in_progress',
            home_team: state.homeTeam || t.home,
            away_team: state.awayTeam || t.away,
            home_score: state.homeScore || 0,
            away_score: state.awayScore || 0,
            is_home_team: state.isHomeTeam ?? true,
            current_quarter: state.currentQuarter || 1,
            game_data: state,
            updated_at: new Date().toISOString()
          }
        });
      }
      e.preventDefault();
      e.returnValue = '';
    };

    // Guardar cuando el usuario cambia de pestaña (útil en móviles)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        saveToCloud('visibilitychange');
      }
    };

    // Guardar cuando la app pierde el foco
    const handleBlur = () => {
      // Solo guardar en la nube si la página está oculta (evita disparos innecesarios en desktop)
      if (document.visibilityState === 'hidden') {
        saveToCloud('blur');
      }
    };

    window.addEventListener('beforeunload', handleBeforeUnload);
    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
    };
  }, [isInitialized, currentGameId, currentScreen, onGameSaved, getFullGameState, teamId, userId]);

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
    // Player never been on court yet → green (no urgency at game start)
    if (player.totalCourtTime === 0 && !player.lastToggle) return 'green';
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
  // Ref to track if quarter auto-advance needs quintet snapshot
  const quarterAdvancedRef = useRef(false);

  useEffect(() => {
    if (!gameRunning) return;

    const interval = setInterval(() => {
      const now = Date.now();

      // Actualizar tiempo de juego
      setGameTime(prev => {
        if (prev <= 0) {
          setGameRunning(false);
          if (currentQuarter < 4) {
            quarterAdvancedRef.current = true;
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

  const teamPositions = useMemo(() =>
    [...new Set(effectivePlayers.map(p => p.position).filter(p => p && p !== 'Unselected'))],
    [effectivePlayers]
  );

  const benchPlayersByPosition = useMemo(() => {
    const groups = {};
    teamPositions.forEach(pos => {
      groups[pos] = players.filter(p => p.position === pos);
    });
    groups.__unselected = players.filter(p => !p.position || p.position === 'Unselected');
    return groups;
  }, [players, teamPositions]);

  // Recomendaciones de cambio - MEMOIZADO
  const subRecommendations = useMemo(() => {
    const recommendations = [];
    const benchPlayers = players.filter(p => !p.onCourt && p.fouls < 5 && getFoulStatus(p.fouls, currentQuarter) === 'safe' && p.position !== 'Unselected');

    onCourtPlayers.forEach(player => {
      const courtStatus = getCourtTimeStatus(player);
      const foulStatus = getFoulStatus(player.fouls, currentQuarter);
      const needsSubForStint = courtStatus === 'red';
      const needsSubForFouls = foulStatus === 'danger' || foulStatus === 'warning';

      if (needsSubForFouls || needsSubForStint) {
        let samePositionBench = benchPlayers.filter(p => p.position === player.position);
        let crossPositionSuggestions = [];

        // Buscar jugadores en banquillo cuya secondary_positions incluya la posición del jugador a sacar
        benchPlayers.forEach(bp => {
          const secondaryPositions = bp.secondary_positions || [];
          if (secondaryPositions.includes(player.position) && bp.position !== player.position) {
            // Guardia: solo sugerir si hay otro jugador de su posición primaria en banquillo sin problemas de faltas
            // (el tiempo de banquillo se ignora, es cuestión de necesidad)
            const hasCover = players.some(p =>
              !p.onCourt && p.id !== bp.id && p.position === bp.position &&
              p.fouls < 5 && getFoulStatus(p.fouls, currentQuarter) !== 'danger' &&
              p.position !== 'Unselected'
            );
            if (hasCover) {
              crossPositionSuggestions.push({
                ...bp,
                isPlayingOutOfPosition: true,
                originalPosition: bp.position,
                playingAs: player.position
              });
            }
          }
        });

        if (samePositionBench.length > 0 || crossPositionSuggestions.length > 0) {
          const statusOrder = { green: 0, yellow: 1, red: 2 };
          const sortedSamePosition = [...samePositionBench].sort((a, b) =>
            statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]
          );
          const sortedCrossPosition = [...crossPositionSuggestions].sort((a, b) =>
            statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]
          );
          let reason = null, priority = 0, isFoulIssue = false;

          if (foulStatus === 'danger') {
            reason = { type: 'foulsDanger', fouls: player.fouls, quarter: currentQuarter };
            priority = 4;
            isFoulIssue = true;
          } else if (foulStatus === 'warning') {
            reason = { type: 'foulsWarning', fouls: player.fouls, quarter: currentQuarter };
            priority = 3;
            isFoulIssue = true;
          } else if (needsSubForStint) {
            reason = { type: 'rest', time: formatTime(player.currentMinutes) };
            priority = 1;
          }

          recommendations.push({
            out: player,
            samePositionSuggestions: sortedSamePosition,
            crossPositionSuggestions: sortedCrossPosition,
            reason, priority, isFoulIssue
          });
        }
      }
    });

    return recommendations.sort((a, b) => b.priority - a.priority);
  }, [players, onCourtPlayers, currentQuarter, getCourtTimeStatus, getBenchTimeStatus]);

  const fouledOutReplacements = useMemo(() => {
    if (!fouledOutPlayer) return [];
    const benchPlayers = players.filter(p => !p.onCourt && p.fouls < 5 && getFoulStatus(p.fouls, currentQuarter) === 'safe' && p.position !== 'Unselected');
    const statusOrder = { green: 0, yellow: 1, red: 2 };

    // Misma posición
    const samePosition = benchPlayers
      .filter(p => p.position === fouledOutPlayer.position)
      .sort((a, b) => statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]);

    // Posición secundaria: sugerir si hay otro jugador de su posición primaria en banquillo sin problemas de faltas
    const crossPosition = benchPlayers
      .filter(p => {
        if (p.position === fouledOutPlayer.position) return false;
        const secondaryPositions = p.secondary_positions || [];
        if (!secondaryPositions.includes(fouledOutPlayer.position)) return false;
        // Guardia: hay cover en banquillo para su posición primaria (ignorar tiempo, solo faltas)
        return players.some(bp =>
          !bp.onCourt && bp.id !== p.id && bp.position === p.position &&
          bp.fouls < 5 && getFoulStatus(bp.fouls, currentQuarter) !== 'danger' &&
          bp.position !== 'Unselected'
        );
      })
      .map(p => ({
        ...p,
        isPlayingOutOfPosition: true,
        originalPosition: p.position,
        playingAs: fouledOutPlayer.position
      }))
      .sort((a, b) => statusOrder[getBenchTimeStatus(a)] - statusOrder[getBenchTimeStatus(b)]);

    return [...samePosition, ...crossPosition];
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

  // Snapshot quintet when quarter auto-advances
  useEffect(() => {
    if (quarterAdvancedRef.current) {
      quarterAdvancedRef.current = false;
      const { ourScore, rivalScore } = getCurrentScores();
      if (currentQuintet) {
        endCurrentQuintet(ourScore, rivalScore);
        // Restart quintet with same players for the new quarter
        const onCourt = players.filter(p => p.onCourt);
        if (onCourt.length === 5) {
          startNewQuintet(onCourt.map(p => p.id), ourScore, rivalScore);
        }
      }
    }
  }, [currentQuarter, currentQuintet, getCurrentScores, endCurrentQuintet, startNewQuintet, players]);

  const updateGameFlow = useCallback((newOurScore, newRivalScore) => {
    const { ourScore, rivalScore } = getCurrentScores();
    const prevDiff = ourScore - rivalScore;
    const newDiff = newOurScore - newRivalScore;

    if (newDiff === 0 && prevDiff !== 0) setTies(prev => prev + 1);
    if ((prevDiff > 0 && newDiff < 0) || (prevDiff < 0 && newDiff > 0)) setLeadChanges(prev => prev + 1);
    setBiggestLead(prev => ({
      us: newDiff > prev.us ? newDiff : prev.us,
      them: -newDiff > prev.them ? -newDiff : prev.them
    }));
  }, [getCurrentScores]);

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
      quarter: currentQuarter,
      previousPlayerState: {
        currentMinutes: player.currentMinutes,
        lastToggle: player.lastToggle,
        totalCourtTime: player.totalCourtTime,
        totalBenchTime: player.totalBenchTime,
        stints: [...player.stints],
        stintPlusMinus: [...player.stintPlusMinus],
        currentStintStart: player.currentStintStart
      },
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

    // Show replacement modal when going from 5 to 4 on court
    if (player.onCourt && currentOnCourtCount === 5) {
      setPendingReplacement({ outPlayer: { id: player.id, name: player.name, number: player.number, position: player.position } });
    }
  }, [players, getCurrentScores, endCurrentQuintet, startNewQuintet, currentQuarter, gameRunning]);

  const toggleGameRunning = useCallback(() => {
    const currentOnCourtCount = players.filter(p => p.onCourt).length;
    if (!gameRunning && currentOnCourtCount !== 5) {
      setCourtWarning(t.playersNeeded(5 - currentOnCourtCount));
      return;
    }

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
  }, [players, gameRunning, getCurrentScores, currentQuintet, startNewQuintet, endCurrentQuintet, t]);

  const adjustFouls = useCallback((playerId, delta) => {
    const player = players.find(p => p.id === playerId);
    if (!player) return;

    const newFouls = Math.max(0, Math.min(5, player.fouls + delta));
    if (newFouls === player.fouls) return;

    const { ourScore, rivalScore } = getCurrentScores();

    // Save full player state so undo of 5th foul can restore everything
    const previousPlayerState = newFouls >= 5 && player.onCourt ? {
      currentMinutes: player.currentMinutes,
      lastToggle: player.lastToggle,
      totalCourtTime: player.totalCourtTime,
      totalBenchTime: player.totalBenchTime,
      stints: [...player.stints],
      stintPlusMinus: [...player.stintPlusMinus],
      currentStintStart: player.currentStintStart
    } : null;

    setActionHistory(prev => [...prev, {
      type: 'foul',
      playerId,
      delta,
      previousFouls: player.fouls,
      wasOnCourt: player.onCourt,
      previousPlayerState,
      scoreAtAction: { ourScore, rivalScore }
    }]);
    if (delta > 0) {
      setEventLog(prev => [...prev, {
        timestamp: Date.now(),
        gameTime,
        quarter: currentQuarter,
        type: 'foul',
        team: isHomeTeam ? 'home' : 'away',
        playerId,
        assistById: null,
        value: delta,
        playType: null,
        lineupOnCourt: players.filter(p => p.onCourt).map(p => p.id)
      }]);
    }

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
      setActiveModal('fouledOut');
      setPendingReplacement(null);
    } else {
      setPlayers(prev => prev.map(p => p.id === playerId ? { ...p, fouls: newFouls } : p));
    }
  }, [players, getCurrentScores, endCurrentQuintet, currentQuarter, gameRunning, gameTime, isHomeTeam]);

  const addFoulToPlayer = useCallback((playerId) => {
    adjustFouls(playerId, 1);
    setActiveModal(null);
  }, [adjustFouls]);

  const undoLastAction = useCallback(() => {
    if (actionHistory.length === 0) return;

    const lastAction = actionHistory[actionHistory.length - 1];

    if (lastAction.type === 'score') {
      const actionQuarter = lastAction.quarter || currentQuarter;
      if (lastAction.isOurTeam) {
        if (isHomeTeam) setHomeScore(prev => prev - lastAction.points);
        else setAwayScore(prev => prev - lastAction.points);
        if (lastAction.playerId) {
          const shotKey = `pts${lastAction.points}`;
          setPlayers(prev => prev.map(p =>
            p.id === lastAction.playerId ? {
              ...p,
              points: p.points - lastAction.points,
              shotStats: {
                ...p.shotStats,
                [shotKey]: {
                  ...p.shotStats?.[shotKey],
                  made: Math.max(0, (p.shotStats?.[shotKey]?.made || 0) - 1)
                }
              }
            } : p
          ));
        }
        setScoresByQuarter(prev => ({
          ...prev,
          [actionQuarter]: {
            ...prev[actionQuarter],
            us: prev[actionQuarter].us - lastAction.points
          }
        }));
      } else {
        if (isHomeTeam) setAwayScore(prev => prev - lastAction.points);
        else setHomeScore(prev => prev - lastAction.points);
        setScoresByQuarter(prev => ({
          ...prev,
          [actionQuarter]: {
            ...prev[actionQuarter],
            them: prev[actionQuarter].them - lastAction.points
          }
        }));
      }
    } else if (lastAction.type === 'foul') {
      setPlayers(prev => prev.map(p => {
        if (p.id !== lastAction.playerId) return p;
        const restored = { ...p, fouls: lastAction.previousFouls };
        // If undoing a fouled-out (5th foul), restore full player state
        if (lastAction.previousPlayerState && lastAction.wasOnCourt) {
          return { ...restored, ...lastAction.previousPlayerState, onCourt: true };
        }
        if (lastAction.wasOnCourt !== undefined) {
          restored.onCourt = lastAction.wasOnCourt;
        }
        return restored;
      }));
      if (lastAction.previousFouls === 4 && lastAction.wasOnCourt) {
        setRotationHistory(prev => prev.slice(0, -1));
        setFouledOutPlayer(null);
        setActiveModal(null);
      }
    } else if (lastAction.type === 'substitution') {
      const actionQuarter = lastAction.quarter || currentQuarter;
      setPlayers(prev => prev.map(p =>
        p.id === lastAction.playerId
          ? { ...p, onCourt: lastAction.wasOnCourt, ...(lastAction.previousPlayerState || { currentMinutes: 0 }) }
          : p
      ));
      setRotationHistory(prev => prev.slice(0, -1));
      setSubstitutionsByQuarter(prev => ({
        ...prev,
        [actionQuarter]: Math.max(0, prev[actionQuarter] - 1)
      }));
    } else if (lastAction.type === 'swap') {
      const actionQuarter = lastAction.quarter || currentQuarter;
      setPlayers(prev => prev.map(p => {
        if (p.id === lastAction.outId) return { ...p, onCourt: true, ...(lastAction.previousOutPlayerState || { currentMinutes: 0 }) };
        if (p.id === lastAction.inId) return { ...p, onCourt: false, ...(lastAction.previousInPlayerState || { currentMinutes: 0 }) };
        return p;
      }));
      setRotationHistory(prev => prev.slice(0, -2));
      setSubstitutionsByQuarter(prev => ({
        ...prev,
        [actionQuarter]: Math.max(0, prev[actionQuarter] - 2)
      }));
    } else if (lastAction.type === 'miss') {
      const shotKey = lastAction.points ? `pts${lastAction.points}` : null;
      setPlayers(prev => prev.map(p =>
        p.id === lastAction.playerId ? {
          ...p,
          missedShots: Math.max(0, (p.missedShots || 0) - 1),
          ...(shotKey ? {
            shotStats: {
              ...p.shotStats,
              [shotKey]: {
                ...p.shotStats?.[shotKey],
                missed: Math.max(0, (p.shotStats?.[shotKey]?.missed || 0) - 1)
              }
            }
          } : {})
        } : p
      ));
      setEventLog(prev => prev.slice(0, -1));
    } else if (lastAction.type === 'freeThrow') {
      const actionQuarter = lastAction.quarter || currentQuarter;
      // Undo points
      if (lastAction.madeCount > 0) {
        if (isHomeTeam) setHomeScore(prev => prev - lastAction.madeCount);
        else setAwayScore(prev => prev - lastAction.madeCount);
        setScoresByQuarter(prev => ({
          ...prev,
          [actionQuarter]: {
            ...prev[actionQuarter],
            us: prev[actionQuarter].us - lastAction.madeCount
          }
        }));
      }
      // Undo player stats + shotStats.pts1
      setPlayers(prev => prev.map(p =>
        p.id === lastAction.playerId
          ? {
              ...p,
              points: p.points - lastAction.madeCount,
              missedShots: Math.max(0, (p.missedShots || 0) - lastAction.missedCount),
              shotStats: {
                ...p.shotStats,
                pts1: {
                  made: Math.max(0, (p.shotStats?.pts1?.made || 0) - lastAction.madeCount),
                  missed: Math.max(0, (p.shotStats?.pts1?.missed || 0) - lastAction.missedCount)
                }
              }
            }
          : p
      ));
      // Remove all eventLog entries for this FT sequence (madeCount + missedCount entries)
      const totalEvents = lastAction.madeCount + lastAction.missedCount;
      setEventLog(prev => prev.slice(0, -totalEvents));
    }

    // Undo rival miss: just remove the eventLog entry
    if (lastAction.type === 'rivalMiss') {
      setEventLog(prev => prev.slice(0, -1));
    }

    // Remove corresponding eventLog entry for score/foul actions
    // Note: 'miss', 'freeThrow', and 'rivalMiss' eventLog removal is handled in their own cases above
    if (lastAction.type === 'score' || (lastAction.type === 'foul' && lastAction.delta > 0)) {
      setEventLog(prev => prev.slice(0, -1));
    }

    setActionHistory(prev => prev.slice(0, -1));
  }, [actionHistory, isHomeTeam, currentQuarter]);

  const handleResetMouseDown = useCallback(() => {
    setIsLongPress(false);
    longPressTimer.current = setTimeout(() => {
      setIsLongPress(true);
      setActiveModal('reset');
      setPendingReplacement(null);
    }, 800);
  }, []);

  const handleResetMouseUp = useCallback((e) => {
    // Prevent double-fire on touch devices (touchEnd + mouseUp)
    if (e?.type === 'touchend') e.preventDefault();
    clearTimeout(longPressTimer.current);
    if (!isLongPress) undoLastAction();
  }, [isLongPress, undoLastAction]);

  const handleResetMouseLeave = useCallback(() => {
    clearTimeout(longPressTimer.current);
  }, []);

  const confirmReset = useCallback(() => {
    // Resetear todos los estados
    setPlayers(effectivePlayers.map(createInitialPlayerState));
    setGameTime(600);
    setCurrentQuarter(1);
    setGameRunning(false);
    setActiveModal(null);
    setRotationHistory([]);
    setHomeTeam(t.home);
    setAwayTeam(t.away);
    // Note: confirmReset goes back to team-selection, so teamName auto-fill not needed here
    setHomeScore(0);
    setAwayScore(0);
    setGameStarted(false);
    setIsHomeTeam(null);
    setActionHistory([]);
    setFouledOutPlayer(null);
    setActiveModal(null);
    setQuintetHistory([]);
    setCurrentQuintet(null);
    setSubstitutionsByQuarter({ 1: 0, 2: 0, 3: 0, 4: 0 });
    setScoresByQuarter({ 1: { us: 0, them: 0 }, 2: { us: 0, them: 0 }, 3: { us: 0, them: 0 }, 4: { us: 0, them: 0 } });
    setLeadChanges(0);
    setTies(0);
    setBiggestLead({ us: 0, them: 0 });
    setPartialScores(createInitialPartialScores());
    setEventLog([]);
    // Reset UI states
    setCourtExpanded(false);
    setBenchExpanded(false);
    setShowFouls(false);
    setFreeThrowCount(null);
    setExpandedCrossPosition({});
    setRivalScoringStep(null);
    setSelectedPoints(null);
    setSelectedScorePlayer(null);
    setPendingReplacement(null);
    setCourtWarning(null);
    // Reset setup wizard
    setSetupStep(1);
    setSetupIsHome(null);
    setSetupOurColor('orange');
    setSetupRivalColor('sky');
    setSetupRivalName('');

    // Volver
    setCurrentGameId(null);
    if (onExit) {
      onExit();
    } else {
      setCurrentScreen('team-selection');
    }
  }, [effectivePlayers, onExit, t]);

  const addPoints = useCallback((playerId, missed = false) => {
    if (missed) {
      // Record miss in eventLog but don't add points
      setEventLog(prev => [...prev, {
        timestamp: Date.now(),
        gameTime,
        quarter: currentQuarter,
        type: 'miss',
        team: isHomeTeam ? 'home' : 'away',
        playerId,
        assistById: null,
        value: selectedPoints,
        playType: null,
        lineupOnCourt: players.filter(p => p.onCourt).map(p => p.id)
      }]);
      setActionHistory(prev => [...prev, {
        type: 'miss',
        playerId,
        points: selectedPoints,
        quarter: currentQuarter
      }]);
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? {
          ...p,
          missedShots: (p.missedShots || 0) + 1,
          shotStats: {
            ...p.shotStats,
            [`pts${selectedPoints}`]: {
              made: p.shotStats?.[`pts${selectedPoints}`]?.made || 0,
              missed: (p.shotStats?.[`pts${selectedPoints}`]?.missed || 0) + 1
            }
          }
        } : p
      ));
      setActiveModal(null);
      setSelectedPoints(null);
      setSelectedScorePlayer(null);
      setRivalScoringStep(null);
      return;
    }

    const { ourScore, rivalScore } = getCurrentScores();
    updateGameFlow(ourScore + selectedPoints, rivalScore);

    setActionHistory(prev => [...prev, {
      type: 'score',
      playerId,
      points: selectedPoints,
      isOurTeam: true,
      quarter: currentQuarter
    }]);
    setEventLog(prev => [...prev, {
      timestamp: Date.now(),
      gameTime,
      quarter: currentQuarter,
      type: 'score',
      subtype: 'made',
      team: isHomeTeam ? 'home' : 'away',
      playerId,
      assistById: null,
      value: selectedPoints,
      playType: null,
      lineupOnCourt: players.filter(p => p.onCourt).map(p => p.id)
    }]);
    setPlayers(prev => prev.map(p =>
      p.id === playerId ? {
        ...p,
        points: p.points + selectedPoints,
        shotStats: {
          ...p.shotStats,
          [`pts${selectedPoints}`]: {
            made: (p.shotStats?.[`pts${selectedPoints}`]?.made || 0) + 1,
            missed: p.shotStats?.[`pts${selectedPoints}`]?.missed || 0
          }
        }
      } : p
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
    setActiveModal(null);
    setSelectedPoints(null);
    setSelectedScorePlayer(null);
    setRivalScoringStep(null);
  }, [getCurrentScores, updateGameFlow, selectedPoints, isHomeTeam, currentQuarter, gameTime, players]);

  const addRivalPoints = useCallback(() => {
    const { ourScore, rivalScore } = getCurrentScores();
    updateGameFlow(ourScore, rivalScore + selectedPoints);

    setActionHistory(prev => [...prev, {
      type: 'score',
      playerId: null,
      points: selectedPoints,
      isOurTeam: false,
      quarter: currentQuarter
    }]);
    setEventLog(prev => [...prev, {
      timestamp: Date.now(),
      gameTime,
      quarter: currentQuarter,
      type: 'score',
      subtype: 'made',
      team: isHomeTeam ? 'away' : 'home',
      playerId: null,
      assistById: null,
      value: selectedPoints,
      playType: null,
      lineupOnCourt: players.filter(p => p.onCourt).map(p => p.id)
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
    setActiveModal(null);
    setSelectedPoints(null);
    setSelectedScorePlayer(null);
    setRivalScoringStep(null);
  }, [getCurrentScores, updateGameFlow, selectedPoints, isHomeTeam, currentQuarter, gameTime, players]);

  const addRivalMiss = useCallback(() => {
    setEventLog(prev => [...prev, {
      timestamp: Date.now(),
      gameTime,
      quarter: currentQuarter,
      type: 'miss',
      team: isHomeTeam ? 'away' : 'home',
      playerId: null,
      assistById: null,
      value: selectedPoints,
      playType: null,
      lineupOnCourt: players.filter(p => p.onCourt).map(p => p.id)
    }]);
    setActionHistory(prev => [...prev, {
      type: 'rivalMiss',
      points: selectedPoints,
      quarter: currentQuarter
    }]);
    setActiveModal(null);
    setSelectedPoints(null);
    setSelectedScorePlayer(null);
    setRivalScoringStep(null);
  }, [selectedPoints, isHomeTeam, currentQuarter, gameTime, players]);

  const addFreeThrows = useCallback((playerId, madeCount) => {
    const missedCount = freeThrowCount - madeCount;
    const { ourScore, rivalScore } = getCurrentScores();

    if (madeCount > 0) {
      updateGameFlow(ourScore + madeCount, rivalScore);

      if (isHomeTeam) setHomeScore(prev => prev + madeCount);
      else setAwayScore(prev => prev + madeCount);

      setPlayers(prev => prev.map(p =>
        p.id === playerId ? {
          ...p,
          points: p.points + madeCount,
          missedShots: (p.missedShots || 0) + missedCount,
          shotStats: {
            ...p.shotStats,
            pts1: {
              made: (p.shotStats?.pts1?.made || 0) + madeCount,
              missed: (p.shotStats?.pts1?.missed || 0) + missedCount
            }
          }
        } : p
      ));

      setScoresByQuarter(prev => ({
        ...prev,
        [currentQuarter]: {
          ...prev[currentQuarter],
          us: prev[currentQuarter].us + madeCount
        }
      }));
    } else {
      // All missed
      setPlayers(prev => prev.map(p =>
        p.id === playerId ? {
          ...p,
          missedShots: (p.missedShots || 0) + missedCount,
          shotStats: {
            ...p.shotStats,
            pts1: {
              made: p.shotStats?.pts1?.made || 0,
              missed: (p.shotStats?.pts1?.missed || 0) + missedCount
            }
          }
        } : p
      ));
    }

    // Add individual events to eventLog
    const lineupOnCourt = players.filter(p => p.onCourt).map(p => p.id);
    const now = Date.now();
    const newEvents = [];
    for (let i = 0; i < madeCount; i++) {
      newEvents.push({
        timestamp: now,
        gameTime,
        quarter: currentQuarter,
        type: 'score',
        subtype: 'made',
        team: isHomeTeam ? 'home' : 'away',
        playerId,
        assistById: null,
        value: 1,
        playType: 'freeThrow',
        lineupOnCourt
      });
    }
    for (let i = 0; i < missedCount; i++) {
      newEvents.push({
        timestamp: now,
        gameTime,
        quarter: currentQuarter,
        type: 'miss',
        team: isHomeTeam ? 'home' : 'away',
        playerId,
        assistById: null,
        value: 1,
        playType: 'freeThrow',
        lineupOnCourt
      });
    }
    setEventLog(prev => [...prev, ...newEvents]);

    // Single actionHistory entry
    setActionHistory(prev => [...prev, {
      type: 'freeThrow',
      playerId,
      madeCount,
      missedCount,
      freeThrowCount,
      quarter: currentQuarter
    }]);

    setActiveModal(null);
    setSelectedPoints(null);
    setSelectedScorePlayer(null);
    setFreeThrowCount(null);
  }, [freeThrowCount, getCurrentScores, updateGameFlow, isHomeTeam, currentQuarter, gameTime, players]);

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
      quarter: currentQuarter,
      previousOutPlayerState: {
        currentMinutes: outPlayer.currentMinutes,
        lastToggle: outPlayer.lastToggle,
        totalCourtTime: outPlayer.totalCourtTime,
        totalBenchTime: outPlayer.totalBenchTime,
        stints: [...outPlayer.stints],
        stintPlusMinus: [...outPlayer.stintPlusMinus],
        currentStintStart: outPlayer.currentStintStart
      },
      previousInPlayerState: {
        currentMinutes: inPlayer.currentMinutes,
        lastToggle: inPlayer.lastToggle,
        totalCourtTime: inPlayer.totalCourtTime,
        totalBenchTime: inPlayer.totalBenchTime,
        stints: [...inPlayer.stints],
        stintPlusMinus: [...inPlayer.stintPlusMinus],
        currentStintStart: inPlayer.currentStintStart
      },
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
    setActiveModal(null);
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
    setEditForm({ name: '', number: '', position: '' });
  }, []);

  // ============================================
  // GENERAR REPORTE
  // ============================================
  const generateReport = useCallback(() => {
    const { ourScore, rivalScore } = getCurrentScores();

    // If there's an active quintet, calculate its stats inline for the report without ending it
    let reportQuintetHistory = quintetHistory;
    if (currentQuintet) {
      const duration = (Date.now() - currentQuintet.startTime) / 1000 / 60;
      const activeQuintetEntry = {
        ...currentQuintet,
        endTime: Date.now(),
        duration,
        pointsScored: ourScore - currentQuintet.startOurScore,
        pointsAllowed: rivalScore - currentQuintet.startRivalScore,
        differential: (ourScore - currentQuintet.startOurScore) - (rivalScore - currentQuintet.startRivalScore)
      };
      reportQuintetHistory = [...quintetHistory, activeQuintetEntry];
    }

    generateReportHTML({ ourScore, rivalScore, ourTeamName, rivalTeamName, players, quintetHistory: reportQuintetHistory, substitutionsByQuarter });
  }, [getCurrentScores, currentQuintet, players, quintetHistory, substitutionsByQuarter, ourTeamName, rivalTeamName]);

  // Helper para renderizar razón de recomendación
  const renderReason = (reason) => {
    if (!reason) return '';
    switch (reason.type) {
      case 'foulsDanger': return t.foulsDanger(reason.fouls, reason.quarter);
      case 'foulsWarning': return t.foulsWarning(reason.fouls, reason.quarter);
      case 'rest': return t.restReason(reason.time);
      default: return '';
    }
  };

  // ============================================
  // RENDER - PANTALLA DE CARGA
  // ============================================
  if (!isInitialized) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p>{t.loading}</p>
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - PANTALLA SELECCIÓN DE EQUIPO
  // ============================================
  if (currentScreen === 'team-selection') {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center p-4">
        <div className="bg-slate-800 rounded-2xl p-6 sm:p-8 border-2 border-orange-500 max-w-md w-full">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => {
                if (setupStep > 1) {
                  setSetupStep(setupStep - 1);
                } else {
                  onExit && onExit();
                }
              }}
              className="text-slate-400 hover:text-white flex items-center gap-2 min-h-[44px]"
            >
              {t.back}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t.step} {setupStep}/4</span>
              <button
                onClick={toggleLanguage}
                className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold"
              >
                {language === 'en' ? 'ES' : 'EN'}
              </button>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 mb-6">
            <PlayStatsIcon className="w-8 h-8 text-orange-500" />
            <h1 className="text-xl sm:text-2xl font-black text-orange-400">{t.newGame}</h1>
          </div>

          {/* Step 1: Home or Away */}
          {setupStep === 1 && (
            <>
              <h2 className="text-lg font-bold text-center mb-6 text-slate-300">{t.teamPlaysAs}</h2>
              <div className="grid grid-cols-2 gap-4">
                <button onClick={() => { setSetupIsHome(true); setSetupStep(2); }} className="bg-orange-500 hover:bg-orange-400 active:bg-orange-300 rounded-xl p-4 sm:p-6 font-black text-center border-2 border-orange-300 min-h-[100px]">
                  <div className="text-3xl sm:text-4xl mb-2">🏠</div>
                  <div className="text-lg sm:text-xl">{t.home}</div>
                </button>
                <button onClick={() => { setSetupIsHome(false); setSetupStep(2); }} className="bg-sky-500 hover:bg-sky-400 active:bg-sky-300 rounded-xl p-4 sm:p-6 font-black text-center border-2 border-sky-300 min-h-[100px]">
                  <div className="text-3xl sm:text-4xl mb-2">✈️</div>
                  <div className="text-lg sm:text-xl">{t.away}</div>
                </button>
              </div>
            </>
          )}

          {/* Step 2: Our team color */}
          {setupStep === 2 && (
            <>
              <h2 className="text-lg font-bold text-center mb-6 text-slate-300">{t.selectColor}</h2>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {TEAM_COLORS.map(color => (
                  <button
                    key={color.id}
                    onClick={() => setSetupOurColor(color.id)}
                    className={`w-full aspect-square rounded-xl ${color.swatch} ${setupOurColor === color.id ? `ring-4 ${color.ring} scale-110` : 'ring-2 ring-slate-600 opacity-70 hover:opacity-100'} transition-all ${color.id === 'white' ? 'text-slate-800' : ''}`}
                    title={t[color.label]}
                  />
                ))}
              </div>
              <button
                onClick={() => setSetupStep(3)}
                className="w-full min-h-[56px] bg-emerald-500 active:bg-emerald-400 rounded-xl font-black text-lg"
              >
                {t.ok}
              </button>
            </>
          )}

          {/* Step 3: Rival name */}
          {setupStep === 3 && (
            <>
              <h2 className="text-lg font-bold text-center mb-6 text-slate-300">{t.rivalName}</h2>
              <input
                type="text"
                value={setupRivalName}
                onChange={(e) => setSetupRivalName(e.target.value)}
                placeholder={setupIsHome ? t.awayDefault : t.homeDefault}
                className="w-full bg-slate-900 text-white px-4 py-3 rounded-xl text-center text-lg font-bold mb-6 border-2 border-slate-600 focus:border-orange-500 outline-none"
                autoFocus
              />
              <button
                onClick={() => setSetupStep(4)}
                className="w-full min-h-[56px] bg-emerald-500 active:bg-emerald-400 rounded-xl font-black text-lg"
              >
                {t.ok}
              </button>
            </>
          )}

          {/* Step 4: Rival color */}
          {setupStep === 4 && (
            <>
              <h2 className="text-lg font-bold text-center mb-6 text-slate-300">{t.selectRivalColor}</h2>
              <div className="grid grid-cols-5 gap-3 mb-6">
                {TEAM_COLORS.filter(c => c.id !== setupOurColor).map(color => (
                  <button
                    key={color.id}
                    onClick={() => setSetupRivalColor(color.id)}
                    className={`w-full aspect-square rounded-xl ${color.swatch} ${setupRivalColor === color.id ? `ring-4 ${color.ring} scale-110` : 'ring-2 ring-slate-600 opacity-70 hover:opacity-100'} transition-all ${color.id === 'white' ? 'text-slate-800' : ''}`}
                    title={t[color.label]}
                  />
                ))}
              </div>
              <button
                onClick={() => {
                  // If selected color got filtered out (was same as our color), pick first available
                  const availableColors = TEAM_COLORS.filter(c => c.id !== setupOurColor);
                  const finalRivalColor = availableColors.find(c => c.id === setupRivalColor) ? setupRivalColor : availableColors[0].id;

                  // Determine team names
                  const rivalName = setupRivalName.trim() || (setupIsHome ? t.awayDefault : t.homeDefault);
                  const ourName = teamName || (setupIsHome ? t.homeDefault : t.awayDefault);

                  // Create the game with colors
                  createNewGameWithColors(setupIsHome, setupOurColor, finalRivalColor, ourName, rivalName);
                }}
                className="w-full min-h-[56px] bg-emerald-500 active:bg-emerald-400 rounded-xl font-black text-lg"
              >
                {t.startGame}
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  // ============================================
  // RENDER - PANTALLA PRINCIPAL DEL PARTIDO
  // ============================================

  // Helper para renderizar PlayerCard con todas las props comunes
  const renderPlayerCard = (p, isRosterView, sectionExpanded) => (
    <PlayerCard
      key={p.id}
      player={p}
      isRosterView={isRosterView}
      compact={!sectionExpanded}
      currentQuarter={currentQuarter}
      editingPlayer={editingPlayer}
      editForm={editForm}
      onEditFormChange={setEditForm}
      onStartEditing={startEditingPlayer}
      onSaveEdit={savePlayerEdit}
      onCancelEdit={cancelPlayerEdit}
      onToggleCourt={toggleCourt}
      onAdjustFouls={adjustFouls}
      getCourtTimeStatus={getCourtTimeStatus}
      getBenchTimeStatus={getBenchTimeStatus}
      teamPositions={teamPositions}
    />
  );

  const ourColor = getTeamColor(ourTeamColorId);
  const rivalColor = getTeamColor(rivalTeamColorId);
  const homeColor = isHomeTeam ? ourColor : rivalColor;
  const awayColor = isHomeTeam ? rivalColor : ourColor;

  const hasFoulWarnings = warningPlayers.length > 0 || dangerPlayers.length > 0;

  return (
    <>
    {/* ===== MODALS ===== */}

    {/* Exit modal */}
    {activeModal === 'exit' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-6 border-2 border-orange-500 max-w-sm w-full modal-content">
          <h3 className="text-xl font-black text-center mb-4 text-orange-400">{t.whatToDo}</h3>
          <div className="space-y-3">
            <button onClick={saveAndExit} className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-400 min-h-[56px] rounded-lg font-bold">
              💾 {t.saveAndExit}
              <div className="text-xs font-normal opacity-75">{t.canContinueLater}</div>
            </button>
            <button onClick={finishGame} className="w-full bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-400 min-h-[56px] rounded-lg font-bold">
              ✅ {t.finishGame}
              <div className="text-xs font-normal opacity-75">{t.savedToHistory}</div>
            </button>
            <button onClick={() => setActiveModal(null)} className="w-full bg-slate-600 hover:bg-slate-500 active:bg-slate-400 min-h-[44px] rounded-lg font-bold">
              ❌ {t.cancel}
            </button>
          </div>
        </div>
      </div>
    )}

    {/* Fouled out modal */}
    {activeModal === 'fouledOut' && fouledOutPlayer && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-red-500 max-w-sm w-full modal-content">
          <div className="text-center mb-3">
            <XCircle className="w-12 h-12 text-red-500 mx-auto mb-2" />
            <h3 className="text-xl font-black text-red-400">{t.fouledOut}</h3>
            <p className="font-bold">#{fouledOutPlayer.number} {fouledOutPlayer.name}</p>
          </div>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {fouledOutReplacements.map(s => (
              <button key={s.id} onClick={() => subInPlayer(s.id)} className={`${s.isPlayingOutOfPosition ? 'bg-purple-600 active:bg-purple-500' : 'bg-emerald-600 active:bg-emerald-500'} rounded-lg p-3 min-h-[48px] font-bold text-left`}>
                <div>#{s.number} {s.name}</div>
                <div className="text-xs opacity-80">
                  {formatTime(s.currentMinutes)}
                  {s.isPlayingOutOfPosition && <span className="ml-1 text-amber-300">⚠️ {s.originalPosition}→{s.playingAs}</span>}
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => { setActiveModal(null); setFouledOutPlayer(null); }} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.close}</button>
        </div>
      </div>
    )}

    {/* Foul modal */}
    {activeModal === 'foul' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-amber-500 max-w-sm w-full modal-content">
          <h3 className="text-lg font-black mb-3 text-amber-400 text-center">{t.whoFouled}</h3>
          <div className="grid grid-cols-2 gap-2 mb-3">
            {onCourtPlayers.map(player => (
              <button key={player.id} onClick={() => addFoulToPlayer(player.id)} className="bg-amber-700 active:bg-amber-600 rounded-lg min-h-[48px] p-3 font-bold text-left">
                <div className="flex justify-between items-center">
                  <span>#{player.number} {player.name}</span>
                  <span className={`${getFoulBgClass(player.fouls, currentQuarter)} px-2 py-0.5 rounded text-sm`}>{player.fouls}</span>
                </div>
              </button>
            ))}
          </div>
          <button onClick={() => setActiveModal(null)} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.cancel}</button>
        </div>
      </div>
    )}

    {/* Score modal — 2-step flow: select player → made/missed (+ rival made/missed) */}
    {activeModal === 'score' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-orange-500 max-w-sm w-full modal-content">
          {rivalScoringStep === 'madeMissed' ? (
            // Rival Made/Missed step
            <>
              <h3 className="text-lg font-black mb-1 text-center" style={{color: rivalColor.id === 'white' ? '#94a3b8' : undefined}}>
                <span className={rivalColor.text}>{rivalTeamName}</span>
              </h3>
              <p className="text-center text-slate-400 text-sm mb-4">{selectedPoints} {selectedPoints === 1 ? 'PT' : 'PTS'} — {t.rivalMadeOrMissed}</p>
              <div className="flex gap-3 mb-3">
                <button onClick={() => { addRivalPoints(); setRivalScoringStep(null); }} className="flex-1 min-h-[64px] bg-emerald-500 active:bg-emerald-400 rounded-xl font-black text-xl flex items-center justify-center gap-2">
                  ✓ {t.made}
                </button>
                <button onClick={() => { addRivalMiss(); setRivalScoringStep(null); }} className="flex-1 min-h-[64px] bg-rose-500 active:bg-rose-400 rounded-xl font-black text-xl flex items-center justify-center gap-2">
                  ✗ {t.missed}
                </button>
              </div>
              <button onClick={() => setRivalScoringStep(null)} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.back}</button>
            </>
          ) : !selectedScorePlayer ? (
            // Step 1: Select player or rival
            <>
              <h3 className="text-lg font-black mb-3 text-orange-400 text-center">{t.whosShooting} ({selectedPoints} {selectedPoints === 1 ? 'PT' : 'PTS'})</h3>
              <div className="mb-3">
                <div className="text-xs font-bold text-orange-400 mb-1">{ourTeamName}</div>
                <div className="grid grid-cols-2 gap-2">
                  {onCourtPlayers.map(player => (
                    <button key={player.id} onClick={() => setSelectedScorePlayer({ id: player.id, name: player.name, number: player.number })} className={`${ourColor.bg} active:opacity-80 rounded-lg min-h-[48px] p-2 font-bold text-sm ${ourColor.id === 'white' ? 'text-slate-800' : ''}`}>
                      #{player.number} {player.name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => setRivalScoringStep('madeMissed')} className={`w-full min-h-[48px] ${rivalColor.bg} active:opacity-80 rounded-lg font-bold mb-2 ${rivalColor.id === 'white' ? 'text-slate-800' : ''}`}>
                +{selectedPoints} {rivalTeamName}
              </button>
              <button onClick={() => { setActiveModal(null); setSelectedPoints(null); setRivalScoringStep(null); }} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.cancel}</button>
            </>
          ) : (
            // Step 2: Made/Missed for our player
            <>
              <h3 className="text-lg font-black mb-1 text-orange-400 text-center">#{selectedScorePlayer.number} {selectedScorePlayer.name}</h3>
              <p className="text-center text-slate-400 text-sm mb-4">{selectedPoints} {selectedPoints === 1 ? 'PT' : 'PTS'}</p>
              <div className="flex gap-3 mb-3">
                <button onClick={() => addPoints(selectedScorePlayer.id, false)} className="flex-1 min-h-[64px] bg-emerald-500 active:bg-emerald-400 rounded-xl font-black text-xl flex items-center justify-center gap-2">
                  ✓ {t.made}
                </button>
                <button onClick={() => addPoints(selectedScorePlayer.id, true)} className="flex-1 min-h-[64px] bg-rose-500 active:bg-rose-400 rounded-xl font-black text-xl flex items-center justify-center gap-2">
                  ✗ {t.missed}
                </button>
              </div>
              <button onClick={() => setSelectedScorePlayer(null)} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.back}</button>
            </>
          )}
        </div>
      </div>
    )}

    {/* Free throw count selector — Step 1: How many FTs? */}
    {activeModal === 'freeThrowCount' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-emerald-500 max-w-sm w-full modal-content">
          <h3 className="text-lg font-black mb-4 text-emerald-400 text-center">{t.howManyFT}</h3>
          <div className="flex gap-3 mb-3">
            {[1, 2, 3].map(n => (
              <button
                key={n}
                onClick={() => { setFreeThrowCount(n); setSelectedPoints(1); setActiveModal('freeThrowPlayer'); }}
                className="flex-1 min-h-[64px] bg-emerald-500 active:bg-emerald-400 rounded-xl font-black text-2xl flex items-center justify-center"
              >
                {n}
              </button>
            ))}
          </div>
          <button onClick={() => { setActiveModal(null); setFreeThrowCount(null); }} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.cancel}</button>
        </div>
      </div>
    )}

    {/* Free throw player selector — Step 2: Who's shooting? */}
    {activeModal === 'freeThrowPlayer' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-emerald-500 max-w-sm w-full modal-content">
          {!selectedScorePlayer ? (
            <>
              <h3 className="text-lg font-black mb-3 text-emerald-400 text-center">{t.whosShooting} ({freeThrowCount} FT)</h3>
              <div className="mb-3">
                <div className="text-xs font-bold text-orange-400 mb-1">{ourTeamName}</div>
                <div className="grid grid-cols-2 gap-2">
                  {onCourtPlayers.map(player => (
                    <button key={player.id} onClick={() => setSelectedScorePlayer({ id: player.id, name: player.name, number: player.number })} className="bg-orange-500 active:bg-orange-400 rounded-lg min-h-[48px] p-2 font-bold text-sm">
                      #{player.number} {player.name}
                    </button>
                  ))}
                </div>
              </div>
              <button onClick={() => { setActiveModal('freeThrowCount'); setSelectedScorePlayer(null); setSelectedPoints(null); }} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.back}</button>
            </>
          ) : (
            <>
              <h3 className="text-lg font-black mb-1 text-emerald-400 text-center">#{selectedScorePlayer.number} {selectedScorePlayer.name}</h3>
              <p className="text-center text-slate-400 text-sm mb-4">{t.howManyMade} ({freeThrowCount} FT)</p>
              <div className="flex gap-3 mb-3">
                {Array.from({ length: freeThrowCount + 1 }, (_, i) => i).map(n => (
                  <button
                    key={n}
                    onClick={() => addFreeThrows(selectedScorePlayer.id, n)}
                    className={`flex-1 min-h-[64px] rounded-xl font-black text-2xl flex items-center justify-center ${n === 0 ? 'bg-rose-500 active:bg-rose-400' : 'bg-emerald-500 active:bg-emerald-400'}`}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button onClick={() => setSelectedScorePlayer(null)} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.back}</button>
            </>
          )}
        </div>
      </div>
    )}

    {/* Replacement modal — when removing player with 5 on court */}
    {pendingReplacement && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-emerald-500 max-w-sm w-full modal-content">
          <h3 className="text-lg font-black mb-1 text-emerald-400 text-center">{t.whoComeIn}</h3>
          <p className="text-center text-slate-400 text-sm mb-3">#{pendingReplacement.outPlayer.number} {pendingReplacement.outPlayer.name} → OUT</p>
          <div className="grid grid-cols-2 gap-2 mb-3 max-h-[50vh] overflow-y-auto">
            {(() => {
              const outPos = pendingReplacement.outPlayer.position;
              const bench = players.filter(p => !p.onCourt && p.position !== 'Unselected' && p.fouls < 5);
              const samePos = bench.filter(p => p.position === outPos);
              const secondaryPos = bench.filter(p => p.position !== outPos && (p.secondary_positions || []).includes(outPos));
              const rest = bench.filter(p => p.position !== outPos && !(p.secondary_positions || []).includes(outPos));
              return [...samePos, ...secondaryPos, ...rest].map(player => (
                <button
                  key={player.id}
                  onClick={() => { toggleCourt(player.id); setPendingReplacement(null); }}
                  className={`rounded-lg min-h-[48px] p-2 font-bold text-sm active:opacity-80 ${player.position === outPos ? 'bg-emerald-500 active:bg-emerald-400' : (player.secondary_positions || []).includes(outPos) ? 'bg-blue-500 active:bg-blue-400' : 'bg-slate-600 active:bg-slate-500'}`}
                >
                  #{player.number} {player.name}
                  {player.position !== outPos && (player.secondary_positions || []).includes(outPos) && (
                    <span className="block text-xs text-blue-300">⚠️ {player.position}→{outPos}</span>
                  )}
                </button>
              ));
            })()}
          </div>
          <button onClick={() => setPendingReplacement(null)} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.skip}</button>
        </div>
      </div>
    )}

    {/* Reset modal */}
    {activeModal === 'reset' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-red-500 max-w-xs w-full modal-content">
          <h3 className="text-lg font-black mb-2 text-red-400 text-center">⚠️ {t.reset}</h3>
          <p className="text-center text-slate-300 mb-4">{t.resetAll}</p>
          <div className="flex gap-2">
            <button onClick={confirmReset} className="flex-1 min-h-[44px] bg-red-600 rounded-lg font-bold">{t.yes}</button>
            <button onClick={() => setActiveModal(null)} className="flex-1 min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.no}</button>
          </div>
        </div>
      </div>
    )}

    {/* Settings modal */}
    {activeModal === 'intervals' && (
      <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 modal-overlay">
        <div className="bg-slate-800 rounded-xl p-4 border-2 border-slate-500 max-w-xs w-full modal-content">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black">{t.configureStints}</h3>
            <button
              onClick={toggleLanguage}
              className="bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-lg text-sm font-bold"
            >
              {language === 'en' ? 'ES' : 'EN'}
            </button>
          </div>
          <div className="space-y-3 mb-4">
            <div>
              <div className="text-xs font-bold text-blue-400 mb-1">🏀 {t.onCourtConfig}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-emerald-400">{t.greenToYellow}</label>
                  <div className="flex gap-1">
                    <input type="number" min="0" max="10" value={intervals.green.minutes} onChange={(e) => setIntervals({...intervals, green: {...intervals.green, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                    <input type="number" min="0" max="59" value={intervals.green.seconds} onChange={(e) => setIntervals({...intervals, green: {...intervals.green, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                  </div>
                </div>
                <div>
                  <label className="text-amber-400">{t.yellowToRed}</label>
                  <div className="flex gap-1">
                    <input type="number" min="0" max="10" value={intervals.yellow.minutes} onChange={(e) => setIntervals({...intervals, yellow: {...intervals.yellow, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                    <input type="number" min="0" max="59" value={intervals.yellow.seconds} onChange={(e) => setIntervals({...intervals, yellow: {...intervals.yellow, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                  </div>
                </div>
              </div>
            </div>
            <div>
              <div className="text-xs font-bold text-slate-400 mb-1">💺 {t.benchConfig}</div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <label className="text-red-400">{t.redToYellow}</label>
                  <div className="flex gap-1">
                    <input type="number" min="0" max="10" value={benchIntervals.red.minutes} onChange={(e) => setBenchIntervals({...benchIntervals, red: {...benchIntervals.red, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                    <input type="number" min="0" max="59" value={benchIntervals.red.seconds} onChange={(e) => setBenchIntervals({...benchIntervals, red: {...benchIntervals.red, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                  </div>
                </div>
                <div>
                  <label className="text-amber-400">{t.yellowToGreen}</label>
                  <div className="flex gap-1">
                    <input type="number" min="0" max="10" value={benchIntervals.yellow.minutes} onChange={(e) => setBenchIntervals({...benchIntervals, yellow: {...benchIntervals.yellow, minutes: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                    <input type="number" min="0" max="59" value={benchIntervals.yellow.seconds} onChange={(e) => setBenchIntervals({...benchIntervals, yellow: {...benchIntervals.yellow, seconds: parseInt(e.target.value) || 0}})} className="w-full bg-slate-700 px-2 py-1 rounded" />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <button onClick={() => setActiveModal(null)} className="w-full min-h-[44px] bg-slate-600 rounded-lg font-bold">{t.close}</button>
        </div>
      </div>
    )}

    {/* ===== MAIN GAME LAYOUT ===== */}
    <div className="min-h-screen bg-slate-900 text-white">
      <div className="max-w-7xl mx-auto">

        {/* STICKY SCOREBOARD + CONTROLS */}
        <div className="sticky top-0 z-30 bg-slate-900 p-2 sm:p-3 pb-0">
          <div className="bg-slate-800 rounded-lg p-2 sm:p-3 border border-slate-700">
            {/* Score */}
            <div className="grid grid-cols-3 gap-2 mb-2">
              <div className={`${isHomeTeam ? `${homeColor.bgDark} ${homeColor.border}` : `${homeColor.bgDark}/50 ${homeColor.borderMuted}`} border-2 rounded-lg p-2 text-center`}>
                {editingTeam === 'home' ? (
                  <input type="text" defaultValue={homeTeam} onBlur={(e) => { setHomeTeam(e.target.value || t.home); setEditingTeam(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setHomeTeam(e.target.value || t.home); setEditingTeam(null); }}} className="bg-slate-900 px-2 py-1.5 rounded text-center font-bold text-white w-full text-sm" autoFocus />
                ) : (
                  <div className={`text-xs sm:text-sm ${homeColor.text} truncate cursor-pointer py-1`} onClick={() => setEditingTeam('home')}>{homeTeam}</div>
                )}
                {editingScore === 'home' ? (
                  <input type="number" min="0" defaultValue={homeScore} onBlur={(e) => { setHomeScore(parseInt(e.target.value) || 0); setEditingScore(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setHomeScore(parseInt(e.target.value) || 0); setEditingScore(null); }}} className="bg-slate-900 px-2 py-2 rounded text-center font-black text-white w-full text-3xl sm:text-4xl" autoFocus />
                ) : (
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black cursor-pointer" onClick={() => setEditingScore('home')}>{homeScore}</div>
                )}
              </div>
              <div className="flex flex-col items-center justify-center">
                <div onClick={() => setShowQuarterSelector(!showQuarterSelector)} className="text-sm font-bold text-orange-400 cursor-pointer">Q{currentQuarter}</div>
                {editingGameTime ? (
                  <div className="flex flex-col items-center gap-2">
                    <div className="flex items-center gap-1">
                      <input type="number" min="0" max="10" value={editGameTimeForm.minutes} onChange={(e) => setEditGameTimeForm({...editGameTimeForm, minutes: parseInt(e.target.value) || 0})} className="w-12 sm:w-14 bg-slate-900 px-2 py-2 rounded text-center font-black text-white text-lg" autoFocus />
                      <span className="font-black text-xl">:</span>
                      <input type="number" min="0" max="59" value={editGameTimeForm.seconds} onChange={(e) => setEditGameTimeForm({...editGameTimeForm, seconds: Math.min(59, parseInt(e.target.value) || 0)})} className="w-12 sm:w-14 bg-slate-900 px-2 py-2 rounded text-center font-black text-white text-lg" />
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => { setGameTime(Math.max(0, Math.min(600, (editGameTimeForm.minutes * 60) + editGameTimeForm.seconds))); setEditingGameTime(false); }} className="bg-emerald-600 px-4 py-2 rounded text-sm font-bold active:bg-emerald-500">✓</button>
                      <button onClick={() => setEditingGameTime(false)} className="bg-red-600 px-4 py-2 rounded text-sm font-bold active:bg-red-500">✗</button>
                    </div>
                  </div>
                ) : (
                  <div className="text-2xl sm:text-3xl font-black cursor-pointer" onClick={() => { setGameRunning(false); setEditGameTimeForm({ minutes: Math.floor(gameTime / 60), seconds: gameTime % 60 }); setEditingGameTime(true); }}>
                    {formatGameTime(gameTime)}
                  </div>
                )}
                {showQuarterSelector && (
                  <div className="absolute mt-16 bg-slate-800 rounded-lg shadow-xl z-20 p-1.5 flex gap-1.5">
                    {[1,2,3,4].map(q => (
                      <button key={q} onClick={() => {setCurrentQuarter(q); setShowQuarterSelector(false);}} className={`min-w-[44px] min-h-[44px] rounded-lg text-sm font-bold flex items-center justify-center ${currentQuarter === q ? 'bg-orange-600' : 'bg-slate-700'}`}>{q}</button>
                    ))}
                  </div>
                )}
              </div>
              <div className={`${!isHomeTeam ? `${awayColor.bgDark} ${awayColor.border}` : `${awayColor.bgDark}/50 ${awayColor.borderMuted}`} border-2 rounded-lg p-2 text-center`}>
                {editingTeam === 'away' ? (
                  <input type="text" defaultValue={awayTeam} onBlur={(e) => { setAwayTeam(e.target.value || t.away); setEditingTeam(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setAwayTeam(e.target.value || t.away); setEditingTeam(null); }}} className="bg-slate-900 px-2 py-1.5 rounded text-center font-bold text-white w-full text-sm" autoFocus />
                ) : (
                  <div className={`text-xs sm:text-sm ${awayColor.text} truncate cursor-pointer py-1`} onClick={() => setEditingTeam('away')}>{awayTeam}</div>
                )}
                {editingScore === 'away' ? (
                  <input type="number" min="0" defaultValue={awayScore} onBlur={(e) => { setAwayScore(parseInt(e.target.value) || 0); setEditingScore(null); }} onKeyDown={(e) => { if (e.key === 'Enter') { setAwayScore(parseInt(e.target.value) || 0); setEditingScore(null); }}} className="bg-slate-900 px-2 py-2 rounded text-center font-black text-white w-full text-3xl sm:text-4xl" autoFocus />
                ) : (
                  <div className="text-3xl sm:text-4xl md:text-5xl font-black cursor-pointer" onClick={() => setEditingScore('away')}>{awayScore}</div>
                )}
              </div>
            </div>

            {/* Action buttons -- partials moved below sticky */}

            {/* Action buttons */}
            <div className="flex gap-1.5">
              <div className="flex flex-col gap-1.5" style={{width: 'calc(33.33% - 3px)'}}>
                <button onClick={toggleGameRunning} className={`min-h-[72px] rounded-lg font-bold text-lg flex flex-col items-center justify-center gap-0.5 ${gameRunning ? 'bg-orange-600 active:bg-orange-500 animate-pulse' : 'bg-emerald-600 active:bg-emerald-500'}`}>
                  {gameRunning ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7" />}
                  <span className="text-xs">{gameRunning ? t.pause : t.play}</span>
                </button>
                <div className="flex items-center justify-center bg-slate-700 rounded-lg py-1.5">
                  <Users className="w-4 h-4 text-blue-400" />
                  <span className={`text-sm font-bold ml-1 ${onCourtCount === 5 ? 'text-emerald-400' : 'text-red-400'}`}>{onCourtCount}/5</span>
                </div>
              </div>
              <div className="flex-1 grid grid-cols-4 grid-rows-[3fr_2fr] md:grid-rows-[2fr_1fr] gap-1.5">
                <button onClick={() => { setSelectedPoints(3); setActiveModal('score'); setPendingReplacement(null); }} className="bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 active:bg-indigo-500/40 rounded-lg font-black text-sm flex items-center justify-center min-h-[56px]">{t.pts3}</button>
                <button onClick={() => { setSelectedPoints(2); setActiveModal('score'); setPendingReplacement(null); }} className="bg-blue-500/20 text-blue-300 border border-blue-500/30 active:bg-blue-500/40 rounded-lg font-black text-sm flex items-center justify-center min-h-[56px]">{t.pts2}</button>
                <button onClick={() => { setActiveModal('freeThrowCount'); setPendingReplacement(null); }} className="bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 active:bg-emerald-500/40 rounded-lg font-black text-sm flex items-center justify-center min-h-[56px]">{t.pts1}</button>
                <button onClick={() => { setActiveModal('foul'); setPendingReplacement(null); }} className="bg-amber-600 active:bg-amber-500 rounded-lg font-black text-lg flex items-center justify-center min-h-[56px]">
                  <Bell className="w-6 h-6" />
                </button>
                <button
                  onMouseDown={handleResetMouseDown}
                  onMouseUp={handleResetMouseUp}
                  onMouseLeave={handleResetMouseLeave}
                  onTouchStart={handleResetMouseDown}
                  onTouchEnd={handleResetMouseUp}
                  className={`min-h-[44px] rounded-lg font-bold text-sm flex items-center justify-center ${actionHistory.length > 0 ? 'bg-red-600' : 'bg-slate-600'}`}
                >
                  <Undo2 className="w-4 h-4" />
                </button>
                <button onClick={() => { setActiveModal('intervals'); setPendingReplacement(null); }} className="min-h-[44px] bg-slate-600 rounded-lg flex items-center justify-center">
                  <Settings className="w-4 h-4" />
                </button>
                <button onClick={generateReport} className="min-h-[44px] bg-blue-600 rounded-lg flex items-center justify-center">
                  <Download className="w-4 h-4" />
                </button>
                <button onClick={() => { setActiveModal('exit'); setPendingReplacement(null); }} className="min-h-[44px] bg-orange-600 rounded-lg flex items-center justify-center">
                  <XCircle className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* PARTIAL SCORES + COURT WARNING (outside sticky to reduce height) */}
        <div className="px-2 sm:px-3 pt-1">
          {/* Partial Scores */}
          {(() => {
            const partials = getCurrentPartialScores();
            const getPartialColor = (us, them) => {
              if (us === 0 && them === 0) return 'bg-slate-700 text-slate-400';
              if (us > them) return 'bg-emerald-700 text-emerald-100';
              if (us < them) return 'bg-red-700 text-red-100';
              return 'bg-orange-600 text-orange-100';
            };
            const currentHalf = gameTime > 300 ? 'first' : 'second';
            return (
              <div className="grid grid-cols-4 gap-1 mb-1">
                {[1, 2, 3, 4].map(q => {
                  const qPartials = partials[q];
                  const firstColor = getPartialColor(qPartials.first.us, qPartials.first.them);
                  const secondColor = getPartialColor(qPartials.second.us, qPartials.second.them);
                  const quarterUs = qPartials.first.us + qPartials.second.us;
                  const quarterThem = qPartials.first.them + qPartials.second.them;
                  const quarterColor = getPartialColor(quarterUs, quarterThem);
                  const isCurrentQ = q === currentQuarter;
                  const isFirstHalfCurrent = isCurrentQ && currentHalf === 'first';
                  const isSecondHalfCurrent = isCurrentQ && currentHalf === 'second';
                  return (
                    <div key={q} className="rounded p-1">
                      <div className="text-xs text-center text-slate-400 font-bold mb-0.5">Q{q}</div>
                      <div className="flex gap-0.5">
                        <div className={`flex-1 ${firstColor} rounded px-1 py-0.5 text-center ${isFirstHalfCurrent ? 'ring-2 ring-orange-400' : ''}`}>
                          <span className="text-xs font-bold">{qPartials.first.us}-{qPartials.first.them}</span>
                        </div>
                        <div className={`flex-1 ${secondColor} rounded px-1 py-0.5 text-center ${isSecondHalfCurrent ? 'ring-2 ring-orange-400' : ''}`}>
                          <span className="text-xs font-bold">{qPartials.second.us}-{qPartials.second.them}</span>
                        </div>
                      </div>
                      <div className={`${quarterColor} rounded px-1 py-0.5 text-center mt-0.5`}>
                        <span className="text-xs font-black">{quarterUs}-{quarterThem}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })()}

          {/* Court warning */}
          {courtWarning && (
            <div className="bg-red-600 text-white text-center py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-3 mb-1">
              <span>{courtWarning}</span>
              <button onClick={() => setCourtWarning(null)} className="bg-white text-red-600 px-3 py-0.5 rounded font-bold text-xs">{t.ok}</button>
            </div>
          )}

          {/* FOULS — collapsable, between partials and on court */}
          {hasFoulWarnings && (
            <div className="bg-slate-800 rounded-lg border border-slate-700 mt-1">
              <button
                onClick={() => setShowFouls(!showFouls)}
                className="w-full p-2 flex items-center justify-between"
              >
                <div className="font-bold text-xs text-amber-400 flex items-center gap-1.5">
                  <AlertTriangle className="w-3.5 h-3.5" />
                  <span>⚠️ {warningPlayers.length + dangerPlayers.length}</span>
                </div>
                {showFouls ? <ChevronUp className="w-3.5 h-3.5 text-slate-400" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-400" />}
              </button>
              {showFouls && (
                <div className="px-2 pb-2">
                  <div className="grid grid-cols-2 gap-2">
                    <div className="bg-amber-900/30 border border-amber-600 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <AlertTriangle className="w-3 h-3 text-amber-400" />
                        <span className="font-bold text-amber-400 text-xs">{t.warning}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {warningPlayers.map(p => (
                          <span key={p.id} className="text-xs font-semibold text-white bg-amber-800/60 px-2 py-0.5 rounded">
                            #{p.number} {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="bg-red-900/30 border border-red-600 rounded-lg p-2">
                      <div className="flex items-center gap-1 mb-1">
                        <XCircle className="w-3 h-3 text-red-400" />
                        <span className="font-bold text-red-400 text-xs">{t.danger}</span>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {dangerPlayers.map(p => (
                          <span key={p.id} className="text-xs font-semibold text-white bg-red-800/60 px-2 py-0.5 rounded">
                            #{p.number} {p.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* SCROLLABLE CONTENT */}
        <div className="p-2 sm:p-3 pt-2 space-y-2 sm:space-y-3">

          {/* ON COURT — with per-section expand toggle */}
          <div className="bg-blue-900/30 rounded-lg p-2 border border-blue-700">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <span className="bg-blue-600 px-2 py-0.5 rounded text-xs font-bold">{t.onCourt}</span>
                <span className="text-xs font-bold">{onCourtCount}/5</span>
              </div>
              <button
                onClick={() => setCourtExpanded(!courtExpanded)}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs font-bold min-h-[32px]"
              >
                {courtExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>
            {!courtExpanded ? (
              <div className="space-y-1">
                {onCourtPlayers.length === 0 ? (
                  <div className="text-center py-4 text-slate-500 text-sm">{t.select5Players}</div>
                ) : (
                  onCourtPlayers.map(p => renderPlayerCard(p, false, courtExpanded))
                )}
              </div>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                {onCourtPlayers.length === 0 ? (
                  <div className="col-span-3 sm:col-span-4 text-center py-4 text-slate-500 text-sm">{t.select5Players}</div>
                ) : (
                  onCourtPlayers.map(p => renderPlayerCard(p, false, courtExpanded))
                )}
              </div>
            )}
          </div>

          {/* SUB RECOMMENDATIONS — per-player cross-position expand */}
          {subRecommendations.length > 0 && (() => {
            const renderSuggestionBtn = (s, outId) => {
              const benchStatus = getBenchTimeStatus(s);
              const statusColor = benchStatus === 'green'
                ? 'bg-emerald-600 border-emerald-400 hover:bg-emerald-500'
                : benchStatus === 'yellow'
                ? 'bg-amber-600 border-amber-400 hover:bg-amber-500'
                : 'bg-red-600 border-red-400 hover:bg-red-500';
              return (
                <button
                  key={s.id}
                  onClick={() => executeSub(outId, s.id)}
                  className={`text-xs font-bold text-white ${s.isPlayingOutOfPosition ? 'bg-purple-600 border-purple-400 hover:bg-purple-500' : statusColor} border px-2 py-1 rounded cursor-pointer transition-colors active:opacity-80`}
                >
                  #{s.number} {s.name} ({formatTime(s.currentMinutes)} | {s.fouls}F)
                  {s.isPlayingOutOfPosition && <span className="ml-1 text-amber-300">⚠️ {s.originalPosition}→{s.playingAs}</span>}
                </button>
              );
            };
            return (
              <div className="bg-slate-800 rounded-lg p-2 sm:p-3 border border-orange-700">
                <h3 className="font-black text-sm mb-2 text-orange-400 flex items-center gap-2">
                  <RefreshCw className="w-4 h-4" />{t.subRecommendations}
                </h3>
                <div className="space-y-1.5">
                  {subRecommendations.map((rec, idx) => (
                    <div key={idx} className={`${rec.isFoulIssue ? 'bg-orange-900/30 border-orange-600' : 'bg-slate-700/50 border-slate-600'} border rounded-lg p-2`}>
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-red-400 font-black text-xs">⬇</span>
                        <span className="text-xs font-black text-white">#{rec.out.number} {rec.out.name}</span>
                        <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${rec.isFoulIssue ? 'bg-orange-600 text-white' : 'bg-slate-600 text-white'}`}>
                          {renderReason(rec.reason)}
                        </span>
                        <span className="text-emerald-400 font-black text-xs ml-1">⬆ {t.subIn}</span>
                        {rec.samePositionSuggestions.map(s => renderSuggestionBtn(s, rec.out.id))}
                        {rec.samePositionSuggestions.length === 0 && rec.crossPositionSuggestions.length === 0 && (
                          <span className="text-xs text-slate-400">{t.noPlayersAvailable}</span>
                        )}
                        {rec.crossPositionSuggestions.length > 0 && (
                          <button
                            onClick={() => setExpandedCrossPosition(prev => ({ ...prev, [rec.out.id]: !prev[rec.out.id] }))}
                            className="text-xs font-bold text-purple-400 bg-purple-600/30 border border-purple-500 px-1.5 py-0.5 rounded hover:bg-purple-600/50 min-h-[24px]"
                          >
                            {expandedCrossPosition[rec.out.id] ? '▲' : '▼'} {rec.crossPositionSuggestions.length}
                          </button>
                        )}
                      </div>
                      {rec.crossPositionSuggestions.length > 0 && expandedCrossPosition[rec.out.id] && (
                        <div className="flex flex-wrap gap-1.5 mt-1.5 pl-4">
                          {rec.crossPositionSuggestions.map(s => renderSuggestionBtn(s, rec.out.id))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          {/* BENCH */}
          <div className="bg-slate-800/50 rounded-lg p-2 border border-slate-700">
            <div className="flex items-center justify-between mb-2">
              <span className="bg-slate-600 px-2 py-0.5 rounded text-xs font-bold">{t.bench}</span>
              <button
                onClick={() => setBenchExpanded(!benchExpanded)}
                className="flex items-center gap-1 bg-slate-700 hover:bg-slate-600 px-2 py-1 rounded text-xs font-bold min-h-[32px]"
              >
                {benchExpanded ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              </button>
            </div>

            {/* Dynamic position groups */}
            {teamPositions.map(pos => {
              const posPlayers = benchPlayersByPosition[pos];
              if (!posPlayers || posPlayers.length === 0) return null;
              return (
                <div key={pos} className="mb-2">
                  <div className="text-xs font-bold text-blue-400 mb-1">{pos}</div>
                  {!benchExpanded ? (
                    <div className="space-y-1">
                      {posPlayers.map(p => renderPlayerCard(p, true, benchExpanded))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                      {posPlayers.map(p => renderPlayerCard(p, true, benchExpanded))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned */}
            {benchPlayersByPosition.__unselected.length > 0 && (
              <div>
                <div className="text-xs font-bold text-slate-400 mb-1">{t.inactive}</div>
                {!benchExpanded ? (
                  <div className="space-y-1">
                    {benchPlayersByPosition.__unselected.map(p => renderPlayerCard(p, true, benchExpanded))}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
                    {benchPlayersByPosition.__unselected.map(p => renderPlayerCard(p, true, benchExpanded))}
                  </div>
                )}
              </div>
            )}
          </div>


        </div>
      </div>
    </div>
    </>
  );
}
