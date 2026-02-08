import { useState } from 'react';
import { useTeam } from '../context/TeamContext';
import { useTranslation } from '../context/LanguageContext';
import { Plus, Trash2, Edit3, Check, X } from 'lucide-react';
import { DEFAULT_POSITIONS, getPositionClasses } from '../lib/gameUtils';

export default function PlayerRosterEditor({ teamPositions }) {
  const { teamPlayers, addPlayer, updatePlayer, deletePlayer } = useTeam();
  const { t } = useTranslation();
  const positions = teamPositions || DEFAULT_POSITIONS;
  const defaultPos = positions[0] || 'Base';

  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', number: '', position: defaultPos, secondary_positions: [] });
  const [showAdd, setShowAdd] = useState(false);
  const [addForm, setAddForm] = useState({ name: '', number: '', position: defaultPos, secondary_positions: [] });

  const startEdit = (player) => {
    setEditingId(player.id);
    setEditForm({
      name: player.name,
      number: player.number,
      position: player.position,
      secondary_positions: player.secondary_positions || []
    });
  };

  const toggleSecondaryPosition = (form, setForm, pos) => {
    const current = form.secondary_positions;
    if (current.includes(pos)) {
      setForm({ ...form, secondary_positions: current.filter(p => p !== pos) });
    } else {
      setForm({ ...form, secondary_positions: [...current, pos] });
    }
  };

  const cleanSecondaryPositions = (position, secondaryPositions) => {
    if (position === 'Unselected') return [];
    return secondaryPositions.filter(p => p !== position);
  };

  const saveEdit = async () => {
    if (!editForm.name.trim()) return;
    try {
      const cleanedSecondary = cleanSecondaryPositions(editForm.position, editForm.secondary_positions);
      await updatePlayer(editingId, {
        name: editForm.name.trim(),
        number: editForm.number.trim(),
        position: editForm.position,
        secondary_positions: cleanedSecondary
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
      const cleanedSecondary = cleanSecondaryPositions(addForm.position, addForm.secondary_positions);
      await addPlayer({
        name: addForm.name.trim(),
        number: addForm.number.trim(),
        position: addForm.position,
        secondary_positions: cleanedSecondary,
        sort_order: teamPlayers.length
      });
      setAddForm({ name: '', number: '', position: defaultPos, secondary_positions: [] });
      setShowAdd(false);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (playerId) => {
    if (confirm(t.deletePlayerConfirm)) {
      try {
        await deletePlayer(playerId);
      } catch {
        // ignore
      }
    }
  };

  const availableSecondaryPositions = (primaryPosition) => {
    if (primaryPosition === 'Unselected') return [];
    return positions.filter(p => p !== primaryPosition);
  };

  const renderSecondaryToggles = (form, setForm) => {
    const available = availableSecondaryPositions(form.position);
    if (available.length === 0) return null;
    return (
      <div className="flex items-center gap-1.5 mt-1.5">
        <span className="text-[10px] text-slate-400 whitespace-nowrap">{t.canPlayAs}</span>
        {available.map(pos => {
          const isActive = form.secondary_positions.includes(pos);
          const posIdx = positions.indexOf(pos);
          const colors = getPositionClasses(posIdx);
          return (
            <button
              key={pos}
              type="button"
              onClick={() => toggleSecondaryPosition(form, setForm, pos)}
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full transition-colors ${isActive ? colors.active : colors.inactive}`}
            >
              {pos}
            </button>
          );
        })}
      </div>
    );
  };

  // Render position options for select dropdowns
  const renderPositionOptions = () => (
    <>
      {positions.map(pos => (
        <option key={pos} value={pos}>{pos}</option>
      ))}
      <option value="Unselected">{t.unselected}</option>
    </>
  );

  // Group players by position dynamically
  const grouped = {};
  positions.forEach(pos => {
    grouped[pos] = teamPlayers.filter(p => p.position === pos);
  });
  grouped.Unselected = teamPlayers.filter(p => p.position === 'Unselected' || !positions.includes(p.position));

  const renderGroup = (label, players, colorClass) => {
    if (players.length === 0) return null;
    return (
      <div className="mb-3" key={label}>
        <div className={`text-xs font-bold ${colorClass} mb-1`}>{label.toUpperCase()}</div>
        <div className="space-y-1">
          {players.map(player => (
            <div key={player.id} className="bg-slate-800 rounded-lg p-2">
              {editingId === player.id ? (
                <div>
                  <div className="mb-1">
                    <input
                      type="text"
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="w-full bg-slate-700 px-2 py-1 rounded text-sm text-white"
                      placeholder={t.name || 'Name'}
                    />
                  </div>
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      value={editForm.number}
                      onChange={(e) => setEditForm({ ...editForm, number: e.target.value })}
                      className="w-12 bg-slate-700 px-2 py-1 rounded text-sm text-white text-center"
                      placeholder="#"
                    />
                    <select
                      value={editForm.position}
                      onChange={(e) => {
                        const newPos = e.target.value;
                        setEditForm({
                          ...editForm,
                          position: newPos,
                          secondary_positions: editForm.secondary_positions.filter(p => p !== newPos)
                        });
                      }}
                      className="bg-slate-700 px-2 py-1 rounded text-sm text-white"
                    >
                      {renderPositionOptions()}
                    </select>
                    <button onClick={saveEdit} className="p-1 bg-emerald-600 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setEditingId(null)} className="p-1 bg-red-600 rounded min-h-[44px] min-w-[44px] flex items-center justify-center"><X className="w-4 h-4" /></button>
                  </div>
                  {renderSecondaryToggles(editForm, setEditForm)}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-xs font-black text-white bg-black/30 px-1.5 py-0.5 rounded">#{player.number}</span>
                  <span className="flex-1 text-sm font-bold text-white">
                    {player.name}
                    {(player.secondary_positions || []).length > 0 && (
                      <span className="ml-1.5">
                        {player.secondary_positions.map(pos => {
                          const posIdx = positions.indexOf(pos);
                          const colors = posIdx >= 0 ? getPositionClasses(posIdx) : getPositionClasses(0);
                          return (
                            <span key={pos} className={`inline-block text-[9px] font-bold px-1 py-0 rounded ml-0.5 ${colors.badge}`}>
                              {pos.charAt(0)}
                            </span>
                          );
                        })}
                      </span>
                    )}
                  </span>
                  <button onClick={() => startEdit(player)} className="p-1 hover:bg-slate-700 rounded min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Edit3 className="w-3.5 h-3.5 text-slate-400" />
                  </button>
                  <button onClick={() => handleDelete(player.id)} className="p-1 hover:bg-slate-700 rounded min-h-[44px] min-w-[44px] flex items-center justify-center">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div>
      {positions.map((pos, idx) => {
        const colors = getPositionClasses(idx);
        return renderGroup(pos, grouped[pos] || [], colors.text);
      })}
      {renderGroup(t.unselected, grouped.Unselected, 'text-slate-400')}

      {/* Add player */}
      {showAdd ? (
        <form onSubmit={handleAdd} className="bg-slate-800 rounded-lg p-3 border border-emerald-500 mt-2">
          <div className="flex items-center gap-1 mb-1">
            <input
              type="text"
              value={addForm.name}
              onChange={(e) => setAddForm({ ...addForm, name: e.target.value })}
              className="flex-1 bg-slate-700 px-2 py-1.5 rounded text-sm text-white"
              placeholder={t.name || 'Name'}
              autoFocus
              required
            />
            <input
              type="text"
              value={addForm.number}
              onChange={(e) => setAddForm({ ...addForm, number: e.target.value })}
              className="w-14 bg-slate-700 px-2 py-1.5 rounded text-sm text-white text-center"
              placeholder="#"
            />
            <select
              value={addForm.position}
              onChange={(e) => {
                const newPos = e.target.value;
                setAddForm({
                  ...addForm,
                  position: newPos,
                  secondary_positions: addForm.secondary_positions.filter(p => p !== newPos)
                });
              }}
              className="bg-slate-700 px-2 py-1.5 rounded text-sm text-white"
            >
              {renderPositionOptions()}
            </select>
          </div>
          {renderSecondaryToggles(addForm, setAddForm)}
          <div className="flex gap-2 mt-2">
            <button type="submit" className="flex-1 bg-emerald-600 hover:bg-emerald-500 py-1.5 rounded font-bold text-sm">{t.add}</button>
            <button type="button" onClick={() => { setShowAdd(false); setAddForm({ name: '', number: '', position: defaultPos, secondary_positions: [] }); }} className="flex-1 bg-slate-600 hover:bg-slate-500 py-1.5 rounded font-bold text-sm">{t.cancel}</button>
          </div>
        </form>
      ) : (
        <button
          onClick={() => setShowAdd(true)}
          className="w-full mt-2 py-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm font-bold flex items-center justify-center gap-2 text-slate-300"
        >
          <Plus className="w-4 h-4" /> {t.addPlayer}
        </button>
      )}
    </div>
  );
}
