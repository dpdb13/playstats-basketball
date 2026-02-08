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
    save: 'Save',
    delete: 'Delete',

    // Team selection (pre-game)
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
    pts3: '3 PTS',
    pts2: '2 PTS',
    pts1: '1 PT',
    made: 'MADE',
    missed: 'MISSED',

    // Recommendations
    subRecommendations: 'SUB RECOMMENDATIONS',
    subOut: 'SUB OUT',
    subIn: 'SUB IN:',
    noPlayersAvailable: 'No players available at this position without foul trouble',
    noRecommendations: 'No substitution recommendations right now',
    rest: 'REST',
    consecutive: 'straight',
    crossPositionOptions: 'Cross-position options',

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

    // Replacement modal
    whoComeIn: 'Who comes in?',
    skip: 'SKIP',

    // Position editor
    editPositions: 'Edit Positions',
    addPosition: 'Add Position',
    positionsUpdated: 'Positions updated',
    positionName: 'Position name',

    // TeamsList
    myTeams: 'My Teams',
    loadingTeams: 'Loading teams...',
    noTeamsYet: 'No teams yet',
    createFirstTeam: 'Create your first team to get started',
    teamName: 'Team name',
    teamNamePlaceholder: 'e.g. Panthers U12',
    creating: 'Creating...',
    create: 'Create',
    createTeam: 'Create Team',
    owner: 'Owner',
    member: 'Member',
    signOut: 'Sign out',
    inviteCode: 'Invalid invite code',
    errorJoining: 'Error joining team',
    joinedSuccessfully: 'Joined the team successfully',
    teamInvitation: 'Team invitation',
    searchingTeam: 'Searching team...',
    youveBeenInvited: "You've been invited to this team",
    joinTeam: 'Join team',
    joining: 'Joining...',
    errorCreating: 'Error creating team',

    // TeamDetail
    newGameBtn: 'NEW GAME',
    games: 'Games',
    roster: 'Roster',
    noGamesYet: 'No games yet',
    tapNewGame: 'Tap "New Game" to get started',
    inProgress: 'In progress',
    continue: 'Continue',
    completed: 'Completed',
    victory: 'Victory',
    defeat: 'Defeat',
    draw: 'Draw',
    view: 'View',
    resume: 'Resume Game',
    deleteTeamTitle: 'Delete team',
    deleteTeamMsg: (name) => `All games and data for ${name} will be deleted. This action cannot be undone.`,
    yesDelete: 'Yes, delete',
    deleteGameTitle: 'Delete game',
    deleteGameMsg: 'This game will be permanently deleted. This action cannot be undone.',
    changeIcon: 'Change icon',
    tapToEdit: 'Tap to edit',
    writeEmoji: 'Write an emoji',
    quickEmojis: 'Quick emojis',
    uploadPhoto: 'Upload a photo',
    uploading: 'Uploading...',
    choosePhoto: 'Choose photo',

    // PlayerRosterEditor
    canPlayAs: 'Can play as:',
    unselected: 'Inactive',
    addPlayer: 'Add player',
    add: 'Add',
    deletePlayerConfirm: 'Delete this player?',

    // Auth
    resetEmailSent: "We've sent you a password reset email",
    accountCreated: 'Account created successfully',
    wrongCredentials: 'Wrong email or password',
    emailRegistered: 'This email is already registered',
    passwordMinLength: 'Password must be at least 6 characters',
    invalidEmail: 'Invalid email',
    resetPassword: 'Reset Password',
    sending: 'Sending...',
    sendRecoveryEmail: 'Send recovery email',
    backToLogin: 'Back to login',
    signIn: 'Sign In',
    signUp: 'Sign Up',
    emailLabel: 'Email',
    passwordLabel: 'Password',
    minSixChars: 'Minimum 6 characters',
    enter: 'Sign In',
    createAccount: 'Create Account',
    forgotPassword: 'Forgot my password',
    unexpectedError: 'Unexpected error. Try again.',
    orText: 'or',

    // ShareTeamModal
    shareTeam: 'Share Team',
    shareTeamDesc: 'Share this link so others can join',
    copied: 'Copied!',
    copyLink: 'Copy link',
    generateNewCode: 'Generate new code',

    // ImageCropper
    adjustImage: 'Adjust Image',
    fit: 'Fit',
    fill: 'Fill',
    resetImage: 'Reset',
    cancelBtn: 'Cancel',
    processing: 'Processing...',

    // Scoring flow
    whosShooting: "Who's shooting?",
    freeThrows: 'Free throws',
    howManyFT: 'How many free throws?',
    howManyMade: 'How many made?',

    // Player card (extra)
    stint: 'STINT',
    court: 'COURT',
    benchLabel: 'BENCH',
    shotBreakdown: 'Shots',
    minutesPlayed: 'Min played',
    doubleTapToEdit: 'Double-tap name to edit',
    ptsLabel: 'PTS',
    missedLabel: 'MISSED',
    eff: 'EFF',

    // Game management
    phase: 'Phase',
    matchday: 'Matchday',
    editGame: 'Edit Game',
    dateAndTime: 'Date & Time',
    phasePlaceholder: 'Groups, Playoffs...',
    saveChanges: 'Save changes',
    inProgressGames: 'In Progress',
    completedGames: 'Completed',
    noInProgressGames: 'No games in progress',
    noCompletedGames: 'No completed games yet',

    // Sub recommendations (extra)
    moreOptions: 'Options',

    // Defaults
    homeDefault: 'Home',
    awayDefault: 'Away',
    unassigned: 'UNASSIGNED',
    dragToMove: 'Drag to move. Use slider to zoom.',

    // Color picker
    selectColor: 'Select your team color',
    selectRivalColor: 'Select rival color',
    rivalName: 'Rival name (optional)',
    startGame: 'START GAME',
    step: 'Step',

    // Shot stats
    threePt: '3PT',
    twoPt: '2PT',
    onePt: '1PT',
    foulsLabel: 'FOULS',

    // Rival scoring
    rivalMadeOrMissed: 'Made or missed?',

    // Color names
    colorRed: 'Red',
    colorBlue: 'Blue',
    colorGreen: 'Green',
    colorPurple: 'Purple',
    colorOrange: 'Orange',
    colorPink: 'Pink',
    colorYellow: 'Yellow',
    colorBlack: 'Black',
    colorWhite: 'White',
    colorGray: 'Gray',
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
    save: 'Guardar',
    delete: 'Eliminar',

    // Team selection (pre-game)
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
    pts3: '3 PTS',
    pts2: '2 PTS',
    pts1: '1 PT',
    made: 'ANOTÓ',
    missed: 'FALLÓ',

    // Recommendations
    subRecommendations: 'RECOMENDACIONES',
    subOut: 'SACAR',
    subIn: 'METER:',
    noPlayersAvailable: 'No hay jugadores disponibles en esta posición sin problemas de faltas',
    noRecommendations: 'Sin recomendaciones de cambio',
    rest: 'DESCANSO',
    consecutive: 'seguidos',
    crossPositionOptions: 'Opciones cambiando posición',

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

    // Replacement modal
    whoComeIn: '¿Quién entra?',
    skip: 'SALTAR',

    // Position editor
    editPositions: 'Editar Posiciones',
    addPosition: 'Añadir Posición',
    positionsUpdated: 'Posiciones actualizadas',
    positionName: 'Nombre de posición',

    // TeamsList
    myTeams: 'Mis Equipos',
    loadingTeams: 'Cargando equipos...',
    noTeamsYet: 'No tienes equipos todavía',
    createFirstTeam: 'Crea tu primer equipo para empezar',
    teamName: 'Nombre del equipo',
    teamNamePlaceholder: 'Ej: Panteras Alevín',
    creating: 'Creando...',
    create: 'Crear',
    createTeam: 'Crear Equipo',
    owner: 'Creador',
    member: 'Miembro',
    signOut: 'Cerrar sesión',
    inviteCode: 'Código de invitación no válido',
    errorJoining: 'Error al unirse',
    joinedSuccessfully: 'Te has unido al equipo correctamente',
    teamInvitation: 'Invitación a equipo',
    searchingTeam: 'Buscando equipo...',
    youveBeenInvited: 'Te han invitado a este equipo',
    joinTeam: 'Unirme al equipo',
    joining: 'Uniendo...',
    errorCreating: 'Error creando equipo',

    // TeamDetail
    newGameBtn: 'NUEVO PARTIDO',
    games: 'Partidos',
    roster: 'Plantilla',
    noGamesYet: 'No hay partidos todavía',
    tapNewGame: 'Pulsa "Nuevo Partido" para empezar',
    inProgress: 'En proceso',
    continue: 'Continuar',
    completed: 'Finalizados',
    victory: 'Victoria',
    defeat: 'Derrota',
    draw: 'Empate',
    view: 'Visualizar',
    resume: 'Reanudar partido',
    deleteTeamTitle: 'Eliminar equipo',
    deleteTeamMsg: (name) => `Se eliminarán todos los partidos y datos del equipo ${name}. Esta acción no se puede deshacer.`,
    yesDelete: 'Sí, eliminar',
    deleteGameTitle: 'Eliminar partido',
    deleteGameMsg: 'Este partido se eliminará permanentemente. Esta acción no se puede deshacer.',
    changeIcon: 'Cambiar icono',
    tapToEdit: 'Pincha para editar',
    writeEmoji: 'Escribir un emoji',
    quickEmojis: 'Emojis rápidos',
    uploadPhoto: 'Subir una foto',
    uploading: 'Subiendo...',
    choosePhoto: 'Elegir foto',

    // PlayerRosterEditor
    canPlayAs: 'Puede jugar de:',
    unselected: 'No conv.',
    addPlayer: 'Añadir jugador',
    add: 'Añadir',
    deletePlayerConfirm: '¿Eliminar este jugador?',

    // Auth
    resetEmailSent: 'Te hemos enviado un email para restablecer tu contraseña',
    accountCreated: 'Cuenta creada correctamente',
    wrongCredentials: 'Email o contraseña incorrectos',
    emailRegistered: 'Este email ya está registrado',
    passwordMinLength: 'La contraseña debe tener al menos 6 caracteres',
    invalidEmail: 'Email no válido',
    resetPassword: 'Restablecer contraseña',
    sending: 'Enviando...',
    sendRecoveryEmail: 'Enviar email de recuperación',
    backToLogin: 'Volver al login',
    signIn: 'Iniciar Sesión',
    signUp: 'Registrarse',
    emailLabel: 'Email',
    passwordLabel: 'Contraseña',
    minSixChars: 'Mínimo 6 caracteres',
    enter: 'Entrar',
    createAccount: 'Crear cuenta',
    forgotPassword: 'He olvidado mi contraseña',
    unexpectedError: 'Error inesperado. Inténtalo de nuevo.',
    orText: 'o',

    // ShareTeamModal
    shareTeam: 'Compartir equipo',
    shareTeamDesc: 'Comparte este enlace para que otros se unan a',
    copied: '¡Copiado!',
    copyLink: 'Copiar enlace',
    generateNewCode: 'Generar nuevo código',

    // ImageCropper
    adjustImage: 'Ajustar imagen',
    fit: 'Encajar',
    fill: 'Rellenar',
    resetImage: 'Reset',
    cancelBtn: 'Cancelar',
    processing: 'Procesando...',

    // Scoring flow
    whosShooting: '¿Quién tira?',
    freeThrows: 'Tiros libres',
    howManyFT: '¿Cuántos tiros libres?',
    howManyMade: '¿Cuántos metió?',

    // Player card (extra)
    stint: 'STINT',
    court: 'PISTA',
    benchLabel: 'BANQ.',
    shotBreakdown: 'Tiros',
    minutesPlayed: 'Min jugados',
    doubleTapToEdit: 'Doble toque en nombre para editar',
    ptsLabel: 'PTS',
    missedLabel: 'FALL.',
    eff: 'EFI',

    // Game management
    phase: 'Fase',
    matchday: 'Jornada',
    editGame: 'Editar partido',
    dateAndTime: 'Fecha y hora',
    phasePlaceholder: 'Grupos, Playoffs...',
    saveChanges: 'Guardar cambios',
    inProgressGames: 'En curso',
    completedGames: 'Finalizados',
    noInProgressGames: 'No hay partidos en curso',
    noCompletedGames: 'No hay partidos finalizados',

    // Sub recommendations (extra)
    moreOptions: 'Opciones',

    // Defaults
    homeDefault: 'Local',
    awayDefault: 'Visitante',
    unassigned: 'SIN ASIGNAR',
    dragToMove: 'Arrastra para mover. Usa el slider para hacer zoom.',

    // Color picker
    selectColor: 'Elige el color de tu equipo',
    selectRivalColor: 'Elige el color del rival',
    rivalName: 'Nombre del rival (opcional)',
    startGame: 'EMPEZAR PARTIDO',
    step: 'Paso',

    // Shot stats
    threePt: '3PT',
    twoPt: '2PT',
    onePt: '1PT',
    foulsLabel: 'FALTAS',

    // Rival scoring
    rivalMadeOrMissed: '¿Metió o falló?',

    // Color names
    colorRed: 'Rojo',
    colorBlue: 'Azul',
    colorGreen: 'Verde',
    colorPurple: 'Morado',
    colorOrange: 'Naranja',
    colorPink: 'Rosa',
    colorYellow: 'Amarillo',
    colorBlack: 'Negro',
    colorWhite: 'Blanco',
    colorGray: 'Gris',
  }
};
