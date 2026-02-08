import { useState, useRef } from 'react';
import { useTeam } from '../context/TeamContext';
import { useTranslation } from '../context/LanguageContext';
import { ArrowLeft, Share2, Play, Eye, Trash2, Users, Wifi, WifiOff, Check, X, Camera, RotateCcw } from 'lucide-react';
import ShareTeamModal from './ShareTeamModal';
import PlayerRosterEditor from './PlayerRosterEditor';
import TeamIcon from './TeamIcon';
import ImageCropper from './ImageCropper';
import { getTeamPositions, getPositionClasses } from '../lib/gameUtils';

export default function TeamDetail({ onStartGame, onContinueGame, onViewGame }) {
  const { currentTeam, teamGames, teamPlayers, deselectTeam, deleteGame, online, deleteTeam, updateTeam, updateTeamSettings, uploadTeamAvatar } = useTeam();
  const { t, language } = useTranslation();
  const [showShare, setShowShare] = useState(false);
  const [activeTab, setActiveTab] = useState('games');
  const [selectedFinishedGame, setSelectedFinishedGame] = useState(null);
  const [showDeleteTeam, setShowDeleteTeam] = useState(false);
  const [gameToDelete, setGameToDelete] = useState(null);

  // Edicion de nombre
  const [editingName, setEditingName] = useState(false);
  const [nameForm, setNameForm] = useState('');

  // Edicion de icono
  const [showIconEditor, setShowIconEditor] = useState(false);
  const [emojiInput, setEmojiInput] = useState('');
  const [uploading, setUploading] = useState(false);
  const [cropFile, setCropFile] = useState(null);
  const fileInputRef = useRef(null);

  // Position editor state
  const [editingPositions, setEditingPositions] = useState(false);
  const [positionsForm, setPositionsForm] = useState([]);

  if (!currentTeam) return null;

  const teamPositions = getTeamPositions(currentTeam);
  const isOwner = currentTeam.role === 'owner';
  const dateLocale = language === 'es' ? 'es-ES' : 'en-US';

  const handleDeleteGame = (gameId, e) => {
    if (e) e.stopPropagation();
    setGameToDelete(gameId);
  };

  const confirmDeleteGame = () => {
    if (gameToDelete) {
      deleteGame(gameToDelete);
      setGameToDelete(null);
      setSelectedFinishedGame(null);
    }
  };

  const handleDeleteTeam = async () => {
    try {
      await deleteTeam(currentTeam.id);
    } catch { /* ignore */ }
    setShowDeleteTeam(false);
  };

  // Position editor functions
  const startEditPositions = () => {
    setPositionsForm([...teamPositions]);
    setEditingPositions(true);
  };

  const savePositions = async () => {
    const cleaned = positionsForm.map(p => p.trim()).filter(p => p.length > 0);
    if (cleaned.length === 0) return;
    try {
      const settings = { ...(currentTeam.team_settings || {}), positions: cleaned };
      await updateTeamSettings(currentTeam.id, settings);
    } catch { /* ignore */ }
    setEditingPositions(false);
  };

  const addPosition = () => {
    setPositionsForm(prev => [...prev, '']);
  };

  const removePosition = (idx) => {
    setPositionsForm(prev => prev.filter((_, i) => i !== idx));
  };

  const updatePositionName = (idx, value) => {
    setPositionsForm(prev => prev.map((p, i) => i === idx ? value : p));
  };

  const saveName = async () => {
    const trimmed = nameForm.trim();
    if (!trimmed || trimmed === currentTeam.name) {
      setEditingName(false);
      return;
    }
    try {
      await updateTeam(currentTeam.id, { name: trimmed });
    } catch { /* ignore */ }
    setEditingName(false);
  };

  const saveEmoji = async () => {
    const trimmed = emojiInput.trim();
    if (!trimmed) return;
    try {
      await updateTeam(currentTeam.id, { icon: trimmed });
    } catch { /* ignore */ }
    setShowIconEditor(false);
    setEmojiInput('');
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    e.target.value = '';
  };

  const handleCroppedUpload = async (croppedFile) => {
    setUploading(true);
    setCropFile(null);
    try {
      await uploadTeamAvatar(currentTeam.id, croppedFile);
    } catch { /* ignore */ }
    setUploading(false);
    setShowIconEditor(false);
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="max-w-md md:max-w-2xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={deselectTeam}
              className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Icono editable */}
            <button
              onClick={() => { setShowIconEditor(true); setEmojiInput(''); }}
              className="hover:opacity-80 transition-opacity"
              title={t.changeIcon}
            >
              <TeamIcon icon={currentTeam.icon} size="text-2xl" imgSize="w-9 h-9" />
            </button>

            {/* Nombre editable */}
            {editingName ? (
              <div className="flex items-center gap-1">
                <input
                  type="text"
                  value={nameForm}
                  onChange={(e) => setNameForm(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') saveName(); if (e.key === 'Escape') setEditingName(false); }}
                  className="bg-slate-700 border border-orange-500 rounded-lg px-2 py-1 text-white font-bold text-lg w-40 focus:outline-none"
                  autoFocus
                />
                <button onClick={saveName} className="p-1 bg-emerald-600 rounded"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingName(false)} className="p-1 bg-slate-600 rounded"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <h1
                onClick={() => { setEditingName(true); setNameForm(currentTeam.name); }}
                className="text-lg font-black text-orange-400 cursor-pointer hover:underline"
                title={t.tapToEdit}
              >
                {currentTeam.name}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            {online ? (
              <Wifi className="w-4 h-4 text-emerald-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <button
              onClick={() => setShowShare(true)}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nuevo partido */}
        <button
          onClick={() => onStartGame()}
          className="w-full mb-4 bg-emerald-700 hover:bg-emerald-600 active:bg-emerald-500 rounded-xl p-3 border-2 border-emerald-400 font-bold flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" /> {t.newGameBtn}
        </button>

        {/* Tabs */}
        <div className="flex mb-4 bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('games')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${activeTab === 'games' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            {t.games} ({teamGames.length})
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors flex items-center justify-center gap-1 ${activeTab === 'roster' ? 'bg-orange-600 text-white' : 'text-slate-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> {t.roster} ({teamPlayers.length})
          </button>
        </div>

        {/* Contenido */}
        {activeTab === 'games' ? (
          <div>
            {teamGames.length === 0 ? (
              <div className="text-center py-8 text-slate-500">
                <div className="text-4xl mb-3">🏀</div>
                <p>{t.noGamesYet}</p>
                <p className="text-sm">{t.tapNewGame}</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Seccion: En proceso */}
                {(() => {
                  const inProgressGames = teamGames.filter(g => g.status === 'in_progress');
                  if (inProgressGames.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-bold text-amber-400 mb-2 flex items-center gap-1.5">
                        <Play className="w-4 h-4" /> {t.inProgress} ({inProgressGames.length})
                      </h3>
                      <div className="space-y-2">
                        {inProgressGames.map(game => (
                          <div
                            key={game.id}
                            className="bg-slate-800 rounded-xl p-4 border-2 border-amber-500"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-xs text-slate-400">
                                {new Date(game.updated_at || game.created_at).toLocaleDateString(dateLocale, {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </div>
                              <div className="text-xs px-2 py-0.5 rounded font-bold bg-amber-600">
                                {t.inProgress}
                              </div>
                            </div>
                            <div className="text-lg font-bold mb-2">
                              {game.home_team} {game.home_score}
                              <span className="text-slate-500"> - </span>
                              {game.away_score} {game.away_team}
                            </div>
                            <div className="text-xs text-slate-500 mb-3">
                              Q{game.current_quarter} {game.is_home_team ? `- ${t.home}` : `- ${t.away}`}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onContinueGame(game)}
                                className="flex-1 bg-amber-600 hover:bg-amber-500 active:bg-amber-400 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1"
                              >
                                <Play className="w-4 h-4" /> {t.continue}
                              </button>
                              <button
                                onClick={(e) => handleDeleteGame(game.id, e)}
                                className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg font-bold text-sm"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Seccion: Finalizados */}
                {(() => {
                  const completedGames = teamGames.filter(g => g.status !== 'in_progress');
                  if (completedGames.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-bold text-emerald-400 mb-2 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> {t.completed} ({completedGames.length})
                      </h3>
                      <div className="space-y-2">
                        {completedGames.map(game => {
                          const ourScore = game.is_home_team ? game.home_score : game.away_score;
                          const theirScore = game.is_home_team ? game.away_score : game.home_score;
                          const didWin = ourScore > theirScore;
                          const didLose = ourScore < theirScore;

                          return (
                            <div
                              key={game.id}
                              onClick={() => setSelectedFinishedGame(game)}
                              className="bg-slate-800 rounded-xl p-4 border-2 border-slate-600 hover:border-slate-400 cursor-pointer transition-colors"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-xs text-slate-400">
                                  {new Date(game.updated_at || game.created_at).toLocaleDateString(dateLocale, {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`text-xs px-2 py-0.5 rounded font-bold ${didWin ? 'bg-emerald-600' : didLose ? 'bg-red-600' : 'bg-slate-600'}`}>
                                    {didWin ? t.victory : didLose ? t.defeat : t.draw}
                                  </div>
                                  <button
                                    onClick={(e) => handleDeleteGame(game.id, e)}
                                    className="p-1 bg-red-600/80 hover:bg-red-500 rounded"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-lg font-bold mb-1">
                                <span className={game.is_home_team ? (didWin ? 'text-emerald-400' : didLose ? 'text-red-400' : 'text-white') : 'text-white'}>
                                  {game.home_team} {game.home_score}
                                </span>
                                <span className="text-slate-500"> - </span>
                                <span className={!game.is_home_team ? (didWin ? 'text-emerald-400' : didLose ? 'text-red-400' : 'text-white') : 'text-white'}>
                                  {game.away_score} {game.away_team}
                                </span>
                              </div>
                              <div className="text-xs text-slate-500">
                                Q{game.current_quarter} {game.is_home_team ? `- ${t.home}` : `- ${t.away}`}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        ) : (
          <>
          {/* Position editor */}
          {isOwner && (
            <div className="mb-4">
              {editingPositions ? (
                <div className="bg-slate-800 rounded-lg p-3 border border-orange-500">
                  <div className="text-xs font-bold text-orange-400 mb-2">{t.editPositions}</div>
                  <div className="space-y-1.5 mb-2">
                    {positionsForm.map((pos, idx) => {
                      const colors = getPositionClasses(idx);
                      return (
                        <div key={idx} className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-black ${colors.active}`}>{idx + 1}</span>
                          <input
                            type="text"
                            value={pos}
                            onChange={(e) => updatePositionName(idx, e.target.value)}
                            className="flex-1 bg-slate-700 px-2 py-1 rounded text-sm text-white"
                            placeholder={t.positionName}
                          />
                          {positionsForm.length > 1 && (
                            <button onClick={() => removePosition(idx)} className="p-1 text-red-400 hover:bg-slate-700 rounded">
                              <X className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <button
                    onClick={addPosition}
                    className="w-full py-1.5 bg-slate-700 hover:bg-slate-600 rounded text-sm text-slate-300 font-bold mb-2"
                  >
                    + {t.addPosition}
                  </button>
                  <div className="flex gap-2">
                    <button onClick={savePositions} className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-500 rounded font-bold text-sm">
                      <Check className="w-4 h-4 inline mr-1" />{t.save}
                    </button>
                    <button onClick={() => setEditingPositions(false)} className="flex-1 py-1.5 bg-slate-600 hover:bg-slate-500 rounded font-bold text-sm">{t.cancel}</button>
                  </div>
                </div>
              ) : (
                <button
                  onClick={startEditPositions}
                  className="w-full py-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-sm font-bold text-slate-400 border border-slate-700"
                >
                  {t.editPositions}: {teamPositions.join(', ')}
                </button>
              )}
            </div>
          )}
          <PlayerRosterEditor teamPositions={teamPositions} />
          </>
        )}

        {/* Eliminar equipo (solo owner) */}
        {isOwner && (
          <div className="mt-8 pt-4 border-t border-slate-700">
            <button
              onClick={() => setShowDeleteTeam(true)}
              className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm font-bold"
            >
              {t.deleteTeamTitle}
            </button>
          </div>
        )}

        {/* Modal compartir */}
        {showShare && (
          <ShareTeamModal team={currentTeam} onClose={() => setShowShare(false)} />
        )}

        {/* Modal eliminar equipo */}
        {showDeleteTeam && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-5 border-2 border-red-500 max-w-sm md:max-w-md w-full">
              <h3 className="text-lg font-black text-red-400 mb-3">{t.deleteTeamTitle}</h3>
              <p className="text-slate-300 text-sm mb-4">
                {t.deleteTeamMsg(currentTeam.name)}
              </p>
              <div className="flex gap-2">
                <button onClick={handleDeleteTeam} className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold">{t.yesDelete}</button>
                <button onClick={() => setShowDeleteTeam(false)} className="flex-1 bg-slate-600 hover:bg-slate-500 py-2 rounded-lg font-bold">{t.cancel}</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal opciones partido finalizado */}
        {selectedFinishedGame && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-5 border-2 border-slate-500 max-w-sm md:max-w-md w-full">
              <h3 className="text-lg font-black text-white mb-1">
                {selectedFinishedGame.home_team} {selectedFinishedGame.home_score} - {selectedFinishedGame.away_score} {selectedFinishedGame.away_team}
              </h3>
              <p className="text-xs text-slate-400 mb-4">
                {new Date(selectedFinishedGame.updated_at || selectedFinishedGame.created_at).toLocaleDateString(dateLocale, {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit'
                })}
              </p>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    const game = selectedFinishedGame;
                    setSelectedFinishedGame(null);
                    onContinueGame(game);
                  }}
                  className="w-full bg-blue-600 hover:bg-blue-500 active:bg-blue-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Eye className="w-5 h-5" /> {t.view}
                </button>
                <button
                  onClick={() => {
                    const game = selectedFinishedGame;
                    setSelectedFinishedGame(null);
                    onContinueGame({ ...game, status: 'in_progress' });
                  }}
                  className="w-full bg-amber-600 hover:bg-amber-500 active:bg-amber-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> {t.resume}
                </button>
                <button
                  onClick={() => {
                    setGameToDelete(selectedFinishedGame.id);
                    setSelectedFinishedGame(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 active:bg-red-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> {t.delete}
                </button>
                <button
                  onClick={() => setSelectedFinishedGame(null)}
                  className="w-full bg-slate-600 hover:bg-slate-500 active:bg-slate-400 py-3 rounded-lg font-bold"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmar eliminar partido */}
        {gameToDelete && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-5 border-2 border-red-500 max-w-sm md:max-w-md w-full">
              <h3 className="text-lg font-black text-red-400 mb-3">{t.deleteGameTitle}</h3>
              <p className="text-slate-300 text-sm mb-4">
                {t.deleteGameMsg}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteGame}
                  className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold"
                >
                  {t.yesDelete}
                </button>
                <button
                  onClick={() => setGameToDelete(null)}
                  className="flex-1 bg-slate-600 hover:bg-slate-500 py-2 rounded-lg font-bold"
                >
                  {t.cancel}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Editor de imagen (cropper) */}
        {cropFile && (
          <ImageCropper
            file={cropFile}
            onCrop={handleCroppedUpload}
            onCancel={() => setCropFile(null)}
          />
        )}

        {/* Modal editar icono */}
        {showIconEditor && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-slate-800 rounded-xl p-5 border-2 border-orange-500 max-w-sm md:max-w-md w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-orange-400">{t.changeIcon}</h3>
                <button onClick={() => setShowIconEditor(false)} className="p-1 bg-slate-700 rounded-lg hover:bg-slate-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="text-center mb-4">
                <TeamIcon icon={currentTeam.icon} size="text-5xl" imgSize="w-16 h-16" className="mx-auto" />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-400 mb-1">{t.writeEmoji}</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emojiInput}
                    onChange={(e) => setEmojiInput(e.target.value)}
                    className="flex-1 bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-xl text-center focus:border-orange-500 focus:outline-none"
                    placeholder="🏀"
                  />
                  <button
                    onClick={saveEmoji}
                    disabled={!emojiInput.trim()}
                    className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-bold text-slate-400 mb-1">{t.quickEmojis}</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    '🏀', '⛹️', '🏅', '🏆', '🥇', '🎽', '👟', '🏟️',
                    '✅', '❌', '🔥', '🎯', '⚡', '💪', '⭐', '✨',
                    '⏳', '⏱️', '🔔', '📊', '📈', '🚀',
                    '🐯', '🦁', '🐺', '🦅', '🐻', '🦈', '🐉', '🦬',
                    '🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '🛡️',
                    '👊', '💥', '🏹', '⚔️', '👑', '💎'
                  ].map(emoji => (
                    <button
                      key={emoji}
                      onClick={async () => {
                        try { await updateTeam(currentTeam.id, { icon: emoji }); } catch { /* ignore */ }
                        setShowIconEditor(false);
                      }}
                      className="text-2xl p-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-slate-400 mb-1">{t.uploadPhoto}</label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileSelect}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="w-full bg-blue-600 hover:bg-blue-500 py-2 rounded-lg font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  <Camera className="w-5 h-5" />
                  {uploading ? t.uploading : t.choosePhoto}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
