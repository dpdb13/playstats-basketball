import { formatTime, getQuarterLabel } from './gameUtils';
import { calculateGameStats, formatPlusMinus, formatPct } from './statsCalculator';

const esc = (str) => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
const pmClass = (v) => v > 0 ? 'positive' : v < 0 ? 'negative' : '';
const pmStr = (v) => formatPlusMinus(v);

export function generateReport(params) {
  const stats = calculateGameStats(params);
  const { playerStats, quintetStats, parcials, foulImpact, summary } = stats;

  const resultEmoji = summary.result === 'win' ? '🏆' : summary.result === 'loss' ? '😤' : '🤝';
  const resultColor = summary.result === 'win' ? '#16a34a' : summary.result === 'loss' ? '#dc2626' : '#94a3b8';

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Report - ${esc(summary.ourTeamName)} vs ${esc(summary.rivalTeamName)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#0f172a;color:#e2e8f0;padding:16px;max-width:800px;margin:0 auto;font-size:13px}
h1{color:#f97316;font-size:20px;margin-bottom:20px;text-align:center}
h2{color:#f97316;font-size:15px;margin:24px 0 10px;padding-bottom:6px;border-bottom:2px solid #334155}
.score-box{text-align:center;background:#1e293b;border-radius:12px;padding:20px;margin-bottom:20px;border:2px solid ${resultColor}}
.score{font-size:36px;font-weight:900}
.score .our{color:${resultColor}}
.score .sep{color:#475569;margin:0 8px}
.score .rival{color:#fff}
.teams{color:#94a3b8;font-size:13px;margin-top:4px}
.summary-row{display:flex;justify-content:center;gap:16px;margin-top:12px}
.stat-pill{background:#334155;border-radius:8px;padding:8px 12px;text-align:center}
.stat-pill .val{font-size:18px;font-weight:900;color:#fff}
.stat-pill .lbl{font-size:9px;color:#94a3b8;text-transform:uppercase}
table{width:100%;border-collapse:collapse;margin:8px 0}
th{background:#1e293b;color:#94a3b8;font-size:10px;text-transform:uppercase;padding:6px 8px;text-align:left;border-bottom:2px solid #334155}
td{padding:6px 8px;border-bottom:1px solid #1e293b;font-size:12px}
tr:hover{background:#1e293b}
.positive{color:#16a34a;font-weight:bold}
.negative{color:#dc2626;font-weight:bold}
.neutral{color:#94a3b8}
.right{text-align:right}
.center{text-align:center}
.bold{font-weight:bold}
.small{font-size:10px;color:#64748b}
.quintet-card{background:#1e293b;border-radius:8px;padding:12px;margin-bottom:8px}
.quintet-rank{color:#475569;font-weight:bold;font-size:11px}
.quintet-names{color:#cbd5e1;font-size:11px;margin:4px 0}
.quintet-meta{display:flex;gap:12px;font-size:10px;color:#64748b}
.section{margin-bottom:24px}
.hint{font-size:10px;color:#475569;margin-top:6px}
.footer{text-align:center;color:#475569;font-size:10px;margin-top:40px;padding-top:12px;border-top:1px solid #1e293b}
@media print{body{background:#fff;color:#333}h2{color:#f97316}.score-box{border-color:#333}th{background:#f3f4f6;color:#333}td{border-color:#e5e7eb}tr:hover{background:transparent}.quintet-card{background:#f9fafb}}
</style></head><body>
<h1>${resultEmoji} Game Report</h1>

<div class="score-box">
<div class="score"><span class="our">${summary.ourScore}</span><span class="sep">-</span><span class="rival">${summary.rivalScore}</span></div>
<div class="teams">${esc(summary.ourTeamName)} vs ${esc(summary.rivalTeamName)}</div>
<div class="summary-row">
<div class="stat-pill"><div class="val">${summary.realSubs}</div><div class="lbl">Subs</div></div>
<div class="stat-pill"><div class="val">${summary.leadChanges}</div><div class="lbl">Lead Changes</div></div>
<div class="stat-pill"><div class="val">${summary.ties}</div><div class="lbl">Ties</div></div>
</div>
${summary.biggestLead.us > 0 || summary.biggestLead.them > 0 ? `<div class="hint">Biggest lead: ${esc(summary.ourTeamName)} +${summary.biggestLead.us} / ${esc(summary.rivalTeamName)} +${summary.biggestLead.them}</div>` : ''}
</div>

<!-- PARCIALS -->
<div class="section">
<h2>⏱️ Parcials by Quarter</h2>
<table>
<tr><th></th><th class="center">1st 5'</th><th class="center">2nd 5'</th><th class="center">Quarter</th><th class="center">+/-</th></tr>
${parcials.map(q => {
  const totalCls = q.total.us > q.total.them ? 'positive' : q.total.us < q.total.them ? 'negative' : 'neutral';
  const firstCls = q.first.us > q.first.them ? 'positive' : q.first.us < q.first.them ? 'negative' : 'neutral';
  const secondCls = q.second.us > q.second.them ? 'positive' : q.second.us < q.second.them ? 'negative' : 'neutral';
  return `<tr><td class="bold">${getQuarterLabel(q.quarter)}</td><td class="center ${firstCls}">${q.first.us}-${q.first.them}</td><td class="center ${secondCls}">${q.second.us}-${q.second.them}</td><td class="center bold ${totalCls}">${q.total.us}-${q.total.them}</td><td class="center ${pmClass(q.diff)}">${pmStr(q.diff)}</td></tr>`;
}).join('')}
</table>
</div>

<!-- PLAYER STATS -->
<div class="section">
<h2>📊 Player Stats</h2>
<table>
<tr><th>Player</th><th class="center">Min</th><th class="center">Pts</th><th class="center">FG</th><th class="center">3PT</th><th class="center">2PT</th><th class="center">FT</th><th class="center">Fouls</th><th class="center">+/-</th></tr>
${playerStats.map(p => {
  const s3 = p.shotStats.pts3, att3 = s3.made + s3.missed, pct3 = att3 > 0 ? Math.round((s3.made / att3) * 100) + '%' : '';
  const s2 = p.shotStats.pts2, att2 = s2.made + s2.missed, pct2 = att2 > 0 ? Math.round((s2.made / att2) * 100) + '%' : '';
  const att1 = p.ftMade + (p.shotStats.pts1?.missed || 0), pct1 = att1 > 0 ? Math.round((p.ftMade / att1) * 100) + '%' : '';
  return `<tr>
<td class="bold">#${esc(p.number)} ${esc(p.name)}<br/><span class="small">${esc(p.position)}</span></td>
<td class="center">${formatTime(p.minutes)}</td>
<td class="center bold">${p.points}</td>
<td class="center">${p.fgMade}/${p.fgAttempted} <span class="small">${formatPct(p.fgPct)}</span></td>
<td class="center">${s3.made}/${att3}${pct3 ? ` <span class="small">${pct3}</span>` : ''}</td>
<td class="center">${s2.made}/${att2}${pct2 ? ` <span class="small">${pct2}</span>` : ''}</td>
<td class="center">${p.ftMade}/${p.ftAttempted}${pct1 ? ` <span class="small">${pct1}</span>` : ''}</td>
<td class="center">${p.fouls}</td>
<td class="center ${pmClass(p.plusMinus)}">${pmStr(p.plusMinus)}</td>
</tr>`;
}).join('')}
</table>
</div>

<!-- QUINTETS BY +/- -->
<div class="section">
<h2>📈 Lineups by +/-</h2>
${renderQuintets(quintetStats.byPlusMinus, 'plusMinus')}
</div>

<!-- BEST OFFENSIVE -->
<div class="section">
<h2>🎯 Best Offensive Lineups (pts/min)</h2>
${renderQuintets(quintetStats.byOffense, 'offense')}
</div>

<!-- BEST DEFENSIVE -->
<div class="section">
<h2>🛡️ Best Defensive Lineups (pts allowed/min)</h2>
${renderQuintets(quintetStats.byDefense, 'defense')}
</div>

<!-- SHOOTING -->
${quintetStats.byShooting.length > 0 ? `<div class="section">
<h2>🎯 Lineups by Shooting %</h2>
${renderQuintets(quintetStats.byShooting, 'shooting')}
</div>` : ''}

<!-- QUINTETS BY MINUTES -->
<div class="section">
<h2>⏱️ Lineups by Minutes</h2>
${renderQuintets(quintetStats.byMinutes, 'minutes')}
</div>

<!-- BEST/WORST STINTS -->
<div class="section">
<h2>📊 Best & Worst Individual Stints</h2>
${renderBestWorstStints(playerStats)}
</div>

<!-- PLAYER IMPACT -->
<div class="section">
<h2>⚠️ Player Impact (On Court vs Off Court)</h2>
<table>
<tr><th>Player</th><th class="center">On Court +/-</th><th class="center">Off Court +/-</th></tr>
${foulImpact.map(p => `<tr>
<td class="bold">#${esc(p.number)} ${esc(p.name)}${p.fouls > 0 ? ` <span class="small">(${p.fouls}F)</span>` : ''}</td>
<td class="center ${pmClass(p.onCourtPM)}">${pmStr(p.onCourtPM)}</td>
<td class="center ${pmClass(p.offCourtPM)}">${pmStr(p.offCourtPM)}</td>
</tr>`).join('')}
</table>
<div class="hint">Score change when this player is on court vs off court.</div>
</div>

<!-- PLAYER STINTS -->
<div class="section">
<h2>🔄 Player Stints Detail</h2>
<table>
<tr><th>Player</th><th class="center">Stints</th><th>Duration → +/-</th><th class="center">Total</th></tr>
${playerStats.map(p => `<tr>
<td class="bold">#${esc(p.number)} ${esc(p.name)}</td>
<td class="center">${p.stints.length}</td>
<td class="small">${p.stints.map(s => `${formatTime(s.duration)} (<span class="${pmClass(s.plusMinus)}">${pmStr(s.plusMinus)}</span>)`).join(' → ')}</td>
<td class="center">${formatTime(p.minutes)}</td>
</tr>`).join('')}
</table>
</div>

<div class="footer">
PlayStats Basketball — ${new Date().toLocaleString()}
</div>
</body></html>`;

  // Download
  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  const safeName = (name) => (name || 'Team').replace(/[^a-zA-Z0-9_ -]/g, '_');
  link.download = `report-${safeName(summary.ourTeamName)}-vs-${safeName(summary.rivalTeamName)}-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// Helper: render quintet cards
function renderQuintets(quintets, mode) {
  if (quintets.length === 0) return '<div class="small">No data</div>';
  return quintets.map((q, i) => {
    let highlight = '';
    if (mode === 'plusMinus') highlight = `<span class="${pmClass(q.plusMinus)}" style="font-size:16px">${pmStr(q.plusMinus)}</span>`;
    else if (mode === 'offense') highlight = `<span style="color:#f97316;font-size:14px;font-weight:bold">${q.offRating} pts/min</span>`;
    else if (mode === 'defense') highlight = `<span style="color:#3b82f6;font-size:14px;font-weight:bold">${q.defRating} pts/min</span>`;
    else if (mode === 'shooting') highlight = `<span style="color:#16a34a;font-size:14px;font-weight:bold">${formatPct(q.shootingPct)}</span> (${q.shotsMade}/${q.shotsAttempted})`;
    else if (mode === 'minutes') highlight = `<span style="color:#fff;font-size:14px;font-weight:bold">${formatTime(q.totalMinutes)}</span>`;

    return `<div class="quintet-card">
<div style="display:flex;justify-content:space-between;align-items:center">
<span class="quintet-rank">#${i+1}</span>${highlight}
</div>
<div class="quintet-names">${q.playerNames.map(n => esc(n)).join(', ')}</div>
<div class="quintet-meta">
<span>${formatTime(q.totalMinutes)}</span>
<span>${q.pointsScored} scored</span>
<span>${q.pointsAllowed} allowed</span>
${mode !== 'plusMinus' ? `<span class="${pmClass(q.plusMinus)}">${pmStr(q.plusMinus)}</span>` : ''}
</div></div>`;
  }).join('');
}

// Helper: best/worst stints
function renderBestWorstStints(playerStats) {
  const allStints = [];
  playerStats.forEach(p => {
    p.stints.forEach((s, i) => {
      allStints.push({ name: `#${esc(p.number)} ${esc(p.name)}`, ...s, idx: i });
    });
  });
  const best = [...allStints].sort((a, b) => b.plusMinus - a.plusMinus).slice(0, 5);
  const worst = [...allStints].sort((a, b) => a.plusMinus - b.plusMinus).slice(0, 5);

  const renderList = (stints, label, color) => `
<div style="margin-bottom:12px">
<div style="color:${color};font-weight:bold;font-size:12px;margin-bottom:6px">${label}</div>
<table><tr><th>Player</th><th class="center">Duration</th><th class="center">+/-</th></tr>
${stints.map(s => `<tr><td>${s.name}</td><td class="center">${formatTime(s.duration)}</td><td class="center ${pmClass(s.plusMinus)}">${pmStr(s.plusMinus)}</td></tr>`).join('')}
</table></div>`;

  return renderList(best, '🟢 Top 5 Best Stints', '#16a34a') + renderList(worst, '🔴 Top 5 Worst Stints', '#dc2626');
}
