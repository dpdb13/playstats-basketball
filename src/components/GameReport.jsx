import { useState, useMemo } from 'react';
import { ArrowLeft, Download, ChevronDown, ChevronUp, Trophy, Target, Shield, Clock, TrendingUp, AlertTriangle, BarChart3 } from 'lucide-react';
import { useTranslation } from '../context/LanguageContext';
import { calculateGameStats, formatPlusMinus, formatPct } from '../lib/statsCalculator';
import { formatTime, getQuarterLabel } from '../lib/gameUtils';
import { generateReport } from '../lib/generateReport';

function Section({ title, icon: Icon, children, defaultOpen = false, badge }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-3">
      <button
        onClick={() => setOpen(p => !p)}
        className="w-full flex items-center justify-between py-3 px-3 bg-slate-800 rounded-lg min-h-[44px]"
      >
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          {Icon && <Icon className="w-4 h-4 text-orange-400" />}
          {title}
          {badge > 0 && <span className="text-[10px] md:text-xs bg-slate-600 text-slate-300 px-1.5 py-0.5 rounded-full">{badge}</span>}
        </h3>
        {open ? <ChevronUp className="w-4 h-4 text-slate-500" /> : <ChevronDown className="w-4 h-4 text-slate-500" />}
      </button>
      {open && <div className="mt-2">{children}</div>}
    </div>
  );
}

function PMBadge({ value, size = 'sm' }) {
  const cls = value > 0 ? 'text-emerald-400' : value < 0 ? 'text-red-400' : 'text-slate-400';
  const textSize = size === 'lg' ? 'text-base font-black' : 'text-xs font-bold';
  return <span className={`${cls} ${textSize}`}>{formatPlusMinus(value)}</span>;
}

function StatPill({ label, value, sub }) {
  return (
    <div className="bg-slate-700/50 rounded-lg px-3 py-2 text-center">
      <div className="text-lg font-black text-white">{value}</div>
      <div className="text-[10px] md:text-xs text-slate-400 uppercase">{label}</div>
      {sub && <div className="text-[10px] md:text-xs text-slate-500">{sub}</div>}
    </div>
  );
}

export default function GameReport({ gameData, onBack }) {
  const { t } = useTranslation();

  const stats = useMemo(() => {
    if (!gameData) return null;
    const gd = gameData.game_data || gameData;
    const isHome = gd.isHomeTeam !== false;
    const ourScore = isHome ? (gd.homeScore || 0) : (gd.awayScore || 0);
    const rivalScore = isHome ? (gd.awayScore || 0) : (gd.homeScore || 0);
    const ourTeamName = isHome ? (gd.homeTeam || 'Home') : (gd.awayTeam || 'Away');
    const rivalTeamName = isHome ? (gd.awayTeam || 'Away') : (gd.homeTeam || 'Home');

    return calculateGameStats({
      players: gd.players || [],
      quintetHistory: gd.quintetHistory || [],
      currentQuintet: gd.currentQuintet || null,
      eventLog: gd.eventLog || [],
      partialScores: gd.partialScores || {},
      scoresByQuarter: gd.scoresByQuarter || {},
      substitutionsByQuarter: gd.substitutionsByQuarter || {},
      ourScore,
      rivalScore,
      ourTeamName,
      rivalTeamName,
      isHomeTeam: isHome,
      gameTime: gd.gameTime || 0,
      leadChanges: gd.leadChanges || 0,
      ties: gd.ties || 0,
      biggestLead: gd.biggestLead || { us: 0, them: 0 }
    });
  }, [gameData]);

  if (!stats) return null;

  const { playerStats, quintetStats, parcials, foulImpact, summary } = stats;
  const resultColor = summary.result === 'win' ? 'text-emerald-400' : summary.result === 'loss' ? 'text-red-400' : 'text-slate-300';
  const resultBorder = summary.result === 'win' ? 'border-emerald-500' : summary.result === 'loss' ? 'border-red-500' : 'border-slate-500';

  const handleDownload = () => {
    const gd = gameData.game_data || gameData;
    const isHome = gd.isHomeTeam !== false;
    generateReport({
      ourScore: summary.ourScore,
      rivalScore: summary.rivalScore,
      ourTeamName: summary.ourTeamName,
      rivalTeamName: summary.rivalTeamName,
      players: gd.players || [],
      quintetHistory: gd.quintetHistory || [],
      currentQuintet: gd.currentQuintet || null,
      eventLog: gd.eventLog || [],
      partialScores: gd.partialScores || {},
      scoresByQuarter: gd.scoresByQuarter || {},
      substitutionsByQuarter: gd.substitutionsByQuarter || {},
      isHomeTeam: isHome,
      gameTime: gd.gameTime || 0,
      leadChanges: gd.leadChanges || 0,
      ties: gd.ties || 0,
      biggestLead: gd.biggestLead || { us: 0, them: 0 }
    });
  };

  return (
    <div className="min-h-screen bg-slate-900 text-white">
      {/* Header */}
      <div className="sticky top-0 bg-slate-900/95 backdrop-blur z-10 px-4 py-3 flex items-center justify-between border-b border-slate-800">
        <button onClick={onBack} className="p-3 -ml-3 rounded-lg hover:bg-slate-800 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <span className="font-bold text-sm">{t.gameReport || 'Game Report'}</span>
        <button onClick={handleDownload} className="p-3 -mr-3 rounded-lg hover:bg-slate-800 text-orange-400 min-h-[44px] min-w-[44px] flex items-center justify-center">
          <Download className="w-5 h-5" />
        </button>
      </div>

      <div className="px-4 py-4 max-w-lg md:max-w-2xl lg:max-w-4xl mx-auto">
        {/* Score */}
        <div className={`text-center mb-5 bg-slate-800 rounded-xl p-5 border-2 ${resultBorder}`}>
          <div className="text-3xl font-black">
            <span className={resultColor}>{summary.ourScore}</span>
            <span className="text-slate-500 mx-2">-</span>
            <span className="text-white">{summary.rivalScore}</span>
          </div>
          <div className="text-sm text-slate-400 mt-1">
            {summary.ourTeamName} vs {summary.rivalTeamName}
          </div>
          <div className="flex justify-center gap-3 mt-3">
            <StatPill label={t.substitutions || 'Subs'} value={summary.realSubs} />
            <StatPill label={t.leadChangesLabel || 'Lead chg.'} value={summary.leadChanges} />
            <StatPill label={t.tiesLabel || 'Ties'} value={summary.ties} />
          </div>
          {(summary.biggestLead.us > 0 || summary.biggestLead.them > 0) && (
            <div className="text-[10px] md:text-xs text-slate-500 mt-2">
              {t.biggestLeadLabel || 'Biggest lead'}: {summary.ourTeamName} +{summary.biggestLead.us} / {summary.rivalTeamName} +{summary.biggestLead.them}
            </div>
          )}
        </div>

        {/* Parcials */}
        <Section title={t.parcialsTitle || 'Parcials by Quarter'} icon={Clock}>
          <div className="bg-slate-800 rounded-lg overflow-hidden">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-slate-400 border-b border-slate-700">
                  <th className="py-2 px-2 text-left"></th>
                  <th className="py-2 px-1 text-center">1st 5'</th>
                  <th className="py-2 px-1 text-center">2nd 5'</th>
                  <th className="py-2 px-1 text-center font-black">{t.total || 'Total'}</th>
                  <th className="py-2 px-1 text-center">+/-</th>
                </tr>
              </thead>
              <tbody>
                {parcials.map(q => {
                  const totalColor = q.total.us > q.total.them ? 'text-emerald-400' : q.total.us < q.total.them ? 'text-red-400' : 'text-slate-400';
                  const firstColor = q.first.us > q.first.them ? 'text-emerald-400/70' : q.first.us < q.first.them ? 'text-red-400/70' : 'text-slate-500';
                  const secondColor = q.second.us > q.second.them ? 'text-emerald-400/70' : q.second.us < q.second.them ? 'text-red-400/70' : 'text-slate-500';
                  return (
                    <tr key={q.quarter} className="border-b border-slate-700/50">
                      <td className="py-2 px-2 font-bold text-slate-400">{getQuarterLabel(q.quarter)}</td>
                      <td className={`py-2 px-1 text-center ${firstColor}`}>{q.first.us}-{q.first.them}</td>
                      <td className={`py-2 px-1 text-center ${secondColor}`}>{q.second.us}-{q.second.them}</td>
                      <td className={`py-2 px-1 text-center font-bold ${totalColor}`}>{q.total.us}-{q.total.them}</td>
                      <td className="py-2 px-1 text-center"><PMBadge value={q.diff} /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Section>

        {/* Individual Player Stats */}
        <Section title={t.playerStatsTitle || 'Player Stats'} icon={BarChart3} badge={playerStats.length}>
          {playerStats.length === 0
            ? <p className="text-xs text-slate-500 px-2">{t.noData || 'No data'}</p>
            : <div className="space-y-2">
                {playerStats.map(p => (
                  <PlayerStatCard key={p.id} player={p} t={t} />
                ))}
              </div>
          }
        </Section>

        {/* Quintets by +/- */}
        <Section title={t.quintetsPM || 'Lineups by +/-'} icon={TrendingUp} badge={quintetStats.byPlusMinus.length}>
          <QuintetTable quintets={quintetStats.byPlusMinus} mode="plusMinus" t={t} />
        </Section>

        {/* Quintets by Offense */}
        <Section title={t.quintetsOffense || 'Best Offensive Lineups'} icon={Target} badge={quintetStats.byOffense.length}>
          <QuintetTable quintets={quintetStats.byOffense} mode="offense" t={t} />
        </Section>

        {/* Quintets by Defense */}
        <Section title={t.quintetsDefense || 'Best Defensive Lineups'} icon={Shield} badge={quintetStats.byDefense.length}>
          <QuintetTable quintets={quintetStats.byDefense} mode="defense" t={t} />
        </Section>

        {/* Quintets by Shooting */}
        {quintetStats.byShooting.length > 0 && (
          <Section title={t.quintetsShooting || 'Lineups by Shooting %'} icon={Target} badge={quintetStats.byShooting.length}>
            <QuintetTable quintets={quintetStats.byShooting} mode="shooting" t={t} />
          </Section>
        )}

        {/* Quintets by 3PT */}
        {quintetStats.by3PT && quintetStats.by3PT.length > 0 && (
          <Section title={t.quintets3PT || 'Best 3PT Lineups'} icon={Target} badge={quintetStats.by3PT.length}>
            <QuintetTable quintets={quintetStats.by3PT} mode="threePt" t={t} />
          </Section>
        )}

        {/* Quintets by Minutes */}
        <Section title={t.quintetsMinutes || 'Lineups by Minutes'} icon={Clock} badge={quintetStats.byMinutes.length}>
          <QuintetTable quintets={quintetStats.byMinutes} mode="minutes" t={t} />
        </Section>

        {/* Best/Worst Stints */}
        <Section title={t.bestWorstStints || 'Best & Worst Stints'} icon={TrendingUp}>
          <BestWorstStints playerStats={playerStats} t={t} />
        </Section>

        {/* Foul Impact */}
        <Section title={t.foulImpactTitle || 'Foul Impact'} icon={AlertTriangle}>
          <FoulImpactTable foulImpact={foulImpact} t={t} />
        </Section>

        {/* Player Stints Detail */}
        <Section title={t.stintsDetail || 'Player Stints'} icon={Clock}>
          <StintsDetail playerStats={playerStats} t={t} />
        </Section>

        <div className="text-center text-[10px] text-slate-600 mt-6 mb-4">
          PlayStats Basketball — {new Date().toLocaleDateString()}
        </div>
      </div>
    </div>
  );
}

// ============================================
// SUB-COMPONENTS
// ============================================

function PlayerStatCard({ player: p, t }) {
  const s3 = p.shotStats.pts3;
  const s2 = p.shotStats.pts2;
  const s1 = p.shotStats.pts1;
  const att3 = s3.made + s3.missed;
  const att2 = s2.made + s2.missed;
  const att1 = s1.made + s1.missed;
  const pct3 = att3 > 0 ? Math.round((s3.made / att3) * 100) : null;
  const pct2 = att2 > 0 ? Math.round((s2.made / att2) * 100) : null;
  const pct1 = att1 > 0 ? Math.round((s1.made / att1) * 100) : null;

  return (
    <div className="bg-slate-800 rounded-lg p-3">
      {/* Row 1: Player identity */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-xs font-black text-white bg-black/30 px-1.5 py-0.5 rounded">#{p.number}</span>
        <span className="text-sm font-bold">{p.name}</span>
        <span className="text-[10px] text-slate-500">{p.position}</span>
      </div>
      {/* Row 2: Key stats — the 4 numbers you always want to see */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <div className="bg-slate-700/50 rounded py-1.5 text-center">
          <div className="text-sm font-black text-white">{formatTime(p.minutes)}</div>
          <div className="text-[9px] text-slate-500 uppercase">min</div>
        </div>
        <div className="bg-slate-700/50 rounded py-1.5 text-center">
          <div className="text-sm font-black text-orange-400">{p.points}</div>
          <div className="text-[9px] text-slate-500 uppercase">pts</div>
        </div>
        <div className="bg-slate-700/50 rounded py-1.5 text-center">
          <div className={`text-sm font-black ${p.plusMinus > 0 ? 'text-emerald-400' : p.plusMinus < 0 ? 'text-red-400' : 'text-slate-400'}`}>
            {p.plusMinus > 0 ? '+' : ''}{p.plusMinus}
          </div>
          <div className="text-[9px] text-slate-500 uppercase">+/-</div>
        </div>
        <div className="bg-slate-700/50 rounded py-1.5 text-center">
          <div className={`text-sm font-black ${p.fouls >= 4 ? 'text-red-400' : p.fouls >= 3 ? 'text-amber-400' : 'text-white'}`}>{p.fouls}</div>
          <div className="text-[9px] text-slate-500 uppercase">{t.foulsLabel || 'fouls'}</div>
        </div>
      </div>
      {/* Row 3: Shot breakdown — 3PT / 2PT / FT / FG total */}
      <div className="grid grid-cols-4 gap-1.5 mb-2">
        <div className="bg-slate-700/30 rounded px-1 py-1 text-center">
          <div className="text-[10px] font-bold text-indigo-300">3PT</div>
          <div className="text-xs font-bold text-white">{s3.made}/{att3}</div>
          {pct3 !== null && <div className="text-[10px] text-slate-400">{pct3}%</div>}
        </div>
        <div className="bg-slate-700/30 rounded px-1 py-1 text-center">
          <div className="text-[10px] font-bold text-blue-300">2PT</div>
          <div className="text-xs font-bold text-white">{s2.made}/{att2}</div>
          {pct2 !== null && <div className="text-[10px] text-slate-400">{pct2}%</div>}
        </div>
        <div className="bg-slate-700/30 rounded px-1 py-1 text-center">
          <div className="text-[10px] font-bold text-emerald-300">FT</div>
          <div className="text-xs font-bold text-white">{s1.made}/{att1}</div>
          {pct1 !== null && <div className="text-[10px] text-slate-400">{pct1}%</div>}
        </div>
        <div className="bg-slate-700/30 rounded px-1 py-1 text-center">
          <div className="text-[10px] font-bold text-slate-300">FG</div>
          <div className="text-xs font-bold text-white">{p.fgMade}/{p.fgAttempted}</div>
          {p.fgAttempted > 0 && <div className="text-[10px] text-slate-400">{formatPct(p.fgPct)}</div>}
        </div>
      </div>
      {/* Row 4: Best / Worst stint (if available) */}
      {p.bestStint && (
        <div className="flex justify-between text-[10px] md:text-xs text-slate-500">
          <span>{t.bestStintLabel || 'Best stint'}: {formatTime(p.bestStint.duration)} <PMBadge value={p.bestStint.plusMinus} /></span>
          {p.worstStint && (
            <span>{t.worstStintLabel || 'Worst stint'}: {formatTime(p.worstStint.duration)} <PMBadge value={p.worstStint.plusMinus} /></span>
          )}
        </div>
      )}
    </div>
  );
}

function QuintetTable({ quintets, mode, t }) {
  if (quintets.length === 0) return <p className="text-xs text-slate-500 px-2">{t.noData || 'No data'}</p>;

  return (
    <div className="space-y-2">
      {quintets.map((q, i) => (
        <div key={q.key} className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-start justify-between mb-1">
            <span className="text-xs font-bold text-slate-500">#{i + 1}</span>
            <div className="text-right">
              {mode === 'plusMinus' && <PMBadge value={q.plusMinus} size="lg" />}
              {mode === 'offense' && <span className="text-sm font-black text-orange-400">{q.offRating} pts/min</span>}
              {mode === 'defense' && <span className="text-sm font-black text-blue-400">{q.defRating} pts/min</span>}
              {mode === 'shooting' && <span className="text-sm font-black text-emerald-400">{formatPct(q.shootingPct)}</span>}
              {mode === 'threePt' && <span className="text-sm font-black text-indigo-400">{q.threePtMade}/{q.threePtAttempted} ({formatPct(q.threePtPct)})</span>}
              {mode === 'minutes' && <span className="text-sm font-black text-white">{formatTime(q.totalMinutes)}</span>}
            </div>
          </div>
          <div className="text-[11px] md:text-xs text-slate-300 leading-relaxed">{q.playerNames.join(', ')}</div>
          <div className="flex gap-3 mt-1 text-[10px] md:text-xs text-slate-500">
            <span>{formatTime(q.totalMinutes)}</span>
            <span>{q.pointsScored} {t.scored || 'scored'}</span>
            <span>{q.pointsAllowed} {t.allowed || 'allowed'}</span>
            {mode !== 'plusMinus' && <PMBadge value={q.plusMinus} />}
            {mode !== 'shooting' && mode !== 'threePt' && q.shotsAttempted > 0 && <span>FG {formatPct(q.shootingPct)}</span>}
            {mode !== 'threePt' && q.threePtAttempted > 0 && <span>3PT {q.threePtMade}/{q.threePtAttempted}</span>}
          </div>
        </div>
      ))}
    </div>
  );
}

function BestWorstStints({ playerStats, t }) {
  const allStints = [];
  playerStats.forEach(p => {
    p.stints.forEach((s, i) => {
      allStints.push({ name: p.name, number: p.number, ...s, index: i });
    });
  });

  if (allStints.length < 2) return <p className="text-xs text-slate-500 px-2">{t.noData || 'No data'}</p>;

  const best = [...allStints].sort((a, b) => b.plusMinus - a.plusMinus).slice(0, 5);
  const worst = [...allStints].sort((a, b) => a.plusMinus - b.plusMinus).slice(0, 5);

  const renderList = (stints, label, color) => (
    <div>
      <div className={`text-xs font-bold ${color} mb-1.5`}>{label}</div>
      <div className="space-y-1">
        {stints.map((s, i) => (
          <div key={`${s.number}-${s.index}`} className="flex items-center justify-between bg-slate-800 rounded px-3 py-1.5 text-xs">
            <span className="text-slate-300">#{s.number} {s.name}</span>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">{formatTime(s.duration)}</span>
              <PMBadge value={s.plusMinus} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <div className="space-y-3">
      {renderList(best, t.topStints || 'Top 5 Best Stints', 'text-emerald-400')}
      {renderList(worst, t.bottomStints || 'Top 5 Worst Stints', 'text-red-400')}
    </div>
  );
}

function FoulImpactTable({ foulImpact, t }) {
  if (foulImpact.length === 0) return <p className="text-xs text-slate-500 px-2">{t.noData || 'No data'}</p>;

  return (
    <div className="space-y-1">
      <div className="grid grid-cols-[1fr_auto_auto] gap-1 text-[10px] md:text-xs text-slate-500 px-3 mb-1">
        <span>{t.player || 'Player'}</span>
        <span className="text-center w-16">{t.onCourtPM || 'On +/-'}</span>
        <span className="text-center w-16">{t.offCourtPM || 'Off +/-'}</span>
      </div>
      {foulImpact.map(p => (
        <div key={p.id} className="grid grid-cols-[1fr_auto_auto] gap-1 bg-slate-800 rounded px-3 py-2 text-xs items-center">
          <span className="text-slate-300 truncate">#{p.number} {p.name}</span>
          <span className="text-center w-16"><PMBadge value={p.onCourtPM} /></span>
          <span className="text-center w-16"><PMBadge value={p.offCourtPM} /></span>
        </div>
      ))}
      <p className="text-[10px] md:text-xs text-slate-600 px-2 mt-1">
        {t.impactExplanation || 'Score change when this player is on court vs off court'}
      </p>
    </div>
  );
}

function StintsDetail({ playerStats, t }) {
  return (
    <div className="space-y-2">
      {playerStats.map(p => (
        <div key={p.id} className="bg-slate-800 rounded-lg p-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold text-white">#{p.number} {p.name}</span>
            <span className="text-[10px] md:text-xs text-slate-400">{p.stints.length} stints — {formatTime(p.minutes)} total</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {p.stints.map((s, i) => (
              <div key={i} className={`text-[10px] md:text-xs px-2 py-1 rounded ${s.plusMinus > 0 ? 'bg-emerald-900/40 text-emerald-400' : s.plusMinus < 0 ? 'bg-red-900/40 text-red-400' : 'bg-slate-700 text-slate-400'}`}>
                {formatTime(s.duration)} <span className="font-bold">{formatPlusMinus(s.plusMinus)}</span>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
