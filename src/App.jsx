import React, { useState, useCallback, useEffect } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TeamProvider, useTeam } from './context/TeamContext';
import { LanguageProvider, useTranslation } from './context/LanguageContext';
import Auth from './components/Auth';
import TeamsList from './components/TeamsList';
import TeamDetail from './components/TeamDetail';
import BasketballRotationTracker from './BasketballRotationTracker';

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }
  static getDerivedStateFromError() {
    return { hasError: true };
  }
  componentDidCatch(error, info) {
    console.error('App error:', error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-white mb-4">Something went wrong</h1>
            <p className="text-slate-400 mb-6">An unexpected error occurred.</p>
            <button
              onClick={() => { this.setState({ hasError: false }); window.location.reload(); }}
              className="bg-emerald-600 text-white px-6 py-3 rounded-lg"
            >
              Reload App
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { currentTeam, teamPlayers, saveGame, refreshCurrentTeam, selectTeam, deselectTeam } = useTeam();
  const { t } = useTranslation();
  const [activeGame, setActiveGame] = useState(null); // null = no game, object = playing

  // State to show exit confirmation when pressing back during a game
  const [showExitConfirm, setShowExitConfirm] = useState(false);

  // ============================================
  // HISTORY API — push/pop state for native back navigation
  // ============================================
  const getCurrentScreen = useCallback(() => {
    if (activeGame) return 'game';
    if (currentTeam) return 'teamDetail';
    return 'teams';
  }, [activeGame, currentTeam]);

  // Push state when screen changes
  useEffect(() => {
    const screen = getCurrentScreen();
    // Only push if the current history state doesn't match
    const currentState = window.history.state?.screen;
    if (currentState !== screen) {
      window.history.pushState({ screen, teamId: currentTeam?.id }, '');
    }
  }, [getCurrentScreen, currentTeam]);

  // Listen for popstate (back button / back gesture)
  useEffect(() => {
    const handlePopState = (e) => {
      const state = e.state;

      // If we're in a game, show exit confirmation instead of navigating
      if (activeGame) {
        // Push state back so the user stays on the page
        window.history.pushState({ screen: 'game', teamId: currentTeam?.id }, '');
        setShowExitConfirm(true);
        return;
      }

      // If we're in team detail, go back to teams list
      if (currentTeam && !activeGame) {
        deselectTeam();
        return;
      }

      // If we're already at teams list, push state to prevent leaving the app
      window.history.pushState({ screen: 'teams' }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [activeGame, currentTeam, deselectTeam]);

  // Convertir jugadores del roster de Supabase al formato que espera el tracker
  const getPlayersForTracker = useCallback(() => {
    if (!teamPlayers || teamPlayers.length === 0) return null;
    return teamPlayers.map((p) => ({
      id: p.id,
      name: p.name,
      number: p.number || '0',
      position: p.position || 'Unselected',
      secondary_positions: p.secondary_positions || []
    }));
  }, [teamPlayers]);

  // Iniciar un nuevo partido
  const handleStartGame = useCallback(() => {
    setActiveGame({ type: 'new' });
  }, []);

  // Continuar un partido existente
  const handleContinueGame = useCallback((game) => {
    // game_data contiene todo el estado del partido guardado en Supabase
    const gameData = game.game_data || {};
    setActiveGame({
      type: 'continue',
      savedData: {
        ...gameData,
        id: game.id,
        gameStarted: gameData.gameStarted ?? true,
        isHomeTeam: gameData.isHomeTeam ?? game.is_home_team,
        homeTeam: gameData.homeTeam || game.home_team || 'Home',
        awayTeam: gameData.awayTeam || game.away_team || 'Away',
        homeScore: gameData.homeScore ?? game.home_score ?? 0,
        awayScore: gameData.awayScore ?? game.away_score ?? 0,
        currentQuarter: gameData.currentQuarter ?? game.current_quarter ?? 1,
        status: game.status
      }
    });
  }, []);

  // Salir del partido y volver al detalle del equipo
  const handleExitGame = useCallback(() => {
    setActiveGame(null);
    refreshCurrentTeam();
  }, [refreshCurrentTeam]);

  // Guardar partido en Supabase
  const handleGameSaved = useCallback(async (gameState) => {
    if (!currentTeam) return;
    await saveGame(gameState);
  }, [currentTeam, saveGame]);

  // Pantalla de carga
  if (authLoading) {
    return (
      <div className="min-h-screen bg-slate-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p>{t.loading}</p>
        </div>
      </div>
    );
  }

  // Si no hay sesion -> Login/Registro
  if (!user) {
    return <Auth />;
  }

  // Si hay partido activo -> Tracker
  if (activeGame) {
    return (
      <BasketballRotationTracker
        key={activeGame.savedData?.id || 'new'}
        initialPlayers={getPlayersForTracker()}
        savedGameData={activeGame.type === 'continue' ? activeGame.savedData : null}
        onExit={handleExitGame}
        onGameSaved={handleGameSaved}
        teamId={currentTeam?.id}
        userId={user?.id}
        showExitConfirm={showExitConfirm}
        onDismissExitConfirm={() => setShowExitConfirm(false)}
      />
    );
  }

  // Si hay equipo seleccionado -> Detalle del equipo
  if (currentTeam) {
    return (
      <TeamDetail
        onStartGame={handleStartGame}
        onContinueGame={handleContinueGame}
      />
    );
  }

  // Si no -> Lista de equipos
  return <TeamsList />;
}

function App() {
  return (
    <ErrorBoundary>
      <AuthProvider>
        <LanguageProvider>
          <TeamProvider>
            <AppContent />
          </TeamProvider>
        </LanguageProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
