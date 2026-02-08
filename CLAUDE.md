# Basketball Rotation App

## Proceso de trabajo
- **Antes de empezar una fase nueva:** SIEMPRE revisar la página de Notion (PlayStats App) por si Diego ha dejado comentarios, notas o cambios entre sesiones. Notion page ID: `300f1a9a-784a-805b-b6ab-daa25dd098b9`
- **Durante el trabajo:** Documentar avances en Notion (Development Log) además de en CLAUDE.md
- **Decisión de negocio:** Construir todo completo, decidir boundaries freemium después

## Qué es esta app
App para gestionar rotaciones de jugadores de baloncesto durante un partido. Diseñada para ayudar al entrenador a:
- Controlar cuánto tiempo lleva cada jugador en pista y en banquillo
- Gestionar las faltas de cada jugador
- Recibir recomendaciones automáticas de cambios
- Llevar el marcador con parciales por cuarto
- Generar reportes del partido

## Tecnologías
- **React** - librería de JavaScript para crear interfaces
- **Tailwind CSS** - para los estilos (los `className` con cosas como `bg-blue-600`)
- **Lucide React** - iconos (Clock, Users, Play, etc.)

## Estado actual del código
- **Componente principal:** `BasketballRotationTracker.jsx` (~2,200 líneas)
- **Archivos extraídos:**
  - `src/lib/gameUtils.js` - funciones de utilidad (formatTime, getFoulStatus, posiciones configurables, etc.)
  - `src/components/PlayerCard.jsx` - componente de tarjeta de jugador (con vista compacta y expandida)
  - `src/lib/generateReport.js` - generación de reportes HTML
  - `src/i18n/translations.js` - traducciones EN/ES (~145+ keys)
  - `src/context/LanguageContext.jsx` - context + hook useTranslation()
  - `src/hooks/useSwipeGesture.js` - detección de swipe horizontal (ya no se usa en tracker, mantenido por si acaso)
- **Guardado:** Solo Supabase (via `onGameSaved` + `syncManager`). El localStorage legacy fue eliminado.
- **Modales:** Unificados en un solo `activeModal` useState (valores: null, 'exit', 'reset', 'quarter', 'intervals', 'score', 'foul', 'fouledOut', 'freeThrowPlayer', 'freeThrowCount', 'freeThrowMade') + `pendingReplacement` separado para modal de reemplazo
- **PWA (Progressive Web App)** - Se puede instalar como app en móvil
- **Desplegada en:** https://dpdb13.github.io/playstats-basketball/
- **Nombre oficial:** PlayStats Basketball
- **Service Worker:** Auto-actualización implementada (detecta nueva versión y recarga automáticamente)
- **Cache actual:** `basketball-rotation-v35`
- **Manifest:** `orientation: "any"` (permite horizontal y vertical)
- **History API:** pushState/popstate para navegación nativa de back en iOS/Android
- **Supabase schema:** Columna `team_settings JSONB` en tabla `teams` para posiciones configurables

## Funcionalidades implementadas

### Gestión de jugadores
- 12 jugadores predefinidos con nombre, número y posición
- **Posiciones configurables:** cada equipo define sus posiciones en `team_settings.positions` (default: Base, Alero, Joker)
  - Editor de posiciones en TeamDetail (solo owner): añadir, renombrar, eliminar posiciones
  - Colores dinámicos por posición (8 colores predefinidos, rotan cíclicamente)
  - `getTeamPositions(team)` en gameUtils.js como fuente única
  - Supabase: `teams.team_settings JSONB DEFAULT '{}'`
- **Posiciones secundarias:** cada jugador puede tener posiciones extra (ej: Joker que también juega de Alero)
  - Se configuran en el editor del equipo con botones toggle
  - Se guardan en Supabase como `secondary_positions text[]`
  - Null safety: `player.secondary_positions || []` en toda la app
- Se pueden editar nombre, número, posición y posiciones secundarias de cada jugador

### Control de tiempo
- Tiempo de partido con cronómetro (10 min por cuarto)
- Tiempo en pista de cada jugador (stint actual)
- Tiempo total en pista y en banquillo
- Sistema de colores (verde/amarillo/rojo) según tiempo en pista o banquillo

### Sistema de faltas
- Contador de faltas por jugador (máximo 5)
- **Editor inline de faltas (+/-):** popover pequeño al pulsar en las faltas de un jugador
  - Se cierra automáticamente a los 3 segundos o al pulsar fuera
  - Popover se abre hacia arriba para no salirse de la pantalla
- **Modal de faltas (campana):** para añadir falta rápida durante el juego (llama a `adjustFouls` internamente)
- `adjustFouls` es la función única para toda la lógica de faltas (incluido fouled out)
- Alertas visuales según cuarto:
  - Q1: 0 faltas = safe, 1 = warning, 2+ = danger
  - Q2: 0-1 = safe, 2 = warning, 3+ = danger
  - Q3-Q4: 0-2 = safe, 3 = warning, 4 = danger
- Cuando llega a 5 faltas: "fouled out" automático

### Marcador
- Marcador con equipos editables
- Parciales por cuarto (dividido en dos mitades de 5 min)
- Puntos individuales de cada jugador
- Botones 3 PTS / 2 PTS / 1 PT con colores suaves
- **Flujo made/missed:** seleccionar puntos → seleccionar jugador → ✓ MADE / ✗ MISSED
  - MISSED no suma puntos pero registra en eventLog (type: 'miss') e incrementa `missedShots` + `shotStats`
  - MADE suma puntos y registra con subtype: 'made' + actualiza `shotStats`
  - Rival: Made/Missed flow (antes era directo), registra 'miss' en eventLog
- **Shot stats por tipo:** `shotStats: { pts3: { made, missed }, pts2: { made, missed }, pts1: { made, missed } }` en playerState
  - Se actualiza en `addPoints`, `addFreeThrows`, y se revierte en undo
  - Visible en PlayerCard expandida como "3PT 3/4, 2PT 1/2, 1PT 0/0"
- **Colores de equipo:** 10 colores con clases Tailwind completas (bg, border, text, ring)
  - `TEAM_COLORS` array + `getTeamColor()` en gameUtils.js
  - Wizard de creación de partido: Home/Away → color equipo → nombre rival → color rival
  - Colores dinámicos en scoreboard, botones de score modal

### Recomendaciones de cambio
- Detecta jugadores que llevan mucho tiempo en pista (rojo)
- Detecta jugadores con problemas de faltas
- **Split de recomendaciones:** misma posición se muestra directamente, cross-position en toggle colapsable con badge
- Sugiere reemplazos de la misma posición
- **Posiciones secundarias:** sugiere jugadores cuya `secondary_positions` incluya la posición necesaria
  - Guardia: solo sugiere si hay otro jugador de su posición primaria en banquillo sin problemas de faltas (el tiempo se ignora)
  - Texto dinámico: `⚠️ Joker→Alero` (o cualquier combinación)
  - Funciona tanto en recomendaciones normales como en el modal de fouled out
  - Ya no hay nombres hardcodeados (era `flexibleJokers = ['Jorge', 'Unai']`)

### Modal de reemplazo
- Al sacar un jugador con 5 en pista → modal "¿Quién entra?" con jugadores de banquillo
- Ordenados: misma posición primero → posición secundaria → resto
- Colores: verde (misma pos), azul (secundaria), gris (resto)
- Botón SKIP para cerrar sin meter a nadie

### Navegación
- **History API:** pushState/popstate para back nativo en iOS/Android
- En partido, gesto back muestra modal de salida (no navega directamente)
- Swipe custom eliminado del tracker (conflicto con gestos nativos)

### Reportes
- Genera HTML descargable con:
  - Resultado final
  - Estadísticas de quintetos (tiempo juntos, +/-)
  - Stints de cada jugador

### Múltiples partidos
- Cada partido se guarda con un ID único en Supabase
- Gestión de partidos via TeamDetail (no hay pantalla HOME/HISTORY legacy)
- **Salir de un partido:** Botón ⊗ muestra opciones de guardar/finalizar

### Otras funcionalidades
- Deshacer última acción
- Reset completo (mantener pulsado) - elimina el partido actual
- Configurar intervalos de tiempo para alertas

## Jugadores
- Ya no hay jugadores hardcoded en el código
- Los jugadores vienen del prop `initialPlayers` (desde Supabase/TeamDetail)

## Visión de producto (definida 7 febrero 2026)

PlayStats Basketball va a convertirse en un **producto comercial** para entrenadores de baloncesto.

### Propuesta de valor única (USP)
> "PlayStats es el asistente de rotaciones inteligente para entrenadores de basket. No solo trackea tiempo - te dice a quién cambiar, por quién, y por qué."

Ninguna app combina: recomendaciones inteligentes + faltas contextuales por cuarto + posiciones secundarias con guardia de cobertura + análisis de quintetos con +/-. Eso es nuestro diferenciador.

### Target market
- **Primario:** Canteras de baloncesto en España (~12,000-16,000 equipos)
- **Secundario:** Amateur adulto (ligas municipales, corporate)
- **Terciario:** Mercado anglosajón (USA ~500,000 equipos youth basketball)

### Modelo de negocio: Freemium
| | Gratis | Pro ($5/mes) | Club ($10/mes) |
|---|---|---|---|
| Equipos | 1 | Ilimitados | Ilimitados |
| Partidos guardados | 5 | Ilimitados | Ilimitados |
| Dashboard temporada | No | Sí | Sí |
| Reportes avanzados | No | Sí | Sí |
| Vista padres | No | No | Sí |
| Compartir WhatsApp | No | No | Sí |
| Planificador rotaciones | No | No | Sí |

### Competencia principal
- **SubTime** (~$5/mes): 50K coaches, rotaciones pero SIN recomendaciones inteligentes
- **GameChanger** (gratis coaches): #1 en USA, scoring+streaming pero SIN rotaciones
- **iScore**: Stats detalladas pero complejo y SIN recomendaciones
- **TeamSnap** ($10-15/mes): Gestión completa pero genérico multi-deporte

---

## Decisiones estratégicas (7 febrero 2026)

### Idioma
- Cambiar toda la UI a **inglés** (actualmente mezcla español/inglés)
- Preparar estructura para i18n futuro

### Posiciones configurables
- Cambiar Base/Alero/Joker por sistema configurable por equipo
- Cada equipo define: número de posiciones, nombre de cada una
- Los jugadores se configuran según las posiciones de su equipo
- Por defecto ofrecer las 5 estándar (PG, SG, SF, PF, C)

### Vista dual durante partido
- **Vista compacta** (por defecto): para registrar datos rápido. Solo lo esencial: nombre + stint actual + color semáforo + botón IN/OUT
- **Vista expandida** (botón toggle): para analizar mid-game. Todos los datos visibles + stats
- **Botón de volver** a vista compacta desde la expandida

### Dos modos de stats (futuro)
- **Modo Simplificado** (actual + mejoras): puntos, faltas, tiempo, rotaciones, recomendaciones
- **Modo Avanzado** (Fase 5): asistencias, rebotes, tiros fallados, tipo de jugada (juego libre, contraataque, transición, jugada de equipo...)
- El modo avanzado es diferenciador vs iScore porque combina stats detalladas CON recomendaciones inteligentes

### Arquitectura: eventLog desde el día 1
Implementar un registro de eventos con timestamp desde la Fase 0, preparado para el modo avanzado futuro:
```javascript
{
  timestamp: Date.now(),       // momento exacto
  gameTime: 342,               // segundos del reloj
  quarter: 2,                  // cuarto
  type: "score",               // score | foul | assist | rebound | miss | turnover...
  team: "home",                // home | away
  playerId: "uuid-xxx",        // quién (UUID de Supabase)
  assistById: null,            // futuro: quién asistió
  value: 2,                    // puntos (para score)
  playType: null,              // futuro: fastbreak | setplay | transition...
  lineupOnCourt: ["uuid1", "uuid2", ...],  // quinteto en pista en ese momento
}
```
Cada evento vinculado al quinteto que estaba jugando → permite correlaciones potentísimas en el futuro.

### Código primero
- TypeScript + tests ANTES de features nuevas
- Calidad de código es prioridad sobre velocidad de shipping

---

## Roadmap (definido 7 febrero 2026)

### Fase 0: "Arreglar lo roto" (1 semana)
- [ ] **BUG-1 CRÍTICO:** `secondary_positions` no llega al tracker (`App.jsx:17-23`). Las recomendaciones cross-position NO FUNCIONAN.
- [ ] **BUG-2:** IDs son índices numéricos, no UUIDs de Supabase (`App.jsx:17`). Datos históricos se corrompen si cambia el roster.
- [ ] **BUG-7:** Undo no restaura `lastToggle`, `totalCourtTime`, `totalBenchTime`, `stints`, `stintPlusMinus`
- [ ] **BUG-3:** `setGameRunning(false)` dentro de `setGameTime` updater (React 19 batching)
- [ ] Implementar `eventLog[]` con estructura preparada para modo avanzado
- [ ] Agregar `version` al `game_data` para migraciones futuras
- [ ] Eliminar `App.css` (código muerto del template Vite)

### Fase 2: "Que parezca un producto" (UI/UX) — antes de Fase 1
- [ ] Rediseño de paleta: reducir a 5-6 colores con sistema coherente
- [ ] Botones: mínimo 44px (Apple HIG), botones críticos 56-72px
- [ ] Marcador sticky arriba con tipografía grande (`text-4xl md:text-5xl`)
- [ ] Reordenar secciones: Marcador → Jugadores en pista → Recomendaciones → Banquillo
- [ ] PlayerCard compacta (vista dual: compacta ↔ expandida)
- [ ] Sección de faltas colapsable (solo mostrar cuando hay warning/danger)
- [ ] Recomendaciones compactas: una línea por recomendación
- [ ] Unificar idioma a inglés
- [ ] Animaciones en modales (fade + slide)
- [ ] Posiciones configurables (número, nombre, asignación por jugador)
- [ ] Formato de partido configurable (duración cuartos, máx faltas)

### Fase 1: "El reporte que ya deberías tener" (reporting)
- [ ] Puntos por jugador en el reporte (dato ya existe)
- [ ] Faltas por jugador en el reporte (dato ya existe)
- [ ] +/- individual por jugador (sumar `stintPlusMinus`, dato ya existe)
- [ ] Parciales por cuarto (dato ya existe en `partialScores`)
- [ ] Scores por cuarto (dato ya existe en `scoresByQuarter`)
- [ ] Cambios de líder, empates, mayor ventaja (datos ya existen)
- [ ] Net rating por lineup: `(pointsScored - pointsAllowed) / duration * 10`
- [ ] Eficiencia ofensiva/defensiva por quinteto
- [ ] Historial de rotaciones (timeline visual)
- [ ] Correlación stint duration vs rendimiento

### Fase 3: "Listo para vender" (comercialización)
- [ ] Migrar a TypeScript
- [ ] Tests para lógica crítica (faltas, recomendaciones, quintetos, parciales)
- [ ] Descomponer BasketballRotationTracker en hooks: `useGameTimer`, `usePlayerManagement`, `useScoring`, `useSubstitutionRecommendations`, `useGamePersistence`, `useQuintets`
- [ ] Sistema de errores/notificaciones visible (toasts)
- [ ] Onboarding wizard (3 pantallas + tooltips)
- [ ] Dashboard de temporada básico
- [ ] Compartir reporte por link
- [ ] Landing page profesional
- [ ] Recomendaciones mejoradas: considerar marcador para urgencia, contexto de cuarto (atenuar últimos 2 min)

### Fase 4: "Motor de crecimiento" (guardar para después)
- [ ] Vista para padres (link individual por jugador, solo lectura)
- [ ] Compartir por WhatsApp (resumen formateado)
- [ ] Alertas sonoras/vibración cuando jugador pasa a rojo
- [ ] Planificador de rotaciones pre-partido
- [ ] Sistema de suscripciones (Stripe, tabla plans, límites por tier)
- [ ] Roles granulares: owner, coach, assistant, viewer
- [ ] Tabla `player_game_stats` desnormalizada para queries cross-game
- [ ] App Store / Play Store (TWA o React Native wrapper)

### Fase 5: "Modo avanzado" (guardar para después)
- [ ] Asistencias (¿quién dio el pase?)
- [ ] Rebotes (ofensivo/defensivo)
- [ ] Tiros fallados (con tipo de tiro)
- [ ] Tipo de jugada (juego libre, jugada de equipo, contraataque, transición)
- [ ] Toggle simplificado/avanzado por equipo
- [ ] Todo correlacionado con quinteto en pista via eventLog

---

## Bugs conocidos (encontrados 7 febrero 2026 por Agent Team)

### CRÍTICOS
1. **BUG-1:** `secondary_positions` se pierde en `getPlayersForTracker()` (`App.jsx:17-23`). Las recomendaciones cross-position están rotas.
2. **BUG-2:** IDs de jugadores son `index + 1` en vez de UUIDs de Supabase (`App.jsx:17`). Corrompe datos históricos si cambia orden del roster.

### MEDIOS
3. **BUG-3:** `setGameRunning(false)` dentro de `setGameTime` updater — comportamiento inconsistente en React 19 batching (`BasketballRotationTracker.jsx:354-359`)
4. **BUG-4:** Race condition en autoguardado — puede guardar estado intermedio (`BasketballRotationTracker.jsx:218-230`)
5. **BUG-7:** Undo no restaura `lastToggle`, tiempos acumulados ni `stintPlusMinus` (`BasketballRotationTracker.jsx:844-863`)

### BAJOS
6. **BUG-5:** Doble escritura en `beforeunload` (Supabase + localStorage queue) — duplicados posibles (`BasketballRotationTracker.jsx:254-277`)
7. **BUG-6:** Tiempos no se actualizan al instante al pausar — fracción de segundo no contabilizada
8. **BUG-8:** `courtWarning` no se auto-cierra

### PWA
9. **SW-1:** Posible doble recarga al actualizar (dos mecanismos: statechange + controllerchange)
10. **SW-2:** `start_url` en manifest es `"./"` — debería ser `/playstats-basketball/` explícito
11. **SW-3:** Service Worker cachea respuestas sin filtrar tipo (puede cachear respuestas opacas)

---

## Problemas de eficiencia conocidos
- **EFI-1:** Componente principal ~1,714 líneas con ~30 estados (resolver en Fase 3 con hooks)
- **EFI-2:** `PlayerCard` con `React.memo` se invalida por `editForm` cambiando en cada keystroke
- **EFI-4:** Autoguardado envía estado completo cada 5s (no hay diff/delta)

---

## Notas de arquitectura para escalar
- Supabase schema ya soporta multi-equipo básico (teams → team_members → team_players + games con RLS)
- RLS policies hacen subquery que puede ser lento a escala → añadir índice en `team_members(user_id, team_id)`
- `game_data` JSONB no permite queries por contenido → necesita tabla `player_game_stats` desnormalizada (Fase 4)
- Función `get_team_by_invite_code` existe en Supabase pero no está en `supabase-schema.sql` versionado

## Historial de conversaciones

### 8 febrero 2026 - Sesión 16: FT Flow + Cancel + Score Display + Team Positions v35
- **Flujo FT reordenado**: 1PT → ¿Quién? → ¿Cuántos Free Throws? → ¿Cuántos anotó? (colores neutros slate, no verde/rojo)
- **Nuevo modal**: `freeThrowMade` añadido al sistema de `activeModal`
- **Botón Cancel**: añadido junto a Back en todos los pasos del flujo de scoring y FT. `cancelScoring()` helper resetea todo
- **Score display en TeamDetail**: nombres de equipo en `text-slate-300` (muted), marcadores en `font-black text-white` (prominent)
- **Partidos finalizados**: nombres con opacidad reducida del color victoria/derrota, scores con color completo
- **Editor de posiciones en creación de equipo**: inline en TeamsList con barras de color, add/remove/rename
- **`createTeam()` actualizado**: acepta `positions` opcional, guarda en `team_settings.positions` via UPDATE separado (INSERT no acepta columnas añadidas con ALTER TABLE)
- **Jugadores distribuidos round-robin** entre las posiciones elegidas al crear equipo
- **"Free Throws" capitalizado** en EN y ES (basketball term)
- **Bug fix**: Supabase INSERT rechazaba `team_settings` → separado en INSERT + UPDATE
- **Lección aprendida**: PostgREST INSERT puede fallar con columnas añadidas por ALTER TABLE aunque UPDATE funcione → siempre INSERT básico + UPDATE separado
- Traducciones: +2 keys (teamPositions, Free Throws capitalizado)
- QA: 2 reviews Opus adversarial, 0 bugs funcionales en primera, 1 bug DB en segunda (corregido)
- Cache v32→v35, desplegado a GitHub Pages

### 8 febrero 2026 - Sesión 15: Color Picker + Shot Stats + Rival Made/Missed + PlayerCard v28

**3 agentes Opus en paralelo + 1 agente QA Opus adversarial:**

**Nuevas features (4):**
1. **Game creation wizard 4 pasos:** Home/Away → color picker (10 colores) → nombre rival (opcional) → color rival
2. **Shot stats por tipo:** 3PT/2PT/1PT made+missed por jugador, con `shotStats` en `createInitialPlayerState`
3. **Rival made/missed:** flujo de 2 pasos para scoring del rival (antes era directo)
4. **PlayerCard rediseño:**
   - Compacta: quitados foul dots (solo número)
   - Expandida: shot breakdown "3PT 3/4, 2PT 1/2, 1PT 0/0", altura uniforme, sin tiempos

**QA adversarial (13 issues: 3 CRITICAL, 6 MEDIUM, 4 LOW):**
- CRITICAL: undo no revertía shotStats para score, miss y FT → arreglado
- MEDIUM: confirmReset no reseteaba nuevos estados → arreglado
- MEDIUM: undo rivalMiss sin handler → arreglado
- MEDIUM: miss actionHistory no guardaba points → arreglado
- MEDIUM: createNewGame legacy sin colores en initialState → arreglado
- MEDIUM: createNewGameWithColors no reseteaba setupOurColor/setupRivalColor → arreglado

**Archivos:** 6 modificados, 613 insertions, 109 deletions
**Cache:** v27 → v28, desplegado a GitHub Pages
**Notion:** actualizado con Development Log

**Nuevos estados:** setupStep, setupIsHome, setupOurColor, setupRivalColor, setupRivalName, ourTeamColorId, rivalTeamColorId, rivalScoringStep
**Nuevo export gameUtils:** TEAM_COLORS (10 colores), getTeamColor()
**Nuevo campo playerState:** shotStats: { pts3: {made,missed}, pts2: {made,missed}, pts1: {made,missed} }
**24 nuevas translation keys** (EN/ES): color picker, shot stats, rival scoring, color names

---

### 8 febrero 2026 - Sesión 14: Feature Batch v27 (11 features + QA)

**4 agentes Opus en paralelo + 1 agente Opus QA adversarial:**
- 11 features implementadas: FT flow, paleta naranja/sky, PlayerCard compacta+expandida, double-tap edit, per-section expand, sub recs per-player, team name auto-fill, game metadata editing, collapsible game sections, "Who's shooting?" text
- QA encontró 7 issues (3 CRITICAL): INITIAL_PARTIAL_SCORES mutable, labels hardcodeados, shot % incorrecto, placeholder español, dead prop, fecha errónea en modal
- Todos arreglados antes de deploy
- 24 nuevas translation keys (EN/ES)
- 6 archivos modificados, 722 insertions, 194 deletions
- Cache v27, desplegado a GitHub Pages
- Notion actualizado con Development Log

**Paleta nueva:**
- Home: azul oscuro → naranja marca (orange-500/800)
- Away: rojo oscuro → azul cielo (sky-500/800)
- 3PT: naranja → índigo (evitar conflicto con marca)
- Todos los botones: -700 → -500 (más suaves)

**Nuevos modales:** freeThrowCount, freeThrowPlayer
**Nuevos estados:** courtExpanded, benchExpanded, freeThrowCount, expandedCrossPosition
**Prop nuevo:** teamName (App→Tracker)

---

### 8 febrero 2026 - Sesión 13: Peer Review exhaustivo con Agent Teams Opus (28 fixes)

**Agent Teams adversarial review (3 agentes Opus: qa-bugs, ux-i18n, code-quality):**
- Revisión exhaustiva de 5,509 líneas en 21 archivos
- 28 issues únicos encontrados: 5 CRITICAL, 11 MEDIUM, 12 LOW
- Todos arreglados por 3 agentes Opus en paralelo + verificación post-fix por un 4º agente Opus

**Fixes CRITICAL (5):**
1. Banquillo dinámico por posiciones del equipo (no más Base/Alero/Joker hardcodeado)
2. Dropdown de posiciones en PlayerCard dinámico (acepta prop `teamPositions`)
3. Auth.jsx: i18n completo (20 strings) + gray→slate + green→emerald
4. ShareTeamModal.jsx: i18n completo (5 strings) + gray→slate
5. PlayerRosterEditor.jsx: layout 2 filas en móvil (fix del bug de nombres recortados)

**Fixes MEDIUM (11):**
- Undo de score/sustitución usa cuarto correcto (guardado en actionHistory)
- Tiros fallados (MISSED) ahora se pueden deshacer
- generateReport ya no mata el quinteto activo (cálculo inline)
- Autosave usa ref (intervalo ya no se reinicia constantemente)
- Modales no se solapan (pendingReplacement se limpia)
- biggestLead usa update funcional (sin stale closure)
- addPlayer cache usa prev pattern (sin referencia stale)
- INITIAL_PARTIAL_SCORES ahora tiene función factory
- ErrorBoundary añadido (evita pantalla blanca en crashes)
- Paleta unificada: gray→slate, green→emerald, yellow→amber, cyan→blue (~15 sitios en 7 archivos)
- ImageCropper.jsx: i18n completo (8 strings)

**Fixes LOW (12):**
- Undo sustitución con cuarto correcto
- Timer auto-advance cierra/reabre quinteto
- Touch targets ≥44px (Apple HIG) en PlayerCard, PlayerRosterEditor
- XSS en generateReport (escapeHtml en nombres)
- Home/Away usan traducciones
- Console.errors en inglés
- slate-750→slate-700 (Tailwind válido)
- aria-labels pendientes (documentado, no implementado en esta sesión)
- useSwipeGesture marcado como unused

**Archivos modificados:** 15 (todos los .jsx/.js + sw.js)
**translations.js:** +33 keys nuevas
**Verificación post-fix:** agente Opus, 12/13 PASS a la primera, 1 fix adicional aplicado
**Build:** exitoso, cache v24 → v25, desplegado a GitHub Pages
**Decisión:** para tareas críticas (reviews, QA) SIEMPRE usar Opus

---

### 8 febrero 2026 - Sesión 12: Fase 2.5 Mejoras post-deploy (9 pasos)

**Fase 2.5 completa (9/9 pasos):**
1. **History API + back nativo:** pushState/popstate en App.jsx, swipe eliminado del tracker, gesto back en partido → modal de salida
2. **i18n pantallas restantes:** TeamsList, TeamDetail, PlayerRosterEditor traducidos EN/ES (~90+ keys), bg-gray→bg-slate, selector idioma con banderas
3. **Fixes visuales:** banquillo verde al inicio (jugadores sin historia), botones score suaves (3 PTS/2 PTS/1 PT), label "F" verificado
4. **PlayerCard compacta enriquecida:** stint/total time + puntos + faltas en una línea
5. **Foul section movida:** entre parciales y On Court, toggle colapsable con badge ⚠️ N
6. **Recomendaciones split:** misma posición directas, cross-position en toggle colapsable morado
7. **Score made/missed:** flujo 2 pasos (elige jugador → ✓ MADE / ✗ MISSED), missedShots en playerState, eventLog con type:'miss'
8. **Modal de reemplazo:** al sacar jugador con 5 en pista → lista banquillo ordenada por posición (misma→secundaria→resto) + Skip
9. **Posiciones configurables:** team_settings JSONB en Supabase, editor en TeamDetail, PlayerRosterEditor dinámico, colores por índice (8 colores cíclicos)

**Archivos modificados:** App.jsx, BasketballRotationTracker.jsx, PlayerCard.jsx, TeamDetail.jsx, TeamsList.jsx, PlayerRosterEditor.jsx, translations.js, gameUtils.js, TeamContext.jsx
**Archivo nuevo:** supabase-migration-team-settings.sql
**SQL ejecutado:** `ALTER TABLE public.teams ADD COLUMN team_settings JSONB DEFAULT '{}'`
**Code review:** subagente sonnet, 0 bugs críticos
**Build:** exitoso, cache v23 → v24, desplegado a GitHub Pages

---

### 8 febrero 2026 - Sesión 11: Fase 2 UI/UX Overhaul + Agent Teams Review + Deploy

**Fase 2 implementada (10/12 items):**
- i18n EN/ES con toggle (LanguageContext + translations.js, ~40+ keys, localStorage)
- Paleta de colores: 14 → 6 (gray→slate, green→emerald, yellow→amber, cyan eliminado)
- Marcador sticky top con tipografía grande (text-3xl sm:text-4xl md:text-5xl)
- Layout reordenado: Marcador → En Pista → Recomendaciones → Banquillo → Faltas
- PlayerCard compacta: una línea por jugador (toggle Eye/EyeOff)
- Faltas colapsable: solo visible cuando hay jugadores en peligro
- Recomendaciones compactas: una línea por recomendación con reasons estructurados
- Botones: Play 72px+pulse, Score 56px, Secondary 44px (Apple HIG)
- Animaciones modales: fadeIn + slideUp (CSS keyframes)
- Swipe left = abrir modal de salida (useSwipeGesture hook)
- Items diferidos: posiciones configurables, formato de partido configurable

**Agent Teams adversarial review (3 agentes: qa-tester, ux-reviewer, code-architect):**
6 bugs encontrados y corregidos:
1. Compact IN/OUT button: 36px → 44px
2. Swipe vertical ratio: 0.75 → 0.5 (menos falsos positivos)
3. Sticky zone reducida: parciales fuera del sticky
4. BUG-D: undo de 5ta falta restaura estado completo (currentMinutes, stints, stintPlusMinus, etc.)
5. BUG-G: preventDefault en touchEnd del undo (evita doble-disparo en móvil)
6. Quarter selector buttons: min 44x44px

**Archivos nuevos:** translations.js, LanguageContext.jsx, useSwipeGesture.js
**Archivos modificados:** BasketballRotationTracker.jsx, PlayerCard.jsx, App.jsx, index.css
**Build:** exitoso, code review pasado
**Cache:** v22 → v23, desplegado a GitHub Pages
**Notion:** actualizado con Development Log y checklist de Fase 2

### 8 febrero 2026 - Sesión 10: Fase 0 ejecutada + eventLog + Deploy

**Fase 0 completada al 86% (6/7 items):**
- **BUG-1 fix** (`App.jsx`): `secondary_positions` ahora se pasa al tracker. Cross-position recommendations funcionan.
- **BUG-2 fix** (`App.jsx` + `gameUtils.js`): IDs cambiados de `index+1` a UUID de Supabase. `getQuintetKey` usa string sort.
- **BUG-7 fix** (`BasketballRotationTracker.jsx`): Undo guarda/restaura estado completo del jugador (currentMinutes, lastToggle, totalCourtTime, totalBenchTime, stints, stintPlusMinus, currentStintStart).
- **eventLog implementado**: Score events (nuestro equipo + rival) y foul events (delta>0) se registran con: timestamp, gameTime, quarter, type, team, playerId, value, lineupOnCourt. Undo elimina entries correspondientes.
- **version: 2** añadido a `getFullGameState()` y `createNewGame()`.
- **App.css eliminado** (código muerto del template Vite).
- **BUG-3 diferido** a Fase 3: setState dentro de setState funciona con React 18+ batching.
- Code review pasado sin bugs. Build exitoso.
- Cache bumpeado a v22, desplegado a GitHub Pages.
- **Notion actualizado** con progreso de Fase 0 y Development Log.
- **Decisión estratégica**: Construir todo completo, decidir boundaries freemium después.

---

### 3 febrero 2026 - Sesión 8: Navegación por gestos

- Optimizacion para navegacion por gestos en movil/tablet:
  - `viewport-fit=cover` anadido al meta viewport de index.html
  - `overscroll-behavior: none` para evitar bounce elastico
  - `-webkit-tap-highlight-color: transparent` global
  - `env(safe-area-inset-*)` como padding en body
- Cache bumpeado a v21, desplegado a GitHub Pages

---

### 3 febrero 2026 - Sesión 7: Posiciones secundarias + Mejora recomendaciones

**Nueva columna en Supabase:**
- `ALTER TABLE public.team_players ADD COLUMN secondary_positions text[] DEFAULT '{}';`
- Ejecutada manualmente en el dashboard (la conexión directa por psql no funciona)

**Null safety en gameUtils.js:**
- `createInitialPlayerState` ahora incluye `secondary_positions: player.secondary_positions || []`

**Editor de equipo (PlayerRosterEditor.jsx):**
- Formularios de editar/añadir ahora incluyen `secondary_positions` en el estado
- Nueva fila "Puede jugar de:" con botones toggle (pills coloreados: azul=Base, verde=Alero, morado=Joker)
- Al cambiar posición principal, la secundaria conflictiva se limpia automáticamente
- Si posición es "Unselected", se borran todas las secundarias
- Badges pequeños (B, A, J) al lado del nombre en vista normal
- Eliminada variable `positionColors` que no se usaba

**Recomendaciones (BasketballRotationTracker.jsx):**
- Eliminado: `const flexibleJokers = ['Jorge', 'Unai']` y bloque `if (player.position === 'Alero')`
- Nueva lógica genérica: busca en banquillo jugadores cuya `secondary_positions` incluya la posición necesaria
- Guardia de composición: solo sugiere si hay otro jugador de su posición primaria en banquillo sin faltas en peligro (tiempo se ignora)
- Texto dinámico: `⚠️ {s.originalPosition}→{s.playingAs}` (ya no dice "Joker→Alero" hardcodeado)
- `fouledOutReplacements` también busca por posición secundaria con la misma guardia
- Modal de fouled out muestra badge de posición cruzada en botones de reemplazo

**Revisión profunda de bugs:**
- No se encontraron bugs reales
- Verificado: undo preserva secondary_positions (spread operator), guardado/carga en Supabase OK, flujo fouledOut→reemplazo OK, null safety en todos los accesos

**Cache:** v19 → v20. Desplegado a GitHub Pages.

---

### 3 febrero 2026 - Sesión 6: Tarjetas tablet + Editor inline de faltas

**Cambios en grids:**
- Grids de jugadores cambiadas de `sm:grid-cols-5` a `sm:grid-cols-4` (5 sitios + 1 placeholder)
- En tablet las tarjetas ya no se aplastan porque caben máximo 4 por fila

**Nuevo editor inline de faltas (+/-):**
- Eliminado el formulario grande de editar stats (tenía 4 campos: pista, banquillo, faltas, puntos)
- Eliminada la lógica de long-press del botón lápiz (ahora es click simple → editar nombre/número/posición)
- Al pulsar en las faltas → popover con botones - y + (se abre hacia arriba)
- Auto-cierre a los 3 segundos, o al pulsar fuera (backdrop invisible)
- Props eliminadas de PlayerCard: `editingStats`, `statsForm`, `onStatsFormChange`, `onStartEditingStats`, `onSaveStats`
- Prop nueva: `onAdjustFouls`

**Unificación de lógica de faltas:**
- `adjustFouls(playerId, delta)` es la fuente única de verdad para modificar faltas
- `addFoulToPlayer` ahora solo hace `adjustFouls(playerId, 1)` + cierra modal
- Eliminados estados: `editingStats`, `statsForm`
- Eliminadas funciones: `startEditingStats`, `saveStatsEdit`

**Correcciones de calidad (revisión senior):**
1. Eliminada duplicación de lógica fouled-out entre `addFoulToPlayer` y `adjustFouls`
2. Popover cambiado de `top-full` a `bottom-full` para no salirse de pantalla
3. Timer del popover simplificado: un solo mecanismo (`startFoulTimer`) en vez de useEffect + función manual

**Desplegado a GitHub Pages.**

---

### 2 febrero 2026 - Sesión 5: Simplificación del código + Mejora UX botones

**Refactorización del código (5 pasos):**

1. **Extraer funciones de utilidad a `src/lib/gameUtils.js`:**
   - formatTime, formatGameTime, getFoulStatus, getFoulBgClass, getQuintetKey, createInitialPlayerState, INITIAL_PARTIAL_SCORES

2. **Extraer PlayerCard a `src/components/PlayerCard.jsx`:**
   - ~239 líneas movidas a su propio archivo con React.memo

3. **Eliminar sistema legacy de localStorage (~250 líneas borradas):**
   - Eliminadas constantes STORAGE_KEY, GAMES_LIST_KEY, GAME_DATA_PREFIX
   - Eliminadas funciones getGamesList, saveGamesList, addGameToList, updateGameInList, removeGameFromList, loadGameData, saveGameData
   - Eliminado array INITIAL_PLAYERS hardcoded
   - Eliminadas funciones loadGame, saveState, deleteGame
   - Eliminadas pantallas HOME y HISTORY legacy
   - Eliminado useEffect de migración de datos antiguos
   - Solo queda Supabase como sistema de guardado

4. **Unificar 7 booleans de modales en 1 variable `activeModal`:**
   - Valores: null, 'exit', 'reset', 'quarter', 'intervals', 'score', 'foul', 'fouledOut'
   - showQuarterSelector se mantuvo separado (es un dropdown inline, no un modal)

5. **Extraer generación de reportes a `src/lib/generateReport.js`:**
   - ~133 líneas de JavaScript puro movidas a su propio archivo

**Resultado:** Archivo principal reducido de 2,529 a ~1,710 líneas (-32%)

**Mejoras de UX - Botones:**
- Botones de puntos (+3, +2, +1) y faltas ahora son cuadrados (aspect-square) para facilitar el toque en tablets
- Layout: Play + contador en columna izquierda, grid 4x2 a la derecha (puntos/faltas arriba, undo/ajustes/download/salir abajo)
- Proporción 3:2 entre botones de puntos y botones secundarios

**Parciales por cuarto:**
- Añadida fila de total por cuarto debajo de cada par de parciales (5min + 5min)
- Color verde/rojo/gris según resultado del cuarto

**Service Worker - Auto-actualización:**
- Resuelto bug: partidos antiguos mostraban UI vieja por cache del SW
- Implementado mecanismo de auto-actualización en index.html (SKIP_WAITING + controllerchange)
- Cache bumpeado de v4 a v12

**Manifest - Orientación:**
- Cambiado de `"portrait"` a `"any"` para permitir horizontal en tablets
- Nota: en PWA instalada hay que reinstalar para que tome efecto

---

### 25 enero 2026 - Sesión 4: PWA + GitHub Pages + Múltiples Partidos
**Mejoras implementadas:**

1. **Configuración como PWA:**
   - Archivo `manifest.json` con iconos
   - Service Worker para funcionamiento offline
   - Se puede instalar como app en el móvil

2. **Despliegue a GitHub Pages:**
   - Repositorio: https://github.com/dpdb13/playstats-basketball
   - URL de la app: https://dpdb13.github.io/playstats-basketball/
   - Script `npm run deploy` para actualizar

3. **Sistema de múltiples partidos:**
   - Nueva estructura de datos con ID único por partido
   - Modal de salida (guardar/finalizar/cancelar)

---

### 25 enero 2025 - Sesión 3: Guardado al cerrar
**Mejora implementada:** Guardado automático al cerrar ventana o cambiar de pestaña.

**Eventos que disparan el guardado:**
1. `beforeunload` - Al cerrar ventana/pestaña
2. `visibilitychange` - Al cambiar de pestaña (útil en móviles)
3. `blur` - Al perder el foco de la ventana

**Nota sobre historial:**
- `actionHistory` - Solo para deshacer acciones, no afecta al reporte
- `quintetHistory`, `rotationHistory`, `stints` - Estos sí se usan para el reporte

---

### 25 enero 2025 - Sesión 2: Optimización
**Problema reportado:** La app se colgó durante un partido real y al refrescar se perdió toda la información.

**Causas identificadas:**
1. El cronómetro actualizaba todos los 12 jugadores cada segundo, sobrecargando el navegador
2. No había persistencia de datos (todo se perdía al recargar)
3. El componente PlayerCard estaba dentro del componente principal, recreándose constantemente
4. Muchos cálculos se ejecutaban en cada render aunque no fueran necesarios

**Soluciones implementadas:**
1. **Autoguardado con localStorage:**
   - Guarda automáticamente cada 5 segundos
   - Guarda cuando cambian datos importantes (marcador, jugadores)
   - Al abrir la app, recupera el último estado guardado
   - Al hacer RESET, borra los datos guardados

2. **Optimización del timer:**
   - Solo actualiza jugadores que tienen `lastToggle` activo
   - Separada la lógica del tiempo de juego y el tiempo de jugadores

3. **PlayerCard movido fuera del componente:**
   - Ahora usa `React.memo()` para evitar re-renders innecesarios
   - Recibe funciones como props en lugar de crearlas internamente

4. **Funciones memoizadas:**
   - `useCallback` para funciones que se pasan como props
   - `useMemo` para cálculos costosos (recomendaciones, filtros de jugadores)

5. **Pantalla de carga:**
   - Muestra "Cargando..." mientras recupera datos del localStorage

**Archivos modificados:**
- `BasketballRotationTracker.jsx` - Reescrito completo con optimizaciones

### 25 enero 2025 - Sesión 1: Setup inicial
- Diego compartió el código completo de la app
- Se creó este archivo CLAUDE.md para el proyecto
