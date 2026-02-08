import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useTeam } from '../context/TeamContext';
import { useTranslation } from '../context/LanguageContext';
import { Plus, LogOut, Wifi, WifiOff, X } from 'lucide-react';
import PlayStatsIcon from './PlayStatsIcon';
import TeamIcon from './TeamIcon';
import { DEFAULT_POSITIONS, getPositionClasses } from '../lib/gameUtils';

export default function TeamsList() {
  const { signOut, user } = useAuth();
  const { teams, loading, online, createTeam, joinTeam, selectTeam, getTeamByInviteCode } = useTeam();
  const { t, language, toggleLanguage } = useTranslation();
  const [showCreate, setShowCreate] = useState(false);
  const [newTeamName, setNewTeamName] = useState('');
  const [newTeamPositions, setNewTeamPositions] = useState([...DEFAULT_POSITIONS]);
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
        setError(t.inviteCode);
        setInviteModal(null);
      }
    } catch {
      setError(t.errorJoining);
      setInviteModal(null);
    }
  };

  const handleJoinFromModal = async () => {
    if (!inviteModal) return;
    setInviteModal(prev => ({ ...prev, joining: true }));
    try {
      await joinTeam(inviteModal.code);
      setJoinMessage(t.joinedSuccessfully);
      setInviteModal(null);
      setTimeout(() => setJoinMessage(''), 3000);
    } catch (err) {
      setError(err.message || t.errorJoining);
      setInviteModal(null);
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) return;
    const cleanedPositions = newTeamPositions.map(p => p.trim()).filter(p => p.length > 0);
    if (cleanedPositions.length === 0) return;

    setCreating(true);
    setError('');
    try {
      const team = await createTeam(newTeamName.trim(), '🏀', cleanedPositions);
      setNewTeamName('');
      setNewTeamPositions([...DEFAULT_POSITIONS]);
      setShowCreate(false);
      if (team) selectTeam(team);
    } catch (err) {
      setError(err.message || t.errorCreating);
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
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-md md:max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <PlayStatsIcon className="w-7 h-7 text-orange-500" />
            <h1 className="text-xl font-black text-orange-400">PlayStats</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={toggleLanguage}
              className="text-lg px-1"
              title={language === 'en' ? 'Cambiar a español' : 'Switch to English'}
            >
              {language === 'en' ? '🇪🇸' : '🇬🇧'}
            </button>
            {online ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <button
              onClick={handleSignOut}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
              title={t.signOut}
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
          <div className="bg-emerald-900/50 border border-emerald-500 rounded-lg p-3 mb-4 text-sm text-emerald-300">
            {joinMessage}
          </div>
        )}

        {/* Titulo */}
        <h2 className="text-lg font-bold mb-4 text-slate-300">{t.myTeams}</h2>

        {/* Lista de equipos */}
        {loading ? (
          <div className="text-center py-8">
            <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
            <p className="text-slate-400">{t.loadingTeams}</p>
          </div>
        ) : teams.length === 0 ? (
          <div className="text-center py-8 bg-slate-800 rounded-2xl border-2 border-slate-700">
            <div className="text-4xl mb-4">🏀</div>
            <p className="text-slate-400 mb-2">{t.noTeamsYet}</p>
            <p className="text-slate-500 text-sm">{t.createFirstTeam}</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            {teams.map(team => (
              <button
                key={team.id}
                onClick={() => selectTeam(team)}
                className="w-full bg-slate-800 hover:bg-slate-700 active:bg-slate-700 rounded-xl p-4 border-2 border-slate-700 hover:border-orange-500 text-left transition-colors"
              >
                <div className="flex items-center gap-3">
                  <TeamIcon icon={team.icon} size="text-3xl" imgSize="w-10 h-10" />
                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-white truncate">{team.name}</div>
                    <div className="text-xs text-slate-400">
                      {team.role === 'owner' ? t.owner : t.member}
                    </div>
                  </div>
                  <span className="text-slate-500">→</span>
                </div>
              </button>
            ))}
          </div>
        )}

        {/* Boton crear equipo */}
        {showCreate ? (
          <form onSubmit={handleCreate} className="bg-slate-800 rounded-xl p-4 border-2 border-orange-500 mt-4">
            <label className="block text-sm font-bold text-slate-400 mb-2">{t.teamName}</label>
            <input
              type="text"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-3 text-white focus:border-orange-500 focus:outline-none mb-3"
              placeholder={t.teamNamePlaceholder}
              autoFocus
              required
            />
            <label className="block text-sm font-bold text-slate-400 mb-2">{t.teamPositions}</label>
            <div className="space-y-1.5 mb-2">
              {newTeamPositions.map((pos, idx) => {
                const colors = getPositionClasses(idx);
                return (
                  <div key={idx} className="flex gap-1.5 items-center">
                    <div className={`w-2 h-8 rounded-full ${colors.active.split(' ')[0]}`} />
                    <input
                      type="text"
                      value={pos}
                      onChange={(e) => {
                        const updated = [...newTeamPositions];
                        updated[idx] = e.target.value;
                        setNewTeamPositions(updated);
                      }}
                      className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-sm focus:border-orange-500 focus:outline-none"
                      placeholder={t.positionName}
                    />
                    {newTeamPositions.length > 1 && (
                      <button type="button" onClick={() => setNewTeamPositions(prev => prev.filter((_, i) => i !== idx))} className="p-1.5 text-red-400 hover:bg-slate-700 rounded">
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            <button
              type="button"
              onClick={() => setNewTeamPositions(prev => [...prev, ''])}
              className="text-emerald-400 text-sm font-bold mb-3 block"
            >
              + {t.addPosition}
            </button>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-2 rounded-lg font-bold disabled:opacity-50"
              >
                {creating ? t.creating : t.create}
              </button>
              <button
                type="button"
                onClick={() => { setShowCreate(false); setNewTeamName(''); setNewTeamPositions([...DEFAULT_POSITIONS]); }}
                className="flex-1 bg-slate-600 hover:bg-slate-500 py-2 rounded-lg font-bold"
              >
                {t.cancel}
              </button>
            </div>
          </form>
        ) : (
          <button
            onClick={() => setShowCreate(true)}
            className="w-full bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-500 rounded-xl p-4 border-2 border-emerald-400 mt-4 font-bold flex items-center justify-center gap-2"
          >
            <Plus className="w-5 h-5" /> {t.createTeam}
          </button>
        )}
      </div>

      {/* Modal de invitacion */}
      {inviteModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 rounded-xl p-5 border-2 border-orange-500 max-w-sm md:max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-orange-400">{t.teamInvitation}</h3>
              <button onClick={() => setInviteModal(null)} className="p-1 bg-slate-700 rounded-lg hover:bg-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {inviteModal.loading ? (
              <div className="text-center py-6">
                <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-orange-500 mx-auto mb-3"></div>
                <p className="text-slate-400">{t.searchingTeam}</p>
              </div>
            ) : inviteModal.teamInfo ? (
              <>
                <div className="text-center py-4">
                  <TeamIcon icon={inviteModal.teamInfo.icon} size="text-5xl" imgSize="w-16 h-16" className="mx-auto" />
                  <h4 className="text-xl font-bold text-white mt-3">{inviteModal.teamInfo.name}</h4>
                  <p className="text-sm text-slate-400 mt-1">{t.youveBeenInvited}</p>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleJoinFromModal}
                    disabled={inviteModal.joining}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-3 rounded-lg font-bold disabled:opacity-50"
                  >
                    {inviteModal.joining ? t.joining : t.joinTeam}
                  </button>
                  <button
                    onClick={() => setInviteModal(null)}
                    className="flex-1 bg-slate-600 hover:bg-slate-500 py-3 rounded-lg font-bold"
                  >
                    {t.cancel}
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
