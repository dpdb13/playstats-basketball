import { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthContext';
import {
  getCachedTeams, setCachedTeams,
  getCachedPlayers, setCachedPlayers,
  getCachedGames, setCachedGames,
  addToQueue, processQueue, startSyncListener, isOnline
} from '../lib/syncManager';
import { DEFAULT_POSITIONS } from '../lib/gameUtils';
import { extractAndSaveGameStats } from '../lib/statsExtractor';

const TeamContext = createContext({});

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
  // team_settings se carga por separado para que un fallo de schema cache no rompa toda la lista
  const loadTeams = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      if (isOnline()) {
        const { data, error } = await supabase
          .from('team_members')
          .select('team_id, role, teams(id, name, icon, invite_code, created_by)')
          .eq('user_id', user.id);

        if (error) throw error;

        const teamsData = (data || []).map(tm => ({
          ...tm.teams,
          role: tm.role,
          team_settings: {} // default, se carga al seleccionar equipo
        }));

        // Intentar cargar team_settings para todos los equipos (no fatal si falla)
        try {
          const teamIds = teamsData.map(t => t.id);
          const { data: settingsData, error: settingsError } = await supabase
            .from('teams')
            .select('id, team_settings')
            .in('id', teamIds);

          if (!settingsError && settingsData) {
            const settingsMap = {};
            settingsData.forEach(t => { settingsMap[t.id] = t.team_settings || {}; });
            teamsData.forEach(t => { t.team_settings = settingsMap[t.id] || {}; });
          }
        } catch {
          // team_settings not available — teams still work with default positions
        }

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

  // Crear equipo — operación atómica en 3 pasos críticos + 1 opcional
  // Paso 1: INSERT team (sin team_settings para evitar schema cache issues)
  // Paso 2: INSERT team_member (owner) — si falla, se limpia el team
  // Paso 3: INSERT jugadores por defecto
  // Paso 4 (opcional): UPDATE team_settings con posiciones custom
  const createTeam = useCallback(async (name, icon = '🏀', positions = null, shortName = null) => {
    if (!user) return null;

    const teamId = crypto.randomUUID();

    try {
      // Paso 1: Crear equipo
      const { error: teamError } = await supabase
        .from('teams')
        .insert({ id: teamId, name, icon, created_by: user.id });
      if (teamError) throw teamError;

      // Paso 2: Añadir creador como owner (necesario para que RLS permita las queries siguientes)
      const { error: memberError } = await supabase
        .from('team_members')
        .insert({ team_id: teamId, user_id: user.id, role: 'owner' });
      if (memberError) throw memberError;

      // Paso 3: Crear jugadores por defecto distribuidos entre posiciones
      const effectivePositions = positions || DEFAULT_POSITIONS;
      const playersToInsert = Array.from({ length: 12 }, (_, i) => ({
        team_id: teamId,
        name: `Player ${i + 1}`,
        number: String(i === 11 ? 0 : i + 1),
        position: i < 11 ? effectivePositions[i % effectivePositions.length] : 'Unselected',
        sort_order: i
      }));
      const { error: playersError } = await supabase.from('team_players').insert(playersToInsert);
      if (playersError) console.error('createTeam: players insert failed:', playersError);

      // Paso 4 (opcional): Guardar team_settings (posiciones custom + short_name + viewer_invite_code)
      // No es fatal si falla — los jugadores ya tienen sus posiciones asignadas,
      // y el equipo usará DEFAULT_POSITIONS hasta que se configure desde TeamDetail
      const settings = {};
      if (positions) settings.positions = positions;
      if (shortName) settings.short_name = shortName;
      // Generate viewer invite code automatically
      settings.viewer_invite_code = Array.from(crypto.getRandomValues(new Uint8Array(6)))
        .map(b => b.toString(16).padStart(2, '0')).join('');
      if (Object.keys(settings).length > 0) {
        try {
          const { error: settingsError } = await supabase
            .from('teams')
            .update({ team_settings: settings })
            .eq('id', teamId);
          if (settingsError) console.error('createTeam: team_settings update failed:', settingsError);
        } catch {
          // Schema cache issue — team still works
        }
      }

      await loadTeams();

      return {
        id: teamId, name, icon, created_by: user.id,
        role: 'owner',
        team_settings: settings
      };
    } catch (err) {
      // Limpiar equipo huérfano si se creó pero falló un paso crítico
      try { await supabase.from('teams').delete().eq('id', teamId); } catch { /* best effort */ }
      console.error('createTeam failed:', err);
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
        // Cargar team_settings fresco si no lo tenemos (no fatal)
        if (!team.team_settings || Object.keys(team.team_settings).length === 0) {
          try {
            const { data: freshTeam } = await supabase
              .from('teams')
              .select('team_settings')
              .eq('id', team.id)
              .single();
            if (freshTeam?.team_settings) {
              const enrichedTeam = { ...team, team_settings: freshTeam.team_settings };
              setCurrentTeam(enrichedTeam);
              team = enrichedTeam;
            }
          } catch {
            // team_settings unavailable — will use DEFAULT_POSITIONS
          }
        }

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

        // Auto-purge games deleted more than 7 days ago
        const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
        const toDelete = (games || []).filter(g => {
          if (g.status !== 'deleted') return false;
          const deletedAt = g.game_data?.deleted_at;
          return deletedAt && new Date(deletedAt).getTime() < sevenDaysAgo;
        });
        if (toDelete.length > 0) {
          const deletedIds = toDelete.map(g => g.id);
          const purgedGames = (games || []).filter(g => !deletedIds.includes(g.id));
          setTeamGames(purgedGames);
          setCachedGames(team.id, purgedGames);
          // Batch delete from DB in background
          supabase.from('games').delete().in('id', deletedIds)
            .then(({ error }) => { if (error) console.error('Purge failed:', error); });
        }

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

  // Unirse a equipo por codigo (editor)
  const joinTeam = useCallback(async (code) => {
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase.rpc('join_team_by_invite_code', { code });
    if (error) throw error;

    await loadTeams();
    return data;
  }, [user, loadTeams]);

  // Unirse a equipo como viewer
  const joinTeamAsViewer = useCallback(async (code) => {
    if (!user) throw new Error('No autenticado');

    const { data, error } = await supabase.rpc('join_team_as_viewer', { code });
    if (error) throw error;

    await loadTeams();
    return data;
  }, [user, loadTeams]);

  // Obtener info de equipo por codigo de viewer (sin ser miembro)
  const getTeamByViewerCode = useCallback(async (code) => {
    const { data, error } = await supabase.rpc('get_team_by_viewer_code', { code });
    if (error) throw error;
    return data?.[0] || null;
  }, []);

  // Generar nuevo codigo de invitacion (editor)
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

  // Generar nuevo codigo de invitacion (viewer)
  const regenerateViewerCode = useCallback(async (teamId) => {
    const newCode = Array.from(crypto.getRandomValues(new Uint8Array(6)))
      .map(b => b.toString(16).padStart(2, '0')).join('');

    // Read fresh settings from DB to avoid overwriting concurrent changes
    let freshSettings = {};
    try {
      const { data: freshTeam } = await supabase
        .from('teams')
        .select('team_settings')
        .eq('id', teamId)
        .single();
      freshSettings = freshTeam?.team_settings || {};
    } catch {
      // Fall back to local state if read fails
      const team = teams.find(t => t.id === teamId);
      freshSettings = { ...(team?.team_settings || {}) };
    }

    const settings = { ...freshSettings, viewer_invite_code: newCode };

    const { error } = await supabase
      .from('teams')
      .update({ team_settings: settings })
      .eq('id', teamId);

    if (error) throw error;

    // Update local state
    setTeams(prev => prev.map(t => t.id === teamId ? { ...t, team_settings: settings } : t));
    if (currentTeam?.id === teamId) {
      setCurrentTeam(prev => ({ ...prev, team_settings: settings }));
    }

    return newCode;
  }, [teams, currentTeam]);

  // Obtener miembros del equipo con info
  const getTeamMembers = useCallback(async (teamId) => {
    const { data, error } = await supabase.rpc('get_team_members_info', { p_team_id: teamId });
    if (error) throw error;
    return data || [];
  }, []);

  // Cambiar rol de un miembro
  const updateMemberRole = useCallback(async (teamId, userId, role) => {
    const { error } = await supabase.rpc('update_member_role', {
      p_team_id: teamId, p_user_id: userId, p_role: role
    });
    if (error) throw error;
  }, []);

  // Eliminar un miembro del equipo
  const removeMember = useCallback(async (teamId, userId) => {
    const { error } = await supabase.rpc('remove_team_member', {
      p_team_id: teamId, p_user_id: userId
    });
    if (error) throw error;
  }, []);

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

        // Fire-and-forget: extraer stats si el partido está completado
        if (gameRecord.status === 'completed') {
          extractAndSaveGameStats(gameRecord).catch(err =>
            console.error('Stats extraction failed:', err)
          );
        }
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

  // Soft delete: move game to trash (status='deleted', store deleted_at in game_data)
  const softDeleteGame = useCallback(async (gameId) => {
    if (!currentTeam) return;

    const game = teamGames.find(g => g.id === gameId);
    if (!game) return;

    const previousStatus = game.status;
    const updatedGameData = { ...(game.game_data || {}), deleted_at: new Date().toISOString(), previous_status: previousStatus };

    const updateRecord = {
      status: 'deleted',
      game_data: updatedGameData,
      updated_at: new Date().toISOString()
    };

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('games')
          .update(updateRecord)
          .eq('id', gameId);
        if (error) throw error;
      } catch (err) {
        console.error('Error soft-deleting game:', err);
        addToQueue({ type: 'update_game', data: { id: gameId, ...updateRecord } });
      }
    } else {
      addToQueue({ type: 'update_game', data: { id: gameId, ...updateRecord } });
    }

    setTeamGames(prev => {
      const updated = prev.map(g => g.id === gameId ? { ...g, status: 'deleted', game_data: updatedGameData } : g);
      setCachedGames(currentTeam.id, updated);
      return updated;
    });
  }, [currentTeam, teamGames]);

  // Restore game from trash
  const restoreGame = useCallback(async (gameId) => {
    if (!currentTeam) return;

    const game = teamGames.find(g => g.id === gameId);
    if (!game) return;

    const gameData = game.game_data || {};
    const restoredStatus = gameData.previous_status || 'completed';
    const { deleted_at, previous_status, ...cleanGameData } = gameData;

    const updateRecord = {
      status: restoredStatus,
      game_data: cleanGameData,
      updated_at: new Date().toISOString()
    };

    if (isOnline()) {
      try {
        const { error } = await supabase
          .from('games')
          .update(updateRecord)
          .eq('id', gameId);
        if (error) throw error;
      } catch (err) {
        console.error('Error restoring game:', err);
        addToQueue({ type: 'update_game', data: { id: gameId, ...updateRecord } });
      }
    } else {
      addToQueue({ type: 'update_game', data: { id: gameId, ...updateRecord } });
    }

    setTeamGames(prev => {
      const updated = prev.map(g => g.id === gameId ? { ...g, status: restoredStatus, game_data: cleanGameData } : g);
      setCachedGames(currentTeam.id, updated);
      return updated;
    });
  }, [currentTeam, teamGames]);

  // Permanent delete (from trash or direct)
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
    return data?.[0] || null;
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

    if (error) {
      console.error('updateTeamSettings failed:', error);
      throw error;
    }

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

  // Auto-refresh when app returns to foreground (fixes multi-device sync)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.visibilityState !== 'visible' || !isOnline()) return;
      if (currentTeam) {
        selectTeam(currentTeam);
      } else {
        loadTeams();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, [currentTeam, selectTeam, loadTeams]);

  return (
    <TeamContext.Provider value={{
      teams, currentTeam, teamPlayers, teamGames,
      loading, online,
      loadTeams, createTeam, selectTeam, deselectTeam, deleteTeam,
      joinTeam, joinTeamAsViewer, regenerateInviteCode, regenerateViewerCode,
      getTeamByInviteCode, getTeamByViewerCode,
      getTeamMembers, updateMemberRole, removeMember,
      updateTeam, updateTeamSettings, uploadTeamAvatar,
      addPlayer, updatePlayer, deletePlayer,
      saveGame, deleteGame, softDeleteGame, restoreGame, refreshCurrentTeam
    }}>
      {children}
    </TeamContext.Provider>
  );
}

export function useTeam() {
  return useContext(TeamContext);
}
