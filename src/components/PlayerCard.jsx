import React, { useState, useEffect, useRef, memo } from 'react';
import { Edit3 } from 'lucide-react';
import { formatTime, getFoulBgClass } from '../lib/gameUtils';
import { useTranslation } from '../context/LanguageContext';

// ============================================
// COMPONENTE PLAYERCARD (memo para optimización)
// ============================================
const PlayerCard = memo(({
  player,
  isRosterView,
  compact,
  currentQuarter,
  editingPlayer,
  editForm,
  onEditFormChange,
  onStartEditing,
  onSaveEdit,
  onCancelEdit,
  onToggleCourt,
  onAdjustFouls,
  getCourtTimeStatus,
  getBenchTimeStatus
}) => {
  const { t } = useTranslation();
  const isFouledOut = player.fouls >= 5;
  const isUnselected = player.position === 'Unselected';
  const isEditing = editingPlayer === player.id;
  const foulBgClass = getFoulBgClass(player.fouls, currentQuarter);

  // Estado local para el popover de faltas
  const [showFoulEditor, setShowFoulEditor] = useState(false);
  const foulTimerRef = useRef(null);

  // Un solo mecanismo para el auto-cierre de 3 segundos
  const startFoulTimer = () => {
    if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
    foulTimerRef.current = setTimeout(() => setShowFoulEditor(false), 3000);
  };

  const closeFoulEditor = () => {
    if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
    setShowFoulEditor(false);
  };

  // Limpiar timer al desmontar el componente
  useEffect(() => () => {
    if (foulTimerRef.current) clearTimeout(foulTimerRef.current);
  }, []);

  const toggleFoulEditor = () => {
    if (showFoulEditor) {
      closeFoulEditor();
    } else {
      setShowFoulEditor(true);
      startFoulTimer();
    }
  };

  const handleFoulAdjust = (delta) => {
    onAdjustFouls(player.id, delta);
    startFoulTimer();
  };

  // Calcular color de barra según tiempo
  const getTimeStatusColor = () => {
    if (isUnselected) return 'bg-slate-500';
    if (player.onCourt) {
      const status = getCourtTimeStatus(player);
      return status === 'green' ? 'bg-emerald-500' : status === 'yellow' ? 'bg-amber-500' : 'bg-red-500';
    } else {
      const status = getBenchTimeStatus(player);
      return status === 'green' ? 'bg-emerald-500' : status === 'yellow' ? 'bg-amber-500' : 'bg-red-500';
    }
  };

  // Calcular el borde según tiempo
  const getTimeBorderClass = () => {
    if (isUnselected) return 'border-slate-500';
    if (player.onCourt) {
      const status = getCourtTimeStatus(player);
      return status === 'green' ? 'border-emerald-500' : status === 'yellow' ? 'border-amber-500' : 'border-red-500';
    } else {
      const status = getBenchTimeStatus(player);
      return status === 'green' ? 'border-emerald-500' : status === 'yellow' ? 'border-amber-500' : 'border-red-500';
    }
  };

  const borderClass = getTimeBorderClass();
  const dimClass = isRosterView && player.onCourt ? 'opacity-25' : '';

  // Modo edición (click en lápiz)
  if (isEditing) {
    return (
      <div className="rounded-lg p-2 border-2 border-orange-500 bg-slate-800">
        <input
          type="text"
          value={editForm.name}
          onChange={(e) => onEditFormChange({...editForm, name: e.target.value})}
          className="w-full bg-slate-900 text-white px-2 py-1 rounded text-xs mb-1"
          placeholder={t.name}
        />
        <input
          type="text"
          value={editForm.number}
          onChange={(e) => onEditFormChange({...editForm, number: e.target.value})}
          className="w-full bg-slate-900 text-white px-2 py-1 rounded text-xs mb-1"
          placeholder="#"
        />
        <select
          value={editForm.position}
          onChange={(e) => onEditFormChange({...editForm, position: e.target.value})}
          className="w-full bg-slate-900 text-white px-2 py-1 rounded text-xs mb-1"
        >
          <option value="Base">Base</option>
          <option value="Alero">Alero</option>
          <option value="Joker">Joker</option>
          <option value="Unselected">No</option>
        </select>
        <div className="flex gap-1">
          <button onClick={onSaveEdit} className="flex-1 min-h-[44px] bg-emerald-600 rounded text-sm font-bold">✓</button>
          <button onClick={onCancelEdit} className="flex-1 min-h-[44px] bg-red-600 rounded text-sm font-bold">✗</button>
        </div>
      </div>
    );
  }

  // ============================================
  // VISTA COMPACTA — una línea por jugador
  // ============================================
  if (compact) {
    const statusColor = getTimeStatusColor();
    return (
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 border-2 ${borderClass} ${player.onCourt ? 'bg-slate-800' : isUnselected ? 'bg-slate-700 opacity-50' : 'bg-slate-800'} ${dimClass}`}>
        {/* Time status bar */}
        <div className={`w-1 h-8 rounded-full ${statusColor} flex-shrink-0`} />

        {/* Number + Name */}
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-xs font-black text-white bg-black/30 px-1 rounded flex-shrink-0">#{player.number}</span>
          <span className="text-xs font-bold text-white truncate">{player.name}</span>
        </div>

        {/* Stint time */}
        <span className="text-xs font-bold text-slate-300 tabular-nums flex-shrink-0">{formatTime(player.currentMinutes)}</span>

        {/* Fouls */}
        <div className="relative flex-shrink-0">
          <div
            onClick={toggleFoulEditor}
            className={`${foulBgClass} rounded px-1.5 py-0.5 cursor-pointer active:opacity-70`}
          >
            <span className="text-xs font-black text-white">{player.fouls}F</span>
          </div>
          {showFoulEditor && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeFoulEditor} />
              <div className="absolute right-0 bottom-full mb-1 z-50 bg-slate-800 border-2 border-orange-500 rounded-lg shadow-xl p-1.5 flex items-center gap-1.5">
                <button
                  onClick={() => handleFoulAdjust(-1)}
                  disabled={player.fouls <= 0}
                  className={`w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls <= 0 ? 'bg-slate-600 opacity-40' : 'bg-red-600 active:bg-red-500'}`}
                >-</button>
                <span className="text-lg font-black text-white w-6 text-center tabular-nums">{player.fouls}</span>
                <button
                  onClick={() => handleFoulAdjust(1)}
                  disabled={player.fouls >= 5}
                  className={`w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls >= 5 ? 'bg-slate-600 opacity-40' : 'bg-emerald-600 active:bg-emerald-500'}`}
                >+</button>
              </div>
            </>
          )}
        </div>

        {/* IN/OUT button */}
        <button
          onClick={() => onToggleCourt(player.id)}
          disabled={isFouledOut || isUnselected || (isRosterView && player.onCourt)}
          className={`min-h-[44px] min-w-[44px] px-2 rounded-lg font-bold text-xs flex-shrink-0 ${isFouledOut || isUnselected || (isRosterView && player.onCourt) ? 'bg-slate-600 opacity-50' : player.onCourt ? 'bg-orange-600 active:bg-orange-500' : 'bg-emerald-600 active:bg-emerald-500'}`}
        >
          {isUnselected ? t.na : player.onCourt ? t.outBtn : t.inBtn}
        </button>
      </div>
    );
  }

  // ============================================
  // VISTA EXPANDIDA — tarjeta completa
  // ============================================
  return (
    <div className={`rounded-lg p-1.5 sm:p-2 md:p-3 border-3 ${borderClass} ${player.onCourt ? 'bg-slate-700' : isUnselected ? 'bg-slate-700 opacity-50' : 'bg-slate-800'} ${dimClass}`}>
      <div className="flex items-center justify-between mb-1 md:mb-1.5">
        <div className="flex items-center gap-1 min-w-0 flex-1">
          <span className="text-xs md:text-sm font-black text-white bg-black/30 px-1 md:px-1.5 rounded">#{player.number}</span>
          <span className="text-xs md:text-sm font-bold text-white truncate">{player.name}</span>
        </div>
        <button
          onClick={() => onStartEditing(player)}
          className="p-0.5 ml-1 flex-shrink-0"
        >
          <Edit3 className="w-3 h-3 md:w-4 md:h-4 text-slate-400" />
        </button>
      </div>

      {isFouledOut && <div className="bg-red-500 text-white text-center py-0.5 rounded mb-1 text-xs md:text-sm font-bold">{t.out}</div>}

      <div className="flex gap-1 mb-1 md:mb-1.5">
        <div className="flex-1 bg-black/30 rounded px-1 py-1 md:py-1.5 text-center min-w-0">
          <div className="text-sm sm:text-base md:text-lg font-black text-white tabular-nums">{formatTime(player.currentMinutes)}</div>
        </div>
        <div className="relative">
          <div
            onClick={toggleFoulEditor}
            className={`${foulBgClass} rounded px-2 md:px-3 py-1 md:py-1.5 flex items-center justify-center min-w-[32px] md:min-w-[40px] cursor-pointer active:opacity-70 transition-opacity`}
          >
            <span className="text-sm sm:text-base md:text-lg font-black text-white">{player.fouls}</span>
          </div>

          {/* Popover de faltas +/- */}
          {showFoulEditor && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeFoulEditor} />
              <div className="absolute right-0 bottom-full mb-1 z-50 bg-slate-800 border-2 border-orange-500 rounded-lg shadow-xl p-1.5 flex items-center gap-1.5">
                <button
                  onClick={() => handleFoulAdjust(-1)}
                  disabled={player.fouls <= 0}
                  className={`w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls <= 0 ? 'bg-slate-600 opacity-40' : 'bg-red-600 active:bg-red-500'}`}
                >-</button>
                <span className="text-lg font-black text-white w-6 text-center tabular-nums">{player.fouls}</span>
                <button
                  onClick={() => handleFoulAdjust(1)}
                  disabled={player.fouls >= 5}
                  className={`w-8 h-8 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls >= 5 ? 'bg-slate-600 opacity-40' : 'bg-emerald-600 active:bg-emerald-500'}`}
                >+</button>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex gap-1 mb-1 md:mb-1.5">
        <div className="flex-1 bg-black/20 rounded px-1 py-1 md:py-1.5 text-center min-w-0">
          <div className="text-sm leading-none mb-0.5">🏀</div>
          <div className="text-xs md:text-sm font-bold text-slate-300 tabular-nums">{formatTime(player.totalCourtTime)}</div>
        </div>
        <div className="flex-1 bg-black/20 rounded px-1 py-1 md:py-1.5 text-center min-w-0">
          <div className="text-sm leading-none mb-0.5">💺</div>
          <div className="text-xs md:text-sm font-bold text-slate-300 tabular-nums">{formatTime(player.totalBenchTime)}</div>
        </div>
      </div>

      <div className="bg-orange-600/50 border border-orange-400 rounded px-1 py-0.5 md:py-1 mb-1 md:mb-1.5 text-center">
        <span className="text-xs md:text-sm font-bold text-orange-200">{player.points} {t.pts}</span>
      </div>

      <button
        onClick={() => onToggleCourt(player.id)}
        disabled={isFouledOut || isUnselected || (isRosterView && player.onCourt)}
        className={`w-full min-h-[44px] rounded-lg font-bold text-xs md:text-sm ${isFouledOut || isUnselected || (isRosterView && player.onCourt) ? 'bg-slate-600 opacity-50' : player.onCourt ? 'bg-orange-600 active:bg-orange-500' : 'bg-emerald-600 active:bg-emerald-500'}`}
      >
        {isUnselected ? t.na : player.onCourt ? t.outBtn : t.inBtn}
      </button>
    </div>
  );
});

PlayerCard.displayName = 'PlayerCard';

export default PlayerCard;
