import { useState, useRef } from 'react';
import { useTeam } from '../context/TeamContext';
import { ArrowLeft, Share2, Play, Eye, Trash2, Users, Wifi, WifiOff, Check, X, Camera, RotateCcw } from 'lucide-react';
import ShareTeamModal from './ShareTeamModal';
import PlayerRosterEditor from './PlayerRosterEditor';
import TeamIcon from './TeamIcon';
import ImageCropper from './ImageCropper';

export default function TeamDetail({ onStartGame, onContinueGame, onViewGame }) {
  const { currentTeam, teamGames, teamPlayers, deselectTeam, deleteGame, online, deleteTeam, updateTeam, uploadTeamAvatar } = useTeam();
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
  const [cropFile, setCropFile] = useState(null); // Archivo seleccionado para recortar
  const fileInputRef = useRef(null);

  if (!currentTeam) return null;

  const isOwner = currentTeam.role === 'owner';

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

  // Guardar nombre
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

  // Guardar emoji
  const saveEmoji = async () => {
    const trimmed = emojiInput.trim();
    if (!trimmed) return;
    try {
      await updateTeam(currentTeam.id, { icon: trimmed });
    } catch { /* ignore */ }
    setShowIconEditor(false);
    setEmojiInput('');
  };

  // Seleccionar foto: abre el cropper para ajustarla antes de subir
  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCropFile(file);
    // Limpiar el input para poder seleccionar el mismo archivo otra vez
    e.target.value = '';
  };

  // Subir foto ya recortada desde el cropper
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
    <div className="min-h-screen bg-gray-900 text-white p-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <button
              onClick={deselectTeam}
              className="p-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>

            {/* Icono editable */}
            <button
              onClick={() => { setShowIconEditor(true); setEmojiInput(''); }}
              className="hover:opacity-80 transition-opacity"
              title="Cambiar icono"
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
                  className="bg-gray-700 border border-orange-500 rounded-lg px-2 py-1 text-white font-bold text-lg w-40 focus:outline-none"
                  autoFocus
                />
                <button onClick={saveName} className="p-1 bg-green-600 rounded"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditingName(false)} className="p-1 bg-gray-600 rounded"><X className="w-4 h-4" /></button>
              </div>
            ) : (
              <h1
                onClick={() => { setEditingName(true); setNameForm(currentTeam.name); }}
                className="text-lg font-black text-orange-400 cursor-pointer hover:underline"
                title="Pincha para editar"
              >
                {currentTeam.name}
              </h1>
            )}
          </div>

          <div className="flex items-center gap-2">
            {online ? (
              <Wifi className="w-4 h-4 text-green-400" />
            ) : (
              <WifiOff className="w-4 h-4 text-red-400" />
            )}
            <button
              onClick={() => setShowShare(true)}
              className="p-2 bg-blue-600 hover:bg-blue-500 rounded-lg"
              title="Compartir equipo"
            >
              <Share2 className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Nuevo partido */}
        <button
          onClick={() => onStartGame()}
          className="w-full mb-4 bg-green-700 hover:bg-green-600 active:bg-green-500 rounded-xl p-3 border-2 border-green-400 font-bold flex items-center justify-center gap-2"
        >
          <Play className="w-5 h-5" /> NUEVO PARTIDO
        </button>

        {/* Tabs */}
        <div className="flex mb-4 bg-gray-800 rounded-lg p-1">
          <button
            onClick={() => setActiveTab('games')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors ${activeTab === 'games' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            Partidos ({teamGames.length})
          </button>
          <button
            onClick={() => setActiveTab('roster')}
            className={`flex-1 py-2 rounded-md font-bold text-sm transition-colors flex items-center justify-center gap-1 ${activeTab === 'roster' ? 'bg-orange-600 text-white' : 'text-gray-400 hover:text-white'}`}
          >
            <Users className="w-4 h-4" /> Plantilla ({teamPlayers.length})
          </button>
        </div>

        {/* Contenido */}
        {activeTab === 'games' ? (
          <div>
            {teamGames.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-3">🏀</div>
                <p>No hay partidos todavia</p>
                <p className="text-sm">Pulsa "Nuevo Partido" para empezar</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Seccion: En proceso */}
                {(() => {
                  const inProgressGames = teamGames.filter(g => g.status === 'in_progress');
                  if (inProgressGames.length === 0) return null;
                  return (
                    <div>
                      <h3 className="text-sm font-bold text-yellow-400 mb-2 flex items-center gap-1.5">
                        <Play className="w-4 h-4" /> En proceso ({inProgressGames.length})
                      </h3>
                      <div className="space-y-2">
                        {inProgressGames.map(game => (
                          <div
                            key={game.id}
                            className="bg-gray-800 rounded-xl p-4 border-2 border-yellow-500"
                          >
                            <div className="flex justify-between items-start mb-2">
                              <div className="text-xs text-gray-400">
                                {new Date(game.updated_at || game.created_at).toLocaleDateString('es-ES', {
                                  day: 'numeric', month: 'short', year: 'numeric',
                                  hour: '2-digit', minute: '2-digit'
                                })}
                              </div>
                              <div className="text-xs px-2 py-0.5 rounded font-bold bg-yellow-600">
                                En proceso
                              </div>
                            </div>
                            <div className="text-lg font-bold mb-2">
                              {game.home_team} {game.home_score}
                              <span className="text-gray-500"> - </span>
                              {game.away_score} {game.away_team}
                            </div>
                            <div className="text-xs text-gray-500 mb-3">
                              Q{game.current_quarter} {game.is_home_team ? '- Home' : '- Away'}
                            </div>
                            <div className="flex gap-2">
                              <button
                                onClick={() => onContinueGame(game)}
                                className="flex-1 bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 py-2 rounded-lg font-bold text-sm flex items-center justify-center gap-1"
                              >
                                <Play className="w-4 h-4" /> Continuar
                              </button>
                              <button
                                onClick={(e) => handleDeleteGame(game.id, e)}
                                className="bg-red-600 hover:bg-red-500 px-3 py-2 rounded-lg font-bold text-sm"
                                title="Eliminar"
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
                      <h3 className="text-sm font-bold text-green-400 mb-2 flex items-center gap-1.5">
                        <Check className="w-4 h-4" /> Finalizados ({completedGames.length})
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
                              className="bg-gray-800 rounded-xl p-4 border-2 border-gray-600 hover:border-gray-400 cursor-pointer transition-colors"
                            >
                              <div className="flex justify-between items-start mb-2">
                                <div className="text-xs text-gray-400">
                                  {new Date(game.updated_at || game.created_at).toLocaleDateString('es-ES', {
                                    day: 'numeric', month: 'short', year: 'numeric',
                                    hour: '2-digit', minute: '2-digit'
                                  })}
                                </div>
                                <div className="flex items-center gap-2">
                                  <div className={`text-xs px-2 py-0.5 rounded font-bold ${didWin ? 'bg-green-600' : didLose ? 'bg-red-600' : 'bg-gray-600'}`}>
                                    {didWin ? 'Victoria' : didLose ? 'Derrota' : 'Empate'}
                                  </div>
                                  <button
                                    onClick={(e) => handleDeleteGame(game.id, e)}
                                    className="p-1 bg-red-600/80 hover:bg-red-500 rounded"
                                    title="Eliminar"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              </div>
                              <div className="text-lg font-bold mb-1">
                                <span className={game.is_home_team ? (didWin ? 'text-green-400' : didLose ? 'text-red-400' : 'text-white') : 'text-white'}>
                                  {game.home_team} {game.home_score}
                                </span>
                                <span className="text-gray-500"> - </span>
                                <span className={!game.is_home_team ? (didWin ? 'text-green-400' : didLose ? 'text-red-400' : 'text-white') : 'text-white'}>
                                  {game.away_score} {game.away_team}
                                </span>
                              </div>
                              <div className="text-xs text-gray-500">
                                Q{game.current_quarter} {game.is_home_team ? '- Home' : '- Away'}
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
          <PlayerRosterEditor />
        )}

        {/* Eliminar equipo (solo owner) */}
        {isOwner && (
          <div className="mt-8 pt-4 border-t border-gray-700">
            <button
              onClick={() => setShowDeleteTeam(true)}
              className="w-full py-2 bg-red-900/30 hover:bg-red-900/50 border border-red-700 rounded-lg text-red-400 text-sm font-bold"
            >
              Eliminar equipo
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
            <div className="bg-gray-800 rounded-xl p-5 border-2 border-red-500 max-w-sm w-full">
              <h3 className="text-lg font-black text-red-400 mb-3">Eliminar equipo</h3>
              <p className="text-gray-300 text-sm mb-4">
                Se eliminaran todos los partidos y datos del equipo <strong>{currentTeam.name}</strong>. Esta accion no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button onClick={handleDeleteTeam} className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold">Si, eliminar</button>
                <button onClick={() => setShowDeleteTeam(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg font-bold">Cancelar</button>
              </div>
            </div>
          </div>
        )}

        {/* Modal opciones partido finalizado */}
        {selectedFinishedGame && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-5 border-2 border-gray-500 max-w-sm w-full">
              <h3 className="text-lg font-black text-white mb-1">
                {selectedFinishedGame.home_team} {selectedFinishedGame.home_score} - {selectedFinishedGame.away_score} {selectedFinishedGame.away_team}
              </h3>
              <p className="text-xs text-gray-400 mb-4">
                {new Date(selectedFinishedGame.updated_at || selectedFinishedGame.created_at).toLocaleDateString('es-ES', {
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
                  <Eye className="w-5 h-5" /> Visualizar
                </button>
                <button
                  onClick={() => {
                    const game = selectedFinishedGame;
                    setSelectedFinishedGame(null);
                    onContinueGame({ ...game, status: 'in_progress' });
                  }}
                  className="w-full bg-yellow-600 hover:bg-yellow-500 active:bg-yellow-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <RotateCcw className="w-5 h-5" /> Reanudar partido
                </button>
                <button
                  onClick={() => {
                    setGameToDelete(selectedFinishedGame.id);
                    setSelectedFinishedGame(null);
                  }}
                  className="w-full bg-red-600 hover:bg-red-500 active:bg-red-400 py-3 rounded-lg font-bold flex items-center justify-center gap-2"
                >
                  <Trash2 className="w-5 h-5" /> Eliminar
                </button>
                <button
                  onClick={() => setSelectedFinishedGame(null)}
                  className="w-full bg-gray-600 hover:bg-gray-500 active:bg-gray-400 py-3 rounded-lg font-bold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal confirmar eliminar partido */}
        {gameToDelete && (
          <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
            <div className="bg-gray-800 rounded-xl p-5 border-2 border-red-500 max-w-sm w-full">
              <h3 className="text-lg font-black text-red-400 mb-3">Eliminar partido</h3>
              <p className="text-gray-300 text-sm mb-4">
                Este partido se eliminara permanentemente. Esta accion no se puede deshacer.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={confirmDeleteGame}
                  className="flex-1 bg-red-600 hover:bg-red-500 py-2 rounded-lg font-bold"
                >
                  Si, eliminar
                </button>
                <button
                  onClick={() => setGameToDelete(null)}
                  className="flex-1 bg-gray-600 hover:bg-gray-500 py-2 rounded-lg font-bold"
                >
                  Cancelar
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
            <div className="bg-gray-800 rounded-xl p-5 border-2 border-orange-500 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-black text-orange-400">Cambiar icono</h3>
                <button onClick={() => setShowIconEditor(false)} className="p-1 bg-gray-700 rounded-lg hover:bg-gray-600">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Icono actual */}
              <div className="text-center mb-4">
                <TeamIcon icon={currentTeam.icon} size="text-5xl" imgSize="w-16 h-16" className="mx-auto" />
              </div>

              {/* Opcion 1: escribir emoji */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-400 mb-1">Escribir un emoji</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={emojiInput}
                    onChange={(e) => setEmojiInput(e.target.value)}
                    className="flex-1 bg-gray-700 border border-gray-600 rounded-lg px-3 py-2 text-white text-xl text-center focus:border-orange-500 focus:outline-none"
                    placeholder="🏀"
                  />
                  <button
                    onClick={saveEmoji}
                    disabled={!emojiInput.trim()}
                    className="bg-green-600 hover:bg-green-500 px-4 py-2 rounded-lg font-bold disabled:opacity-50"
                  >
                    <Check className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* Emojis rapidos */}
              <div className="mb-4">
                <label className="block text-sm font-bold text-gray-400 mb-1">Emojis rapidos</label>
                <div className="flex flex-wrap gap-2">
                  {[
                    // Baloncesto y deportes
                    '🏀', '⛹️', '🏅', '🏆', '🥇', '🎽', '👟', '🏟️',
                    // Simbolos utiles
                    '✅', '❌', '🔥', '🎯', '⚡', '💪', '⭐', '✨',
                    // Tiempo y juego
                    '⏳', '⏱️', '🔔', '📊', '📈', '🚀',
                    // Animales (mascotas de equipo)
                    '🐯', '🦁', '🐺', '🦅', '🐻', '🦈', '🐉', '🦬',
                    // Colores y escudos
                    '🔴', '🔵', '🟢', '🟡', '🟠', '🟣', '⚫', '🛡️',
                    // Otros deportivos
                    '👊', '💥', '🏹', '⚔️', '👑', '💎'
                  ].map(emoji => (
                    <button
                      key={emoji}
                      onClick={async () => {
                        try { await updateTeam(currentTeam.id, { icon: emoji }); } catch { /* ignore */ }
                        setShowIconEditor(false);
                      }}
                      className="text-2xl p-1.5 bg-gray-700 hover:bg-gray-600 rounded-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>

              {/* Opcion 2: subir foto */}
              <div>
                <label className="block text-sm font-bold text-gray-400 mb-1">Subir una foto</label>
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
                  {uploading ? 'Subiendo...' : 'Elegir foto'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
