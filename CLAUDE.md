# Basketball Rotation App

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
- Es un único componente React: `BasketballRotationTracker`
- Todo el código está en un solo archivo
- Funciona pero no está desplegado en ningún sitio (solo código)

## Funcionalidades implementadas

### Gestión de jugadores
- 12 jugadores predefinidos con nombre, número y posición
- Posiciones: Base, Alero, Joker, Unselected (no convocado)
- Se pueden editar nombre, número y posición de cada jugador

### Control de tiempo
- Tiempo de partido con cronómetro (10 min por cuarto)
- Tiempo en pista de cada jugador (stint actual)
- Tiempo total en pista y en banquillo
- Sistema de colores (verde/amarillo/rojo) según tiempo en pista o banquillo

### Sistema de faltas
- Contador de faltas por jugador (máximo 5)
- Alertas visuales según cuarto:
  - Q1: 0 faltas = safe, 1 = warning, 2+ = danger
  - Q2: 0-1 = safe, 2 = warning, 3+ = danger
  - Q3-Q4: 0-2 = safe, 3 = warning, 4 = danger
- Cuando llega a 5 faltas: "fouled out" automático

### Marcador
- Marcador con equipos editables
- Parciales por cuarto (dividido en dos mitades de 5 min)
- Puntos individuales de cada jugador
- Botones +1, +2, +3 para anotar

### Recomendaciones de cambio
- Detecta jugadores que llevan mucho tiempo en pista (rojo)
- Detecta jugadores con problemas de faltas
- Sugiere reemplazos de la misma posición
- Jorge y Unai (Jokers) pueden jugar como Aleros

### Reportes
- Genera HTML descargable con:
  - Resultado final
  - Estadísticas de quintetos (tiempo juntos, +/-)
  - Stints de cada jugador

### Otras funcionalidades
- Deshacer última acción
- Reset completo (mantener pulsado)
- Configurar intervalos de tiempo para alertas

## Jugadores por defecto
| # | Nombre | Posición |
|---|--------|----------|
| 2 | David | Base |
| 4 | Coco | Base |
| 5 | Clemen | Base |
| 12 | Hugo | Base |
| 10 | Lucas | Base |
| 9 | Pablo | Alero |
| 3 | Tommy | Alero |
| 11 | Miguel | Alero |
| 8 | Unai | Joker |
| 6 | Nico | Joker |
| 7 | Jorge | Joker |
| 0 | Jugador 12 | Unselected |

## Pendiente / Ideas futuras
- (por definir con Diego)

## Historial de conversaciones

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
