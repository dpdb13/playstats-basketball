import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  getCachedTeams, setCachedTeams,
  getCachedPlayers, setCachedPlayers,
  getCachedGames, setCachedGames,
  addToQueue, processQueue, startSyncListener, isOnline
} from '../lib/syncManager';

const TeamContext = createContext({});

const DEFAULT_PLAYERS = [
  { name: 'Player 1', number: '1', position: 'Base' },
  { name: 'Player 2', number: '2', position: 'Base' },
  { name: 'Player 3', number: '3', position: 'Base' },
  { name: 'Player 4', number: '4', position: 'Base' },
  { name: 'Player 5', number: '5', position: 'Base' },
  { name: 'Player 6', number: '6', position: 'Alero' },
  { name: 'Player 7', number: '7', position: 'Alero' },
  { name: 'Player 8', number: '8', position: 'Alero' },
  { name: 'Player 9', number: '9', position: 'Joker' },
  { name: 'Player 10', number: '10', position: 'Joker' },
  { name: 'Player 11', number: '11', position: 'Joker' },
  { name: 'Player 12', number: '0', position: 'Unselected' },
];

export function TeamProvider({ children }) {
  const { user } = useAuth();
  const [teams, setTeams] = useState([]);
  const [currentTeam, setCurrentTeam] = useState(null);
  const [teamPlayers, setTeamPlayers] = useState([]);
  const [teamGames, setTeamGames] = useState([]);
  const [loading, setLoading] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const realtimeChannel = useRef(null);

  // Detectar online/offline
  useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Iniciar listener de sincronizacion
  useEffect(() => {
    const cleanup = startSyncListener();
    return cleanup;
  }, []);

  // Cargar equipos del usuario
  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (isOnline()) {
        const { data, error } = await supabase
          .from('team_members')
          .select('team_id, role, teams(id, name, icon, invite_code, created_by, team_settings)')
          .eq('user_id', user.id);

        if (error) throw error;

        const teamsData = (data || []).map(tm => ({
          ...tm.teams,
          role: tm.role
        }));
        setTeams(teamsData);
        setCachedTeams(teamsData);
      } else {
        setTeams(getCachedTeams());
      }
    } catch (err) {
      console.error('Error cargando equipos:', err);
      setTeams(getCachedTeams());
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    loadTeams();
  }, [loadTeams]);

  // Crear equipo
  const createTeam = useCallback(async (name, icon = '🏀') => {
    if (!user) return null;

    try {
      const { data: team, error: teamError } = await supabase
        .from('teams')
        .insert({ name, icon, created_by: user.id })
        .select()
        .single();

      if (teamError) throw teamError;

      // Anadir al creador como owner
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: team.id, user_id: user.id, role: 'owner' });

      if (memberError) throw memberError;

      // Crear jugadores por defecto
      const playersToInsert = DEFAULT_PLAYERS.map((p, i) => ({
        team_id: team.id,
        name: p.name,
        number: p.number,
        position: p.position,
        sort_order: i
      }));

      await supabase.from('team_players').insert(playersToInsert);

      await loadTeams();
      return team;
    } catch (err) {
      console.error('Error creando equipo:', err);
      throw err;
    }
  }, [user, loadTeams]);

  // Seleccionar equipo
  const selectTeam = useCallback(async (team) => {
    setCurrentTeam(team);
    setLoading(true);

    // Limpiar suscripcion Realtime anterior
    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
      realtimeChannel.current = null;
    }

    try {
      if (isOnline()) {
        // Cargar jugadores
        const { data: players, error: playersError } = await supabase
          .from('team_players')
          .select('*')
          .eq('team_id', team.id)
          .order('sort_order');

        if (playersError) throw playersError;
        setTeamPlayers(players || []);
        setCachedPlayers(team.id, players || []);

        // Cargar partidos
        const { data: games, error: gamesError } = await supabase
          .from('games')
          .select('*')
          .eq('team_id', team.id)
          .order('updated_at', { ascending: false });

        if (gamesError) throw gamesError;
        setTeamGames(games || []);
        setCachedGames(team.id, games || []);

        // Suscripcion Realtime para cambios en partidos de este equipo
        const channel = supabase
          .channel(`games-team-${team.id}`)
          .on(
            'postgres_changes',
            { event: 'INSERT', schema: 'public', table: 'games', filter: `team_id=eq.${team.id}` },
            (payload) => {
              setTeamGames(prev => {
                if (prev.some(g => g.id === payload.new.id)) return prev;
                const updated = [payload.new, ...prev];
                setCachedGames(team.id, updated);
                return updated;
              });
            }
          )
          .on(
            'postgres_changes',
            { event: 'UPDATE', schema: 'public', table: 'games', filter: `team_id=eq.${team.id}` },
            (payload) => {
              setTeamGames(prev => {
                const updated = prev.map(g => g.id === payload.new.id ? payload.new : g);
                setCachedGames(team.id, updated);
                return updated;
              });
            }
          )
          .on(
            'postgres_changes',
            { event: 'DELETE', schema: 'public', table: 'games', filter: `team_id=eq.${team.id}` },
            (payload) => {
              setTeamGames(prev => {
                const updated = prev.filter(g => g.id !== payload.old.id);
                setCachedGames(team.id, updated);
                return updated;
              });
            }
          )
          .subscribe();

        realtimeChannel.current = channel;
      } else {
        setTeamPlayers(getCachedPlayers(team.id));
        setTeamGames(getCachedGames(team.id));
      }
    } catch (err) {
      console.error('Error cargando equipo:', err);
      setTeamPlayers(getCachedPlayers(team.id));
      setTeamGames(getCachedGames(team.id));
    } finally {
      setLoading(false);
    }
  }, []);

  // Volver a lista de equipos
  const deselectTeam = useCallback(() => {
    // Limpiar suscripcion Realtime
    if (realtimeChannel.current) {
      supabase.removeChannel(realtimeChannel.current);
      realtimeChannel.current = null;
    }
    setCurrentTeam(null);
    setTeamPlayers([]);
    setTeamGames([]);
  }, []);

  // Unirse a equipo por codigo
  const joinTeam = useCallback(async (code) => {
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase.rpc('join_team_by_invite_code', { code });
    if (error) throw error;

    await loadTeams();
    return data;
  }, [user, loadTeams]);

  // Generar nuevo codigo de invitacion
  const regenerateInviteCode = useCallback(async (teamId) => {
    const newCode = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    const { error } = await supabase
      .from('teams')
      .update({ invite_code: newCode })
      .eq('id', teamId);

    if (error) throw error;
    await loadTeams();
    return newCode;
  }, [loadTeams]);

  // CRUD de jugadores del roster
  const addPlayer = useCallback(async (player) => {
    if (!currentTeam) return;

    const { data, error } = await supabase
      .from('team_players')
      .insert({ ...player, team_id: currentTeam.id })
      .select()
      .single();

    if (error) throw error;
    setTeamPlayers(prev => {
      const updated = [...prev, data];
      setCachedPlayers(currentTeam.id, updated);
      return updated;
    });
    return data;
  }, [currentTeam]);

  const updatePlayer = useCallback(async (playerId, updates) => {
    if (!currentTeam) return;

    const { error } = await supabase
      .from('team_players')
      .update(updates)
      .eq('id', playerId);

    if (error) throw error;

    setTeamPlayers(prev => {
      const updated = prev.map(p => p.id === playerId ? { ...p, ...updates } : p);
      setCachedPlayers(currentTeam.id, updated);
      return updated;
    });
  }, [currentTeam]);

  const deletePlayer = useCallback(async (playerId) => {
    if (!currentTeam) return;

    const { error } = await supabase
      .from('team_players')
      .delete()
      .eq('id', playerId);

    if (error) throw error;

    setTeamPlayers(prev => {
      const updated = prev.filter(p => p.id !== playerId);
      setCachedPlayers(currentTeam.id, updated);
      return updated;
    });
  }, [currentTeam]);

  // CRUD de partidos
  const saveGame = useCallback(async (gameData) => {
    if (!currentTeam || !user) return;

    const gameRecord = {
      id: gameData.id,
      team_id: currentTeam.id,
      created_by: user.id,
      status: gameData.status || 'in_progress',
      home_team: gameData.homeTeam || 'Home',
      away_team: gameData.awayTeam || 'Away',
      home_score: gameData.homeScore || 0,
      away_score: gameData.awayScore || 0,
      is_home_team: gameData.isHomeTeam ?? true,
      current_quarter: gameData.currentQuarter || 1,
      game_data: gameData,
      updated_at: new Date().toISOString()
    };

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('games')
          .upsert(gameRecord);

        if (error) throw error;
      } catch {
        addToQueue({ type: 'upsert_game', data: gameRecord });
      }
    } else {
      addToQueue({ type: 'upsert_game', data: gameRecord });
    }

    // Actualizar cache local
    setTeamGames(prev => {
      const idx = prev.findIndex(g => g.id === gameRecord.id);
      let updated;
      if (idx >= 0) {
        updated = [...prev];
        updated[idx] = gameRecord;
      } else {
        updated = [gameRecord, ...prev];
      }
      setCachedGames(currentTeam.id, updated);
      return updated;
    });
  }, [currentTeam, user]);

  const deleteGame = useCallback(async (gameId) => {
    if (!currentTeam) return;

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('games')
          .delete()
          .eq('id', gameId);
        if (error) throw error;
      } catch {
        addToQueue({ type: 'delete_game', data: { id: gameId } });
      }
    } else {
      addToQueue({ type: 'delete_game', data: { id: gameId } });
    }

    setTeamGames(prev => {
      const updated = prev.filter(g => g.id !== gameId);
      setCachedGames(currentTeam.id, updated);
      return updated;
    });
  }, [currentTeam]);

  // Obtener info de equipo por codigo de invitacion (sin ser miembro)
  const getTeamByInviteCode = useCallback(async (code) => {
    const { data, error } = await supabase.rpc('get_team_by_invite_code', { code });
    if (error) throw error;
    return data;
  }, []);

  // Actualizar equipo (nombre, icono)
  const updateTeam = useCallback(async (teamId, updates) => {
    const { error } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId);

    if (error) throw error;

    // Actualizar estado local
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, ...updates } : t));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(prev => ({ ...prev, ...updates }));
    }
  }, [currentTeam]);

  // Actualizar team_settings (posiciones, etc.)
  const updateTeamSettings = useCallback(async (teamId, settings) => {
    const { error } = await supabase
      .from('teams')
      .update({ team_settings: settings })
      .eq('id', teamId);

    if (error) throw error;

    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, team_settings: settings } : t));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(prev => ({ ...prev, team_settings: settings }));
    }
  }, [currentTeam]);

  // Subir avatar de equipo
  const uploadTeamAvatar = useCallback(async (teamId, file) => {
    const ext = file.name.split('.').pop();
    const path = `${teamId}/avatar.${ext}`;

    // Eliminar avatar anterior si existe
    await supabase.storage.from('team-avatars').remove([path]);

    const { error: uploadError } = await supabase.storage
      .from('team-avatars')
      .upload(path, file, { upsert: true });

    if (uploadError) throw uploadError;

    const { data: { publicUrl } } = supabase.storage
      .from('team-avatars')
      .getPublicUrl(path);

    // Guardar URL en el equipo
    await updateTeam(teamId, { icon: publicUrl });
    return publicUrl;
  }, [updateTeam]);

  // Eliminar equipo
  const deleteTeam = useCallback(async (teamId) => {
    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', teamId);

    if (error) throw error;
    await loadTeams();
    if (currentTeam?.id === teamId) {
      deselectTeam();
    }
  }, [loadTeams, currentTeam, deselectTeam]);

  // Refrescar datos del equipo actual
  const refreshCurrentTeam = useCallback(async () => {
    if (currentTeam) {
      await selectTeam(currentTeam);
    }
  }, [currentTeam, selectTeam]);

  return (
    <TeamContext.Provider value={{
      teams, currentTeam, teamPlayers, teamGames,
      loading, online,
      loadTeams, createTeam, selectTeam, deselectTeam, deleteTeam,
      joinTeam, regenerateInviteCode, getTeamByInviteCode,
      updateTeam, updateTeamSettings, uploadTeamAvatar,
      addPlayer, updatePlayer, deletePlayer,
      saveGame, deleteGame, refreshCurrentTeam
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
