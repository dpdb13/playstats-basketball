import { formatTime } from './gameUtils';

const escapeHtml = (str) => String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

/**
 * Genera un reporte HTML del partido y lo descarga como archivo.
 *
 * @param {Object} params
 * @param {number} params.ourScore - Puntos de nuestro equipo
 * @param {number} params.rivalScore - Puntos del rival
 * @param {string} params.ourTeamName - Nombre de nuestro equipo
 * @param {string} params.rivalTeamName - Nombre del rival
 * @param {Array} params.players - Array de jugadores con sus stats
 * @param {Array} params.quintetHistory - Historial de quintetos
 * @param {Object} params.substitutionsByQuarter - Sustituciones por cuarto
 */
export function generateReport({ ourScore, rivalScore, ourTeamName, rivalTeamName, players, quintetHistory, substitutionsByQuarter }) {
  const playersWithCurrentStint = players.map(p => {
    if (p.onCourt && p.currentStintStart) {
      const currentPM = (ourScore - p.currentStintStart.ourScore) - (rivalScore - p.currentStintStart.rivalScore);
      return {
        ...p,
        stints: [...p.stints, p.currentMinutes],
        stintPlusMinus: [...p.stintPlusMinus, currentPM]
      };
    }
    return p;
  });

  const quintetStats = {};
  quintetHistory.forEach(q => {
    if (!quintetStats[q.key]) {
      quintetStats[q.key] = { playerIds: q.playerIds, totalTime: 0, totalPointsScored: 0, totalPointsAllowed: 0, occurrences: 0 };
    }
    quintetStats[q.key].totalTime += q.duration;
    quintetStats[q.key].totalPointsScored += q.pointsScored;
    quintetStats[q.key].totalPointsAllowed += q.pointsAllowed;
    quintetStats[q.key].occurrences += 1;
  });

  const quintetArray = Object.values(quintetStats).map(q => ({
    ...q,
    differential: q.totalPointsScored - q.totalPointsAllowed,
    playerNames: q.playerIds.map(id => {
      const p = players.find(pl => pl.id === id);
      return p ? `#${escapeHtml(p.number)} ${escapeHtml(p.name)}` : 'Unknown';
    })
  }));

  const byTime = [...quintetArray].sort((a, b) => b.totalTime - a.totalTime);
  const byDifferential = [...quintetArray].sort((a, b) => b.differential - a.differential);

  const playerStintStats = playersWithCurrentStint.filter(p => p.position !== 'Unselected' && p.stints.length > 0).map(p => {
    const totalPM = p.stintPlusMinus.reduce((a, b) => a + b, 0);
    return {
      name: `#${escapeHtml(p.number)} ${escapeHtml(p.name)}`,
      position: escapeHtml(p.position),
      stintCount: p.stints.length,
      stints: p.stints,
      avgStint: p.stints.reduce((a, b) => a + b, 0) / p.stints.length,
      totalTime: p.stints.reduce((a, b) => a + b, 0),
      totalPlusMinus: totalPM
    };
  });

  const totalSubs = Object.values(substitutionsByQuarter).reduce((a, b) => a + b, 0);
  const realSubs = Math.max(0, totalSubs - 5);

  const safeOurTeamName = escapeHtml(ourTeamName);
  const safeRivalTeamName = escapeHtml(rivalTeamName);

  const htmlContent = `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Report - ${safeOurTeamName} vs ${safeRivalTeamName}</title>
<style>
body{font-family:Arial,sans-serif;padding:20px;color:#333;font-size:12px;max-width:900px;margin:0 auto}
h1{color:#f97316;border-bottom:3px solid #f97316;padding-bottom:10px;font-size:24px}
h2{color:#3b82f6;margin-top:30px;border-bottom:2px solid #3b82f6;padding-bottom:5px;font-size:16px}
table{width:100%;border-collapse:collapse;margin:15px 0;font-size:11px}
th,td{border:1px solid #ddd;padding:8px;text-align:left}
th{background-color:#1f2937;color:white}
tr:nth-child(even){background-color:#f3f4f6}
.score-box{display:inline-block;padding:15px 25px;background:linear-gradient(135deg,#1f2937,#374151);color:white;border-radius:10px;margin:5px;font-size:28px;font-weight:bold}
.positive{color:#16a34a;font-weight:bold}
.negative{color:#dc2626;font-weight:bold}
.section{margin-bottom:30px}
.stat-box{display:inline-block;background:#f3f4f6;padding:15px 20px;border-radius:8px;margin:10px;text-align:center}
.stat-value{font-size:28px;font-weight:bold;color:#1f2937}
.stat-label{font-size:11px;color:#6b7280;text-transform:uppercase;margin-top:5px}
.stint-times{font-size:10px;color:#666}
@media print{.section{page-break-inside:avoid}}
</style></head><body>
<h1>🏀 Game Report</h1>
<div style="text-align:center;margin:20px 0">
<div class="score-box">${safeOurTeamName}<br/>${ourScore}</div>
<span style="font-size:24px;margin:0 15px;vertical-align:middle">VS</span>
<div class="score-box">${safeRivalTeamName}<br/>${rivalScore}</div>
</div>
<div style="text-align:center;margin:30px 0">
<div class="stat-box">
<div class="stat-value">${realSubs}</div>
<div class="stat-label">Cambios en el partido</div>
</div>
</div>
<div class="section">
<h2>👥 Quintetos - Tiempo compartido en pista</h2>
<table>
<tr><th>#</th><th>Jugadores</th><th>Tiempo juntos</th></tr>
${byTime.map((q,i)=>`<tr><td>${i+1}</td><td>${q.playerNames.join(', ')}</td><td><strong>${formatTime(q.totalTime)}</strong></td></tr>`).join('')}
</table>
</div>
<div class="section">
<h2>📊 Quintetos - +/- en pista</h2>
<table>
<tr><th>#</th><th>Jugadores</th><th>Tiempo</th><th>A favor</th><th>En contra</th><th>+/-</th></tr>
${byDifferential.map((q,i)=>`<tr><td>${i+1}</td><td>${q.playerNames.join(', ')}</td><td>${formatTime(q.totalTime)}</td><td>${q.totalPointsScored}</td><td>${q.totalPointsAllowed}</td><td class="${q.differential>=0?'positive':'negative'}" style="font-size:14px">${q.differential>=0?'+':''}${q.differential}</td></tr>`).join('')}
</table>
</div>
<div class="section">
<h2>⏱️ Stints por jugador</h2>
<table>
<tr><th>Jugador</th><th>Pos</th><th>Nº Stints</th><th>Duración de cada stint</th><th>Media</th><th>Total</th></tr>
${playerStintStats.sort((a,b)=>b.totalTime-a.totalTime).map(p=>`<tr><td><strong>${p.name}</strong></td><td>${p.position}</td><td style="text-align:center">${p.stintCount}</td><td class="stint-times">${p.stints.map(s => formatTime(s)).join(' → ')}</td><td><strong>${formatTime(p.avgStint)}</strong></td><td>${formatTime(p.totalTime)}</td></tr>`).join('')}
</table>
</div>
<div style="margin-top:40px;text-align:center;color:#9ca3af;font-size:11px;border-top:1px solid #e5e7eb;padding-top:15px">
<p>Basketball Rotation Tracker - ${new Date().toLocaleString()}</p>
</div>
</body></html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `report-${ourTeamName}-vs-${rivalTeamName}-${new Date().toISOString().split('T')[0]}.html`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
