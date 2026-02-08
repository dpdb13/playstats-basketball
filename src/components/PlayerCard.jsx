import React, { useState, useEffect, useRef, memo } from 'react';
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
  getBenchTimeStatus,
  teamPositions
}) => {
  const { t } = useTranslation();
  const positions = teamPositions || ['Base', 'Alero', 'Joker'];
  const isFouledOut = player.fouls >= 5;
  const isUnselected = player.position === 'Unselected';
  const isEditing = editingPlayer === player.id;
  const foulBgClass = getFoulBgClass(player.fouls, currentQuarter);

  // Estado local para el popover de faltas
  const [showFoulEditor, setShowFoulEditor] = useState(false);
  const foulTimerRef = useRef(null);

  // Double-tap detection for name editing
  const lastTapRef = useRef(0);

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

  // Double-tap handler for name
  const handleNameTap = () => {
    const now = Date.now();
    if (now - lastTapRef.current < 300) {
      // Double-tap detected
      lastTapRef.current = 0;
      onStartEditing(player);
    } else {
      lastTapRef.current = now;
    }
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

  // Foul dots for expanded view
  const renderFoulDots = () => {
    const dots = [];
    for (let i = 0; i < 5; i++) {
      dots.push(
        <span
          key={i}
          className={`inline-block w-1.5 h-1.5 rounded-full ${
            i < player.fouls
              ? player.fouls >= 4 ? 'bg-rose-500' : player.fouls >= 3 ? 'bg-amber-400' : 'bg-white'
              : 'bg-slate-600'
          }`}
        />
      );
    }
    return dots;
  };

  const borderClass = getTimeBorderClass();
  const dimClass = isRosterView && player.onCourt ? 'opacity-25' : '';

  // Modo edición (double-tap en nombre)
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
          <option value="Unselected">{t.unselected || 'Unselected'}</option>
          {positions.map(pos => (
            <option key={pos} value={pos}>{pos}</option>
          ))}
        </select>
        <div className="flex gap-1">
          <button onClick={onSaveEdit} className="flex-1 min-h-[44px] bg-emerald-500 rounded text-sm font-bold">✓</button>
          <button onClick={onCancelEdit} className="flex-1 min-h-[44px] bg-rose-500 rounded text-sm font-bold">✗</button>
        </div>
      </div>
    );
  }

  // ============================================
  // VISTA COMPACTA — una línea por jugador
  // Layout: StatusBar | #Number Name | Stint + Court/Bench | Points | Fouls | IN/OUT
  // ============================================
  if (compact) {
    const statusColor = getTimeStatusColor();
    return (
      <div className={`flex items-center gap-1.5 rounded-lg px-2 py-1.5 border-2 ${borderClass} ${player.onCourt ? 'bg-slate-800' : isUnselected ? 'bg-slate-700 opacity-50' : 'bg-slate-800'} ${dimClass}`}>
        {/* Time status bar */}
        <div className={`w-1 h-8 rounded-full ${statusColor} flex-shrink-0`} />

        {/* Number + Name (double-tap to edit) */}
        <div
          className="flex items-center gap-1 min-w-0 flex-1"
          onClick={handleNameTap}
          style={{ userSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <span className="text-[10px] font-black text-slate-400 bg-black/30 px-1 rounded flex-shrink-0">#{player.number}</span>
          <span className="text-xs font-bold text-white truncate">{player.name}</span>
        </div>

        {/* Stint timer (prominent, centered) */}
        <span className="text-sm font-black text-orange-300 tabular-nums flex-shrink-0">{formatTime(player.currentMinutes)}</span>

        {/* Court time / Bench time */}
        <div className="flex flex-col items-end flex-shrink-0 tabular-nums leading-tight">
          <span className="text-[10px] font-bold text-blue-400">{formatTime(player.totalCourtTime)} <span className="text-[9px] text-blue-400/60">{t.court}</span></span>
          <span className="text-[10px] font-bold text-slate-400">{formatTime(player.totalBenchTime)} <span className="text-[9px] text-slate-400/60">{t.benchLabel}</span></span>
        </div>

        {/* Points */}
        <span className="text-xs font-bold text-orange-300 tabular-nums flex-shrink-0 min-w-[20px] text-center">{player.points}p</span>

        {/* Fouls */}
        <div className="relative flex-shrink-0">
          <div
            onClick={toggleFoulEditor}
            className={`${foulBgClass} rounded px-1 py-0.5 cursor-pointer active:opacity-70 flex items-center gap-0.5`}
          >
            <span className="text-xs font-black text-white">{player.fouls}</span>
          </div>
          {showFoulEditor && (
            <>
              <div className="fixed inset-0 z-40" onClick={closeFoulEditor} />
              <div className="absolute right-0 bottom-full mb-1 z-50 bg-slate-800 border-2 border-orange-500 rounded-lg shadow-xl p-1.5 flex items-center gap-1.5">
                <button
                  onClick={() => handleFoulAdjust(-1)}
                  disabled={player.fouls <= 0}
                  className={`w-11 h-11 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls <= 0 ? 'bg-slate-600 opacity-40' : 'bg-rose-500 active:bg-rose-400'}`}
                >-</button>
                <span className="text-lg font-black text-white w-6 text-center tabular-nums">{player.fouls}</span>
                <button
                  onClick={() => handleFoulAdjust(1)}
                  disabled={player.fouls >= 5}
                  className={`w-11 h-11 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls >= 5 ? 'bg-slate-600 opacity-40' : 'bg-emerald-500 active:bg-emerald-400'}`}
                >+</button>
              </div>
            </>
          )}
        </div>

        {/* IN/OUT button */}
        <button
          onClick={() => onToggleCourt(player.id)}
          disabled={isFouledOut || isUnselected || (isRosterView && player.onCourt)}
          className={`min-h-[44px] min-w-[44px] px-2 rounded-lg font-bold text-xs flex-shrink-0 ${isFouledOut || isUnselected || (isRosterView && player.onCourt) ? 'bg-slate-600 opacity-50' : player.onCourt ? 'bg-rose-500 active:bg-rose-400' : 'bg-emerald-500 active:bg-emerald-400'}`}
        >
          {isUnselected ? t.na : player.onCourt ? t.outBtn : t.inBtn}
        </button>
      </div>
    );
  }

  // ============================================
  // VISTA EXPANDIDA — tarjeta completa con stats
  // ============================================

  return (
    <div className={`rounded-lg p-1.5 sm:p-2 md:p-3 border-3 ${borderClass} ${player.onCourt ? 'bg-slate-700' : isUnselected ? 'bg-slate-700 opacity-50' : 'bg-slate-800'} ${dimClass}`}>
      {/* Header: Number + Name (double-tap to edit) */}
      <div className="flex items-center justify-between mb-1 md:mb-1.5">
        <div
          className="flex items-center gap-1 min-w-0 flex-1 min-h-[44px] cursor-pointer"
          onClick={handleNameTap}
          style={{ userSelect: 'none', WebkitTouchCallout: 'none' }}
        >
          <span className="text-xs md:text-sm font-black text-white bg-black/30 px-1 md:px-1.5 rounded">#{player.number}</span>
          <span className="text-xs md:text-sm font-bold text-white truncate">{player.name}</span>
        </div>
      </div>

      {isFouledOut && <div className="bg-rose-500 text-white text-center py-0.5 rounded mb-1 text-xs md:text-sm font-bold">{t.out}</div>}

      {/* Points: large prominent display */}
      <div className="bg-orange-500/20 border border-orange-400/40 rounded px-2 py-1.5 md:py-2 mb-1 md:mb-1.5 text-center">
        <div className="text-2xl md:text-3xl font-black text-orange-300 tabular-nums">{player.points}</div>
        <div className="text-[10px] md:text-xs text-orange-300/70 font-bold uppercase tracking-wider">{t.pts}</div>
      </div>

      {/* Shot breakdown: 3PT / 2PT / 1PT */}
      <div className="flex gap-1 mb-1 md:mb-1.5">
        <div className="flex-1 bg-indigo-500/15 border border-indigo-500/30 rounded px-1 py-1 text-center">
          <div className="text-xs md:text-sm font-black text-indigo-400 tabular-nums">
            {player.shotStats?.pts3?.made || 0}/{(player.shotStats?.pts3?.made || 0) + (player.shotStats?.pts3?.missed || 0)}
          </div>
          <div className="text-[10px] text-indigo-400/70 font-bold">{t.threePt}</div>
        </div>
        <div className="flex-1 bg-blue-500/15 border border-blue-500/30 rounded px-1 py-1 text-center">
          <div className="text-xs md:text-sm font-black text-blue-400 tabular-nums">
            {player.shotStats?.pts2?.made || 0}/{(player.shotStats?.pts2?.made || 0) + (player.shotStats?.pts2?.missed || 0)}
          </div>
          <div className="text-[10px] text-blue-400/70 font-bold">{t.twoPt}</div>
        </div>
        <div className="flex-1 bg-emerald-500/15 border border-emerald-500/30 rounded px-1 py-1 text-center">
          <div className="text-xs md:text-sm font-black text-emerald-400 tabular-nums">
            {player.shotStats?.pts1?.made || 0}/{(player.shotStats?.pts1?.made || 0) + (player.shotStats?.pts1?.missed || 0)}
          </div>
          <div className="text-[10px] text-emerald-400/70 font-bold">{t.onePt}</div>
        </div>
      </div>

      {/* Fouls row */}
      <div className="relative mb-1 md:mb-1.5">
        <div
          onClick={toggleFoulEditor}
          className={`${foulBgClass} rounded px-2 md:px-3 py-1.5 md:py-2 flex items-center justify-center gap-2 cursor-pointer active:opacity-70 transition-opacity`}
        >
          <span className="text-sm sm:text-base md:text-lg font-black text-white">{player.fouls}<span className="text-xs font-bold text-white/60">/5</span></span>
          <div className="flex gap-0.5">
            {renderFoulDots()}
          </div>
        </div>
        {/* Popover de faltas +/- */}
        {showFoulEditor && (
          <>
            <div className="fixed inset-0 z-40" onClick={closeFoulEditor} />
            <div className="absolute right-0 bottom-full mb-1 z-50 bg-slate-800 border-2 border-orange-500 rounded-lg shadow-xl p-1.5 flex items-center gap-1.5">
              <button
                onClick={() => handleFoulAdjust(-1)}
                disabled={player.fouls <= 0}
                className={`w-11 h-11 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls <= 0 ? 'bg-slate-600 opacity-40' : 'bg-rose-500 active:bg-rose-400'}`}
              >-</button>
              <span className="text-lg font-black text-white w-6 text-center tabular-nums">{player.fouls}</span>
              <button
                onClick={() => handleFoulAdjust(1)}
                disabled={player.fouls >= 5}
                className={`w-11 h-11 rounded-lg font-black text-lg flex items-center justify-center ${player.fouls >= 5 ? 'bg-slate-600 opacity-40' : 'bg-emerald-500 active:bg-emerald-400'}`}
              >+</button>
            </div>
          </>
        )}
      </div>

      {/* Minutes played box */}
      <div className="bg-black/30 rounded px-2 py-1.5 text-center">
        <div className="text-sm md:text-base font-black text-white tabular-nums">{formatTime(player.totalCourtTime)}</div>
        <div className="text-[10px] text-slate-500 font-bold">{t.minutesPlayed}</div>
      </div>
    </div>
  );
});

PlayerCard.displayName = 'PlayerCard';

export default PlayerCard;
