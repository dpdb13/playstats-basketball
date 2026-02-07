import { supabase } from './supabase';

const SYNC_QUEUE_KEY = 'playstats-sync-queue';
const TEAMS_CACHE_KEY = 'playstats-teams-cache';
const PLAYERS_CACHE_KEY = 'playstats-players-cache';
const GAMES_CACHE_KEY = 'playstats-games-cache';
const MAX_RETRIES = 10;
const RETRY_INTERVAL = 30000; // 30 segundos

// Cola de operaciones pendientes
function getQueue() {
  try {
    return JSON.parse(localStorage.getItem(SYNC_QUEUE_KEY) || '[]');
  } catch {
    return [];
  }
}

function saveQueue(queue) {
  localStorage.setItem(SYNC_QUEUE_KEY, JSON.stringify(queue));
}

export function addToQueue(operation) {
  const queue = getQueue();

  // Deduplicar: si ya hay una operacion para el mismo juego, reemplazarla
  if (operation.type === 'upsert_game' && operation.data?.id) {
    const existingIdx = queue.findIndex(
      op => op.type === 'upsert_game' && op.data?.id === operation.data.id
    );
    if (existingIdx >= 0) {
      // Reemplazar con la version mas reciente, manteniendo retries
      queue[existingIdx] = {
        ...operation,
        timestamp: Date.now(),
        retries: queue[existingIdx].retries || 0
      };
      saveQueue(queue);
      return;
    }
  }

  queue.push({ ...operation, timestamp: Date.now(), retries: 0 });
  saveQueue(queue);
}

// Cache local
export function getCachedTeams() {
  try {
    return JSON.parse(localStorage.getItem(TEAMS_CACHE_KEY) || '[]');
  } catch {
    return [];
  }
}

export function setCachedTeams(teams) {
  localStorage.setItem(TEAMS_CACHE_KEY, JSON.stringify(teams));
}

export function getCachedPlayers(teamId) {
  try {
    const all = JSON.parse(localStorage.getItem(PLAYERS_CACHE_KEY) || '{}');
    return all[teamId] || [];
  } catch {
    return [];
  }
}

export function setCachedPlayers(teamId, players) {
  try {
    const all = JSON.parse(localStorage.getItem(PLAYERS_CACHE_KEY) || '{}');
    all[teamId] = players;
    localStorage.setItem(PLAYERS_CACHE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

export function getCachedGames(teamId) {
  try {
    const all = JSON.parse(localStorage.getItem(GAMES_CACHE_KEY) || '{}');
    return all[teamId] || [];
  } catch {
    return [];
  }
}

export function setCachedGames(teamId, games) {
  try {
    const all = JSON.parse(localStorage.getItem(GAMES_CACHE_KEY) || '{}');
    all[teamId] = games;
    localStorage.setItem(GAMES_CACHE_KEY, JSON.stringify(all));
  } catch {
    // ignore
  }
}

// Procesar cola de sincronizacion
export async function processQueue() {
  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining = [];

  for (const op of queue) {
    try {
      if (op.type === 'upsert_game') {
        const { error } = await supabase
          .from('games')
          .upsert({
            id: op.data.id,
            team_id: op.data.team_id,
            created_by: op.data.created_by,
            status: op.data.status,
            home_team: op.data.home_team,
            away_team: op.data.away_team,
            home_score: op.data.home_score,
            away_score: op.data.away_score,
            is_home_team: op.data.is_home_team,
            current_quarter: op.data.current_quarter,
            game_data: op.data.game_data,
            updated_at: new Date().toISOString()
          });
        if (error) throw error;
      } else if (op.type === 'delete_game') {
        const { error } = await supabase
          .from('games')
          .delete()
          .eq('id', op.data.id);
        if (error) throw error;
      }
    } catch (err) {
      const retries = (op.retries || 0) + 1;
      if (retries < MAX_RETRIES) {
        remaining.push({ ...op, retries });
      } else {
        console.error('Operacion descartada tras alcanzar maximo de reintentos:', op, err);
      }
    }
  }

  saveQueue(remaining);
}

// Detectar conexion y sincronizar
let retryIntervalId = null;

export function startSyncListener() {
  const handleOnline = () => {
    processQueue();
  };

  window.addEventListener('online', handleOnline);

  // Procesar al inicio si hay conexion
  if (navigator.onLine) {
    processQueue();
  }

  // Reintento periodico cada 30 segundos
  retryIntervalId = setInterval(() => {
    if (navigator.onLine) {
      const queue = getQueue();
      if (queue.length > 0) {
        processQueue();
      }
    }
  }, RETRY_INTERVAL);

  return () => {
    window.removeEventListener('online', handleOnline);
    if (retryIntervalId) {
      clearInterval(retryIntervalId);
      retryIntervalId = null;
    }
  };
}

export function isOnline() {
  return navigator.onLine;
}
