import { useState, useCallback } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TeamProvider, useTeam } from './context/TeamContext';
import Auth from './components/Auth';
import TeamsList from './components/TeamsList';
import TeamDetail from './components/TeamDetail';
import BasketballRotationTracker from './BasketballRotationTracker';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const { currentTeam, teamPlayers, saveGame, refreshCurrentTeam } = useTeam();
  const [activeGame, setActiveGame] = useState(null); // null = no game, object = playing

  // Convertir jugadores del roster de Supabase al formato que espera el tracker
  const getPlayersForTracker = useCallback(() => {
    if (!teamPlayers || teamPlayers.length === 0) return null;
    return teamPlayers.map((p, index) => ({
      id: index + 1,
      name: p.name,
      number: p.number || '0',
      position: p.position || 'Unselected'
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
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500 mx-auto mb-4"></div>
          <p>Cargando...</p>
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
    <AuthProvider>
      <TeamProvider>
        <AppContent />
      </TeamProvider>
    </AuthProvider>
  );
}

export default App;
