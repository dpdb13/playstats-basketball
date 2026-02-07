import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { Plus, LogOut, Wifi, WifiOff, X } from 'lucide-react';
import PlayStatsIcon from './PlayStatsIcon';
import TeamIcon from './TeamIcon';

export default function TeamsList() {
  const { signOut, user } = useAuth();
  const { teams, loading, online, createTeam, joinTeam, selectTeam, getTeamByInviteCode } = useTeam();
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [joinMessage, setJoinMessage] = useState('');

  // Modal de invitacion
  const [inviteModal, setInviteModal] = useState(null); // { code, teamInfo, loading, joining }

  // Detectar ?join=CODIGO en URL
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const joinCode = params.get('join');
    if (joinCode && user) {
      showInviteModal(joinCode);
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, [user]);

  const showInviteModal = async (code) => {
    setInviteModal({ code, teamInfo: null, loading: true, joining: false });
    try {
      const info = await getTeamByInviteCode(code);
      if (info) {
        setInviteModal({ code, teamInfo: info, loading: false, joining: false });
      } else {
        setError('Codigo de invitacion no valido');
        setInviteModal(null);
      }
    } catch {
      setError('Error al buscar el equipo');
      setInviteModal(null);
    }
  };

  const handleJoinFromModal = async () => {
    if (!inviteModal) return;
    setInviteModal(prev => ({ ...prev, joining: true }));
    try {
      await joinTeam(inviteModal.code);
      setJoinMessage('Te has unido al equipo correctamente');
      setInviteModal(null);
      setTimeout(() => setJoinMessage(''), 3000);
    } catch (err) {
      setError(err.message || 'Error al unirse');
      setInviteModal(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;

    setCreating(true);
    setError('');
    try {
      const team = await createTeam(newTeamName.trim());
      setNewTeamName('');
      setShowCreate(false);
      if (team) selectTeam(team);
    } catch (err) {
      setError(err.message || 'Error creando equipo');
    } finally {
      setCreating(false);
    }
  };

  const handleSignOut = async () => {
    try {
      await signOut();
    } catch {
      // ignore
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md md:max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PlayStatsIcon className="w-7 h-7 text-orange-500" />
            <h1 className="text-xl font-black text-orange-400">PlayStats</h1>
          </div>
          <div className="flex items-center gap-3">
            {online ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <button
              onClick={handleSignOut}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
              title="Cerrar sesion"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mensajes */}
        {error && (
          <div className="bg-red-900/50 border border-red-500 rounded-lg p-3 mb-4 text-sm text-red-300">
            {error}
          </div>
        )}
        {joinMessage && (
          <div className="bg-green-900/50 border border-green-500 rounded-lg p-3 mb-4 text-sm text-green-300">
            {joinMessage}
          </div>
        )}

        {/* Titulo */}
        <h2 className="text-lg font-bold mb-4 text-gray-300">Mis Equipos</h2>

        {/* Lista de equipos */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
            <p className="text-gray-400">Cargando equipos...</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 bg-gray-800 rounded-2xl border-2 border-gray-700">
            <div className="text-4xl mb-4">🏀</div>
            <p className="text-gray-400 mb-2">No tienes equipos todavia</p>
            <p className="text-gray-500 text-sm">Crea tu primer equipo para empezar</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => selectTeam(team)}
                className="w-full bg-gray-800 hover:bg-gray-750 active:bg-gray-700 rounded-xl p-4 border-2 border-gray-700 hover:border-orange-500 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TeamIcon icon={team.icon} size="text-3xl" imgSize="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{team.name}</div>
                    <div className="text-xs text-gray-400">
                      {team.role === 'owner' ? 'Creador' : 'Miembro'}
                    </div>
                  </div>
                  <span className="text-gray-500">→</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Boton crear equipo */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="bg-gray-800 rounded-xl p-4 border-2 border-orange-500 mt-4">
            <label className="block text-sm font-bold text-gray-400 mb-2">Nombre del equipo</label>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full bg-gray-700 border border-gray-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none mb-3"
              placeholder="Ej: Panteras Alevin"
              autoFocus
              required
            />
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-green-600 hover:bg-green-500 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                {creating ? 'Creando...' : 'Crear'}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewTeamName(''); }}
                className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg font-bold"
              >
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full bg-green-700 hover:bg-green-600 active:bg-green-500 rounded-xl p-4 border-2 border-green-400 mt-4 font-bold flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> Crear Equipo
          </button>
        )}
      </div>

      {/* Modal de invitacion */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-xl p-5 border-2 border-orange-500 max-w-sm md:max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-orange-400">Invitacion a equipo</h3>
              <button onClick={() => setInviteModal(null)} className="p-1 bg-gray-700 rounded-lg hover:bg-gray-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteModal.loading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
                <p className="text-gray-400">Buscando equipo...</p>
              </div>
            ) : inviteModal.teamInfo ? (
              <>
                <div className="text-center py-4">
                  <TeamIcon icon={inviteModal.teamInfo.icon} size="text-5xl" imgSize="w-16 h-16" className="mx-auto" />
                  <h4 className="text-xl font-bold text-white mt-3">{inviteModal.teamInfo.name}</h4>
                  <p className="text-sm text-gray-400 mt-1">Te han invitado a este equipo</p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleJoinFromModal}
                    disabled={inviteModal.joining}
                    className="flex-1 bg-green-600 hover:bg-green-500 py-3 rounded-lg font-bold disabled:opacity-50"
                  >
                    {inviteModal.joining ? 'Uniendo...' : 'Unirme al equipo'}
                  </button>
                  <button
                    onClick={() => setInviteModal(null)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 py-3 rounded-lg font-bold"
                  >
                    Cancelar
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
