// ============================================
// TRADUCCIONES EN/ES
// ============================================

export const translations = {
  en: {
    // General
    loading: 'Loading...',
    back: '← Back',
    cancel: 'CANCEL',
    close: 'CLOSE',
    yes: 'YES',
    no: 'NO',
    ok: 'OK',

    // Team selection
    newGame: 'New Game',
    teamPlaysAs: 'Your team plays as...',
    home: 'HOME',
    away: 'AWAY',

    // Scoreboard
    play: 'PLAY',
    pause: 'PAUSE',

    // Sections
    onCourt: 'ON COURT',
    bench: 'BENCH',
    bases: 'GUARDS',
    aleros: 'WINGS',
    jokers: 'FLEX',
    inactive: 'INACTIVE',
    select5Players: 'Select 5 players to start',

    // Fouls
    fouls: 'FOULS',
    warning: 'WARNING',
    danger: 'DANGER',
    fouledOut: 'FOULED OUT',
    whoFouled: 'Who committed the foul?',

    // Scoring
    whoScored: (pts) => `Who scored ${pts}?`,

    // Recommendations
    subRecommendations: 'SUB RECOMMENDATIONS',
    subOut: 'SUB OUT',
    subIn: 'SUB IN:',
    noPlayersAvailable: 'No players available at this position without foul trouble',
    noRecommendations: 'No substitution recommendations right now',
    rest: 'REST',
    consecutive: 'straight',

    // Recommendation reasons
    foulsDanger: (fouls, quarter) => `FOULS (${fouls}/5 in Q${quarter})`,
    foulsWarning: (fouls, quarter) => `Fouls (${fouls}/5 in Q${quarter})`,
    restReason: (time) => `REST (${time} straight)`,

    // Exit modal
    whatToDo: 'What would you like to do?',
    saveAndExit: 'SAVE & EXIT',
    canContinueLater: 'You can continue later',
    finishGame: 'FINISH GAME',
    savedToHistory: 'Saved to game history',

    // Reset
    reset: 'RESET',
    resetAll: 'Reset everything?',

    // Settings
    configureStints: 'Configure Stints',
    onCourtConfig: 'ON COURT',
    benchConfig: 'BENCH',
    greenToYellow: 'Green → Yellow',
    yellowToRed: 'Yellow → Red',
    redToYellow: 'Red → Yellow',
    yellowToGreen: 'Yellow → Green',

    // PlayerCard
    name: 'Name',
    pts: 'pts',
    out: 'OUT',
    inBtn: 'IN',
    outBtn: 'OUT',
    na: 'N/A',

    // Warnings
    playersNeeded: (count) => `Need ${count} more player${count !== 1 ? 's' : ''} on court`,

    // Compact/Expanded toggle
    compact: 'Compact',
    expanded: 'Expanded',
  },

  es: {
    // General
    loading: 'Cargando...',
    back: '← Volver',
    cancel: 'CANCELAR',
    close: 'CERRAR',
    yes: 'SÍ',
    no: 'NO',
    ok: 'OK',

    // Team selection
    newGame: 'Nuevo Partido',
    teamPlaysAs: 'Tu equipo juega de...',
    home: 'LOCAL',
    away: 'VISITANTE',

    // Scoreboard
    play: 'PLAY',
    pause: 'PAUSE',

    // Sections
    onCourt: 'EN PISTA',
    bench: 'BANQUILLO',
    bases: 'BASES',
    aleros: 'ALEROS',
    jokers: 'JOKER',
    inactive: 'NO CONV.',
    select5Players: 'Selecciona 5 jugadores',

    // Fouls
    fouls: 'FALTAS',
    warning: 'WARNING',
    danger: 'DANGER',
    fouledOut: 'ELIMINADO',
    whoFouled: '¿Quién hizo falta?',

    // Scoring
    whoScored: (pts) => `¿Quién anotó ${pts}?`,

    // Recommendations
    subRecommendations: 'RECOMENDACIONES',
    subOut: 'SACAR',
    subIn: 'METER:',
    noPlayersAvailable: 'No hay jugadores disponibles en esta posición sin problemas de faltas',
    noRecommendations: 'Sin recomendaciones de cambio',
    rest: 'DESCANSO',
    consecutive: 'seguidos',

    // Recommendation reasons
    foulsDanger: (fouls, quarter) => `FALTAS (${fouls}/5 en Q${quarter})`,
    foulsWarning: (fouls, quarter) => `Faltas (${fouls}/5 en Q${quarter})`,
    restReason: (time) => `DESCANSO (${time} seguidos)`,

    // Exit modal
    whatToDo: '¿Qué quieres hacer?',
    saveAndExit: 'GUARDAR Y SALIR',
    canContinueLater: 'Podrás continuar después',
    finishGame: 'FINALIZAR PARTIDO',
    savedToHistory: 'Se guarda en el historial',

    // Reset
    reset: 'RESET',
    resetAll: '¿Resetear todo?',

    // Settings
    configureStints: 'Configurar Stints',
    onCourtConfig: 'EN PISTA',
    benchConfig: 'BANQUILLO',
    greenToYellow: 'Verde → Amarillo',
    yellowToRed: 'Amarillo → Rojo',
    redToYellow: 'Rojo → Amarillo',
    yellowToGreen: 'Amarillo → Verde',

    // PlayerCard
    name: 'Nombre',
    pts: 'pts',
    out: 'OUT',
    inBtn: 'IN',
    outBtn: 'OUT',
    na: 'N/A',

    // Warnings
    playersNeeded: (count) => `Faltan ${count} jugador${count !== 1 ? 'es' : ''} en pista`,

    // Compact/Expanded toggle
    compact: 'Compacto',
    expanded: 'Expandido',
  }
};
