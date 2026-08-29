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
  - `src/lib/generateReport.js` - generación de reportes HTML (usa statsCalculator)
  - `src/lib/statsCalculator.js` - motor de cálculo de stats (fuente única para in-app y HTML)
  - `src/components/GameReport.jsx` - reporte in-app con secciones colapsables
  - `src/i18n/translations.js` - traducciones EN/ES (~145+ keys)
  - `src/context/LanguageContext.jsx` - context + hook useTranslation()
  - `src/hooks/useSwipeGesture.js` - detección de swipe horizontal (ya no se usa en tracker, mantenido por si acaso)
- **Guardado:** Solo Supabase (via `onGameSaved` + `syncManager`). El localStorage legacy fue eliminado.
- **Modales:** Unificados en un solo `activeModal` useState (valores: null, 'exit', 'reset', 'quarter', 'intervals', 'score', 'foul', 'fouledOut', 'freeThrowPlayer', 'freeThrowCount', 'freeThrowMade') + `pendingReplacement` separado para modal de reemplazo
- **PWA (Progressive Web App)** - Se puede instalar como app en móvil
- **Desplegada en:** https://dpdb13.github.io/playstats-basketball/
- **Nombre oficial:** PlayStats Basketball
- **Service Worker:** Auto-actualización implementada (detecta nueva versión y recarga automáticamente)
- **Cache actual:** `basketball-rotation-v86`
- **Manifest:** `orientation: "any"` (permite horizontal y vertical)
- **History API:** pushState/popstate para navegación nativa de back en iOS/Android
- **Supabase schema:** Columna `team_settings JSONB` en tabla `teams` para posiciones configurables

## Infraestructura Supabase — CAMBIÓ el 29 agosto 2026 (LEER ANTES DE TOCAR NADA)

**PlayStats ya NO tiene proyecto Supabase propio. Vive dentro del proyecto de Pick & Cut.**

- **Proyecto actual:** `ehlxgjeffarkgphoabiy` (llamado `pickcut` en el dashboard), esquema `public`
- **Proyecto antiguo:** `nhkfflffufopqbzrlztm` (`BasketballApp`) — PAUSADO, se conserva como respaldo. Reactivable hasta **1 may 2027**. No borrar antes de esa fecha
- **Convive con** las 3 tablas de Pick & Cut (`licenses`, `active_sessions`, `user_backups`). No hubo ni una colisión de nombres

### Por qué se hizo
El plan Free de Supabase solo permite **2 proyectos activos por persona** y se pausan solos **tras 1 semana de inactividad**. PlayStats llevaba pausada desde marzo. Se descartó pagar Pro (25$/mes). Se eligió Pick & Cut como destino (en vez del proyecto compartido de Lysto/Splitly) porque PlayStats se venderá como complemento de Pick & Cut: así el cliente usa **una sola cuenta para las dos apps**.

### Consecuencias que hay que recordar
- **`auth.users` es COMPARTIDA con Pick & Cut.** Cualquier cambio en auth afecta a los ~27 usuarios de Pick & Cut, que son reales y de pago. Extremar el cuidado
- **Las cuentas de PlayStats se fusionaron con las de Pick & Cut por email.** Quien tenía las dos entra ahora con la contraseña de Pick & Cut
- **`auto_confirm_email` NO se migró a propósito.** Hacía `UPDATE auth.users SET email_confirmed_at = now()` y habría desactivado la verificación de email para todo Pick & Cut (que tiene `mailer_autoconfirm: False`). **No reinstalarla nunca**
- **`handle_new_user` sí está**, con trigger `on_auth_user_created` en `auth.users`. Cada registro de Pick & Cut crea también una fila en `profiles`
- **Deuda pendiente:** los usuarios de Pick & Cut anteriores a la migración NO tienen fila en `profiles`. Resolver antes de vender el pack conjunto
- Ya no se pausará sola: el proyecto de Pick & Cut tiene actividad constante por las licencias

### Respaldo
Copia completa (esquema + datos + mapa de cuentas) en `~/Desktop/Output Claude/playstats-backup-2026-08-29/`.

### Trampas encontradas al migrar (si algún día se repite)
- `pg_dump` 18 mete directivas `\restrict` que la API de Supabase no entiende → hay que quitarlas
- El dump trae `CREATE SCHEMA public` → falla en un proyecto que ya existe
- `ALTER DEFAULT PRIVILEGES` → "permission denied", hay que eliminarlos
- El plan Free **no genera backups descargables**: para sacar los datos hubo que reactivar el proyecto, y para eso pausar otro

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
- Forward navigation (`pushState`) solo en: teams→teamDetail, teamDetail→game, teamDetail→report
- Same-screen or backward uses `replaceState` (avoids stack pollution)
- `prevScreenRef` tracks previous screen to distinguish forward vs backward
- TeamDetail report handler uses `capture: true` + `stopImmediatePropagation` to fire before App.jsx
- GameReport `onBack` uses `window.history.back()` to consume the pushed entry (not direct setState)
- `handleExitGame` uses `navGuardRef` to block popstate while programmatically going back
- `navGuardRef` also debounces rapid back presses to prevent double-navigation
- En partido, gesto back muestra modal de salida (no navega directamente)
- At teams list, re-push prevents leaving PWA (not infinite — consumed by popstate)
- Swipe custom eliminado del tracker (conflicto con gestos nativos)

### Reportes
- **Reporte in-app (GameReport.jsx):** vista full-screen con secciones colapsables
  - Parciales por cuarto (mitades de 5 min + total)
  - Stats individuales (pts, FG%, FT%, +/-, tiros por tipo, mejor/peor stint)
  - Quintetos por: +/-, ofensivos, defensivos, % tiro, minutos
  - Mejores y peores stints individuales (Top 5)
  - Impacto de jugador (on-court vs off-court +/- por 10 min)
  - Stints detallados por jugador
  - Accesible desde modal de partido finalizado en TeamDetail
- **Reporte HTML descargable:** mismo contenido, auto-descarga como archivo .html
  - Dark theme con media query para impresión
- **Arquitectura:** `statsCalculator.js` es la fuente única de cálculos para ambos reportes

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

> El historial detallado de sesiones se eliminó para reducir consumo de tokens.
> Las sesiones 1-25 (enero-febrero 2026) están documentadas en el global CLAUDE.md.
> Última sesión: Sesión 25 (12 feb 2026) — Quintet phantom bug fix + Translation cleanup v73
