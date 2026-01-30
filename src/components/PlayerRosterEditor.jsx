import { useState } from 'react';
import { useTeam } from '../context/TeamContext';
import { Plus, Trash2, Edit3, Check, X } from 'lucide-react';

export default function PlayerRosterEditor() {
  const { teamPlayers, addPlayer, updatePlayer, deletePlayer } = useTeam();
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', number: '', position: 'Base' });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', number: '', position: 'Base' });

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditForm({ name: player.name, number: player.number, position: player.position });
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    try {
      await updatePlayer(editingId, {
        name: editForm.name.trim(),
        number: editForm.number.trim(),
        position: editForm.position
      });
      setEditingId(null);
    } catch {
      // ignore
    }
  };

  const handleAdd = async (e) => {
    e.preventDefault();
    if (!addForm.name.trim()) return;
    try {
      await addPlayer({
        name: addForm.name.trim(),
        number: addForm.number.trim(),
        position: addForm.position,
        sort_order: teamPlayers.length
      });
      setAddForm({ name: '', number: '', position: 'Base' });
      setShowAdd(false);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (playerId) => {
    if (confirm('Eliminar este jugador?')) {
      try {
        await deletePlayer(playerId);
      } catch {
        // ignore
      }
    }
  };

  const positionColors = {
    Base: 'text-blue-400',
    Alero: 'text-green-400',
    Joker: 'text-purple-400',
    Unselected: 'text-gray-400'
  };

  // Agrupar por posicion
  const grouped = {
    Base: teamPlayers.filter(p => p.position === 'Base'),
    Alero: teamPlayers.filter(p => p.position === 'Alero'),
    Joker: teamPlayers.filter(p => p.position === 'Joker'),
    Unselected: teamPlayers.filter(p => p.position === 'Unselected')
  };

  const renderGroup = (label, players, colorClass) => {
    if (players.length === 0) return null;
    return (
      <div className="mb-3" key={label}>
        <div className={`text-xs font-bold ${colorClass} mb-1`}>{label.toUpperCase()}</div>
        <div className="space-y-1">
          {players.map(player => (
            <div key={player.id} className="bg-gray-800 rounded-lg p-2 flex items-center gap-2">
              {editingId === player.id ? (
                <div className="flex-1 flex items-center gap-1">
                  <input
                    type="text"
                    value={editForm.name}
                    onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                    className="flex-1 bg-gray-700 px-2 py-1 rounded text-sm text-white"
                    placeholder="Nombre"
                  />
                  <input
                    type="text"
                    value={editForm.number}
                    onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                    className="w-12 bg-gray-700 px-2 py-1 rounded text-sm text-white text-center"
                    placeholder="#"
                  />
                  <select
                    value={editForm.position}
                    onChange={(e) => setEditForm({ ...editForm, position: e.target.value })}
                    className="bg-gray-700 px-2 py-1 rounded text-sm text-white"
                  >
                    <option value="Base">Base</option>
                    <option value="Alero">Alero</option>
                    <option value="Joker">Joker</option>
                    <option value="Unselected">No conv.</option>
                  </select>
                  <button onClick={saveEdit} className="p-1 bg-green-600 rounded"><Check className="w-4 h-4" /></button>
                  <button onClick={() => setEditingId(null)} className="p-1 bg-red-600 rounded"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <>
                  <span className="text-xs font-black text-white bg-black/30 px-1.5 py-0.5 rounded">#{player.number}</span>
                  <span className="flex-1 text-sm font-bold text-white">{player.name}</span>
                  <button onClick={() => startEdit(player)} className="p-1 hover:bg-gray-700 rounded">
                    <Edit3 className="w-3.5 h-3.5 text-gray-400" />
                  </button>
                  <button onClick={() => handleDelete(player.id)} className="p-1 hover:bg-gray-700 rounded">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {renderGroup('Bases', grouped.Base, 'text-blue-400')}
      {renderGroup('Aleros', grouped.Alero, 'text-green-400')}
      {renderGroup('Joker', grouped.Joker, 'text-purple-400')}
      {renderGroup('No convocados', grouped.Unselected, 'text-gray-400')}

      {/* Anadir jugador */}
      {showAdd ? (
        <form onSubmit={handleAdd} className="bg-gray-800 rounded-lg p-3 border border-green-500 mt-2">
          <div className="flex items-center gap-1 mb-2">
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="flex-1 bg-gray-700 px-2 py-1.5 rounded text-sm text-white"
              placeholder="Nombre"
              autoFocus
              required
            />
            <input
              type="text"
              value={addForm.number}
              onChange={(e) => setAddForm({ ...addForm, number: e.target.value })}
              className="w-14 bg-gray-700 px-2 py-1.5 rounded text-sm text-white text-center"
              placeholder="#"
            />
            <select
              value={addForm.position}
              onChange={(e) => setAddForm({ ...addForm, position: e.target.value })}
              className="bg-gray-700 px-2 py-1.5 rounded text-sm text-white"
            >
              <option value="Base">Base</option>
              <option value="Alero">Alero</option>
              <option value="Joker">Joker</option>
              <option value="Unselected">No conv.</option>
            </select>
          </div>
          <div className="flex gap-2">
            <button type="submit" className="flex-1 bg-green-600 hover:bg-green-500 py-1.5 rounded font-bold text-sm">Anadir</button>
            <button type="button" onClick={() => setShowAdd(false)} className="flex-1 bg-gray-600 hover:bg-gray-500 py-1.5 rounded font-bold text-sm">Cancelar</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full mt-2 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-gray-300"
        >
          <Plus className="w-4 h-4" /> Anadir jugador
        </button>
      )}
    </div>
  );
}
