'use strict';

// Shared data and helpers for the Metro CDMX minigame family (Metrordle,
// Metrolaberinto, ...). Loaded as a plain <script src="/shared.js"> before
// each game's own script, so there's no module system - everything hangs
// off window.MetroShared instead of the global scope.

var LINES = [
  { id: '1', name: 'Línea 1', color: '#ec2a7b', textColor: '#ffffff', stations: ['Observatorio', 'Tacubaya', 'Juanacatlán', 'Chapultepec', 'Sevilla', 'Insurgentes', 'Cuauhtémoc', 'Balderas', 'Salto del Agua', 'Isabel la Católica', 'Pino Suárez', 'Merced', 'Candelaria', 'San Lázaro', 'Moctezuma', 'Balbuena', 'Boulevard Puerto Aéreo', 'Gómez Farías', 'Zaragoza', 'Pantitlán'] },
  { id: '2', name: 'Línea 2', color: '#0057a8', textColor: '#ffffff', stations: ['Cuatro Caminos', 'Panteones', 'Tacuba', 'Cuitláhuac', 'Popotla', 'Colegio Militar', 'Normal', 'San Cosme', 'Revolución', 'Hidalgo', 'Bellas Artes', 'Allende', 'Zócalo', 'Pino Suárez', 'San Antonio Abad', 'Chabacano', 'Viaducto', 'Xola', 'Villa de Cortés', 'Nativitas', 'Portales', 'Ermita', 'General Anaya', 'Tasqueña'] },
  { id: '3', name: 'Línea 3', color: '#8f8f00', textColor: '#ffffff', stations: ['Indios Verdes', 'Deportivo 18 de Marzo', 'Potrero', 'La Raza', 'Tlatelolco', 'Guerrero', 'Hidalgo', 'Juárez', 'Balderas', 'Niños Héroes', 'Hospital General', 'Centro Médico', 'Etiopía', 'Eugenia', 'División del Norte', 'Zapata', 'Coyoacán', 'Viveros', 'Miguel Ángel de Quevedo', 'Copilco', 'Universidad'] },
  { id: '4', name: 'Línea 4', color: '#00a99d', textColor: '#ffffff', stations: ['Martín Carrera', 'Talismán', 'Bondojito', 'Consulado', 'Canal del Norte', 'Morelos', 'Candelaria', 'Fray Servando', 'Jamaica', 'Santa Anita'] },
  { id: '5', name: 'Línea 5', color: '#ffcd00', textColor: '#1a1a1a', stations: ['Politécnico', 'Instituto del Petróleo', 'Autobuses del Norte', 'La Raza', 'Misterios', 'Valle Gómez', 'Consulado', 'Eduardo Molina', 'Aragón', 'Oceanía', 'Terminal Aérea', 'Hangares', 'Pantitlán'] },
  { id: '6', name: 'Línea 6', color: '#e2231a', textColor: '#ffffff', stations: ['El Rosario', 'Tezozómoc', 'UAM Azcapotzalco', 'Ferrería', 'Norte 45', 'Vallejo', 'Instituto del Petróleo', 'Lindavista', 'Deportivo 18 de Marzo', 'La Villa / Basílica', 'Martín Carrera'] },
  { id: '7', name: 'Línea 7', color: '#f68b1f', textColor: '#1a1a1a', stations: ['El Rosario', 'Aquiles Serdán', 'Camarones', 'Refinería', 'Tacuba', 'San Joaquín', 'Polanco', 'Auditorio', 'Constituyentes', 'Tacubaya', 'San Pedro de los Pinos', 'San Antonio', 'Mixcoac', 'Barranca del Muerto'] },
  { id: '8', name: 'Línea 8', color: '#0e8a4b', textColor: '#ffffff', stations: ['Garibaldi/Lagunilla', 'Bellas Artes', 'San Juan de Letrán', 'Salto del Agua', 'Doctores', 'Obrera', 'Chabacano', 'La Viga', 'Santa Anita', 'Coyuya', 'Iztacalco', 'Apatlaco', 'Aculco', 'Escuadrón 201', 'Atlalilco', 'Iztapalapa', 'Cerro de la Estrella', 'UAM-I', 'Constitución de 1917'] },
  { id: '9', name: 'Línea 9', color: '#6d4c33', textColor: '#ffffff', stations: ['Tacubaya', 'Patriotismo', 'Chilpancingo', 'Centro Médico', 'Lázaro Cárdenas', 'Chabacano', 'Jamaica', 'Mixiuhca', 'Velódromo', 'Ciudad Deportiva', 'Puebla', 'Pantitlán'] },
  { id: 'A', name: 'Línea A', color: '#8e2c8f', textColor: '#ffffff', stations: ['Pantitlán', 'Agrícola Oriental', 'Canal de San Juan', 'Tepalcates', 'Guelatao', 'Peñón Viejo', 'Acatitla', 'Santa Marta', 'Los Reyes', 'La Paz'] },
  { id: '12', name: 'Línea 12', color: '#a67c00', textColor: '#ffffff', stations: ['Mixcoac', 'Insurgentes Sur', 'Hospital 20 de Noviembre', 'Zapata', 'Parque de los Venados', 'Eje Central', 'Ermita', 'Mexicaltzingo', 'Atlalilco', 'Culhuacán', 'San Andrés Tomatlán', 'Lomas Estrella', 'Calle 11', 'Periférico Oriente', 'Tezonco', 'Olivos', 'Nopalera', 'Zapotitlán', 'Tlaltenco', 'Tláhuac'] },
  { id: 'B', name: 'Línea B', color: '#6b8570', textColor: '#ffffff', stations: ['Buenavista', 'Guerrero', 'Garibaldi/Lagunilla', 'Lagunilla', 'Tepito', 'Morelos', 'San Lázaro', 'Ricardo Flores Magón', 'Romero Rubio', 'Oceanía', 'Deportivo Oceanía', 'Bosque de Aragón', 'Villa de Aragón', 'Nezahualcóyotl', 'Impulsora', 'Río de los Remedios', 'Múzquiz', 'Ecatepec', 'Olímpica', 'Plaza Aragón', 'Ciudad Azteca'] },
];

// Station name -> pictogram slug, resolved against the symbols in
// station-icons.svg. Stations without an entry (or whose slug has no
// matching <symbol>) simply render without an icon - each game's own
// render code is responsible for that fallback.
var STATION_ICON_SLUGS = {
  'Observatorio': 'observatorio',
  'Tacubaya': 'tacubaya',
  'Juanacatlán': 'juanacatlan',
  'Chapultepec': 'chapultepec',
  'Sevilla': 'sevilla',
  'Insurgentes': 'insurgentes',
  'Cuauhtémoc': 'cuauhtemoc',
  'Balderas': 'balderas',
  'Salto del Agua': 'salto-del-agua',
  'Isabel la Católica': 'isabel-la-catolica',
  'Pino Suárez': 'pino-suarez',
  'Merced': 'merced',
  'Candelaria': 'candelaria',
  'San Lázaro': 'san-lazaro',
  'Moctezuma': 'moctezuma',
  'Balbuena': 'balbuena',
  'Boulevard Puerto Aéreo': 'boulevard-puerto-aereo',
  'Gómez Farías': 'gomez-farias',
  'Zaragoza': 'zaragoza',
  'Pantitlán': 'pantitlan',
  'Cuatro Caminos': 'cuatro-caminos',
  'Panteones': 'panteones',
  'Tacuba': 'tacuba',
  'Cuitláhuac': 'cuitlahuac',
  'Popotla': 'popotla',
  'Colegio Militar': 'colegio-militar',
  'Normal': 'normal',
  'San Cosme': 'san-cosme',
  'Revolución': 'revolucion',
  'Hidalgo': 'hidalgo',
  'Bellas Artes': 'bellas-artes',
  'Allende': 'allende',
  'Zócalo': 'zocalo',
  'San Antonio Abad': 'san-antonio-abad',
  'Chabacano': 'chabacano',
  'Viaducto': 'viaducto',
  'Xola': 'xola',
  'Villa de Cortés': 'villa-de-cortes',
  'Nativitas': 'nativitas',
  'Portales': 'portales',
  'Ermita': 'ermita',
  'General Anaya': 'general-anaya',
  'Tasqueña': 'tasquena',
  'Indios Verdes': 'indios-verdes',
  'Deportivo 18 de Marzo': 'deportivo-18-de-marzo',
  'Potrero': 'potrero',
  'La Raza': 'la-raza',
  'Tlatelolco': 'tlatelolco',
  'Guerrero': 'guerrero',
  'Juárez': 'juarez',
  'Niños Héroes': 'ninos-heroes',
  'Hospital General': 'hospital-general',
  'Centro Médico': 'centro-medico',
  'Etiopía': 'etiopia',
  'Eugenia': 'eugenia',
  'División del Norte': 'division-del-norte',
  'Zapata': 'zapata',
  'Coyoacán': 'coyoacan',
  'Viveros': 'viveros',
  'Miguel Ángel de Quevedo': 'miguel-angel-de-quevedo',
  'Copilco': 'coplico',
  'Universidad': 'universidad',
  'Martín Carrera': 'martin-carrera',
  'Talismán': 'talisman',
  'Bondojito': 'bondojito',
  'Consulado': 'consulado',
  'Canal del Norte': 'canal-del-norte',
  'Morelos': 'morelos',
  'Fray Servando': 'fray-servando',
  'Jamaica': 'jamaica',
  'Santa Anita': 'santa-anita',
  'Politécnico': 'politecnico',
  'Instituto del Petróleo': 'instituto-del-petroleo',
  'Autobuses del Norte': 'autobuses-del-norte',
  'Misterios': 'misterios',
  'Valle Gómez': 'valle-gomez',
  'Eduardo Molina': 'eduardo-molina',
  'Aragón': 'aragon',
  'Oceanía': 'oceania',
  'Terminal Aérea': 'terminal-aerea',
  'Hangares': 'hangares',
  'El Rosario': 'el-rosario',
  'Tezozómoc': 'tezozomoc',
  'UAM Azcapotzalco': 'azcapotzalco',
  'Ferrería': 'ferreria',
  'Norte 45': 'norte-45',
  'Vallejo': 'vallejo',
  'Lindavista': 'lindavista',
  'La Villa / Basílica': 'la-villa',
  'Aquiles Serdán': 'aquiles-serdan',
  'Camarones': 'camarones',
  'Refinería': 'refineria',
  'San Joaquín': 'san-joaquin',
  'Polanco': 'polanco',
  'Auditorio': 'auditorio',
  'Constituyentes': 'constituyentes',
  'San Pedro de los Pinos': 'san-pedro-de-los-pinos',
  'San Antonio': 'san-antonio',
  'Mixcoac': 'mixcoac',
  'Barranca del Muerto': 'barranca-del-muerto',
  'Garibaldi/Lagunilla': 'garibaldi',
  'San Juan de Letrán': 'san-juan-de-letran',
  'Doctores': 'doctores',
  'Obrera': 'obrera',
  'La Viga': 'la-viga',
  'Coyuya': 'coyuya',
  'Iztacalco': 'iztacalco',
  'Apatlaco': 'apatlaco',
  'Aculco': 'aculco',
  'Escuadrón 201': 'escuadron-201',
  'Atlalilco': 'atlalilco',
  'Iztapalapa': 'iztapalapa',
  'Cerro de la Estrella': 'cerro-de-la-estrella',
  'UAM-I': 'uam',
  'Constitución de 1917': 'constitucion-de-1917',
  'Patriotismo': 'patriotismo',
  'Chilpancingo': 'chilpancingo',
  'Lázaro Cárdenas': 'lazaro-cardenas',
  'Mixiuhca': 'mixiuhca',
  'Velódromo': 'velodromo',
  'Ciudad Deportiva': 'ciudad-deportiva',
  'Puebla': 'puebla',
  'Agrícola Oriental': 'agricola-oriental',
  'Canal de San Juan': 'canal-de-san-juan',
  'Tepalcates': 'tepalcates',
  'Guelatao': 'guelatao',
  'Peñón Viejo': 'penon-viejo',
  'Acatitla': 'acatitla',
  'Santa Marta': 'santa-marta',
  'Los Reyes': 'los-reyes',
  'La Paz': 'la-paz',
  'Insurgentes Sur': 'insurgentes-sur',
  'Hospital 20 de Noviembre': 'hospital-20-de-noviembre',
  'Parque de los Venados': 'parque-de-los-venados',
  'Eje Central': 'eje-central',
  'Mexicaltzingo': 'mexicaltzingo',
  'Culhuacán': 'culhuacan',
  'San Andrés Tomatlán': 'san-andres-tomatlan',
  'Lomas Estrella': 'lomas-estrella',
  'Calle 11': 'calle-11',
  'Periférico Oriente': 'periferico-oriente',
  'Tezonco': 'tezonco',
  'Olivos': 'olivos',
  'Nopalera': 'nopalera',
  'Zapotitlán': 'zapotitlan',
  'Tlaltenco': 'tlaltenco',
  'Tláhuac': 'tlahuac',
  'Buenavista': 'buenavista',
  'Lagunilla': 'lagunilla',
  'Tepito': 'tepito',
  'Ricardo Flores Magón': 'ricardo-flores-magon',
  'Romero Rubio': 'romero-rubio',
  'Deportivo Oceanía': 'deportivo-oceania',
  'Bosque de Aragón': 'bosque-de-aragon',
  'Villa de Aragón': 'villa-de-aragon',
  'Nezahualcóyotl': 'nezahualcoyotl',
  'Impulsora': 'impulsora',
  'Río de los Remedios': 'rio-de-los-remedios',
  'Múzquiz': 'muzquiz',
  'Ecatepec': 'ecatepec',
  'Olímpica': 'olimpica',
  'Plaza Aragón': 'plaza-aragon',
  'Ciudad Azteca': 'ciudad-azteca',
};

// The OS-level media query OR this site's own "Animaciones limitadas"
// setting (see getReducedMotion() below) - additive, never the other
// way around: nobody wants MORE motion than their OS already asked to
// reduce, so there's no "force animations on" override here, unlike
// getThemeMode()'s own light/dark/system three-way. This one function
// is the single call site every game already uses to gate its own
// setTimeout-driven animation delays (see each page's own delay()) and
// CSS animation classes, so turning the site setting on reduces motion
// everywhere for free, with no separate per-game wiring needed.
function prefersReducedMotion() {
  return (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) || getReducedMotion();
}

// Deterministic daily puzzles: every visitor on the same calendar day gets
// the same puzzle, derived from a seeded PRNG (mulberry32) keyed by that
// day's date string. Each game picks its own RNG seed namespace (e.g.
// 'metrordle-' + dateKey) so different games' daily picks don't correlate.

function hashStringToInt(str) {
  var hash = 0x811c9dc5;
  for (var i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

function createSeededRandom(seedString) {
  var seed = hashStringToInt(seedString);
  return function () {
    seed |= 0;
    seed = (seed + 0x6D2B79F5) | 0;
    var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pad2(n) {
  return n < 10 ? '0' + n : String(n);
}

function getDateKey(date) {
  return date.getFullYear() + '-' + pad2(date.getMonth() + 1) + '-' + pad2(date.getDate());
}

function getPreviousDateKey(dateKey) {
  var d = new Date(dateKey + 'T00:00:00');
  d.setDate(d.getDate() - 1);
  return getDateKey(d);
}

// Debug/QA hook: ?date=YYYY-MM-DD overrides "today" so any day's puzzle can
// be previewed without waiting for it. Falls back to the real date for
// anything missing or malformed. Each page keeps its own debugDate (set by
// its ?debug=true date-nav buttons, which takes priority over ?date= and
// lets the two be combined) and passes it in explicitly.

function isDebugMode() {
  try {
    return new URL(window.location.href).searchParams.get('debug') === 'true';
  } catch (e) {
    return false;
  }
}

function getEffectiveToday(debugDate) {
  if (debugDate) return debugDate;
  try {
    var override = new URL(window.location.href).searchParams.get('date');
    if (override && /^\d{4}-\d{2}-\d{2}$/.test(override)) {
      var parsed = new Date(override + 'T00:00:00');
      if (!isNaN(parsed.getTime()) && getDateKey(parsed) === override) {
        return parsed;
      }
    }
  } catch (e) {}
  return new Date();
}

function getGameNumberForDateKey(dateKey, startDateKey) {
  var start = new Date(startDateKey + 'T00:00:00');
  var target = new Date(dateKey + 'T00:00:00');
  var msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((target.getTime() - start.getTime()) / msPerDay) + 1;
}

// Fixed priority order for the "sigue jugando hoy" suggestions on every
// game's own end screen - not the same order as AGENTS.md's "The games"
// section, which is roughly chronological by ship date. Every game's
// own localStorage key follows the same '<key>:' + dateKey shape (see
// each page's own storageKeyFor()), which is what makes a single
// shared isGamePlayedToday() possible below instead of one per game.
var SUGGESTABLE_GAMES = [
  { key: 'metrordle', href: '/', name: 'Metrordle', glyph: '🚇', sub: 'Ordena la línea →' },
  { key: 'memoria', href: '/memoria/', name: 'Memoria', glyph: '🃏', sub: 'Parejas en 60 segundos →' },
  { key: 'metroguessr', href: '/metroguessr/', name: 'Metroguessr', glyph: '🗺️', sub: 'Adivina la estación →' },
  { key: 'laberinto', href: '/laberinto/', name: 'Laberinto', glyph: '🧭', sub: 'Encuentra la ruta →' },
  { key: 'metrocrush', href: '/metrocrush/', name: 'Metro Crush', glyph: '🍬', sub: 'Forma filas de 3 →' },
  { key: 'clasificador', href: '/clasificador/', name: 'Clasificador', glyph: '🪣', sub: 'Clasifica las estaciones →' },
];

// Whether `gameKey` already has a completed result for `dateKey`, read
// straight from that game's own saved state - "completed" rather than
// merely "has an entry" matters for Metrordle/Laberinto/Metroguessr,
// whose saved state can also represent an in-progress round; Memoria,
// Metro Crush, and Clasificador only ever persist a result once a round
// is actually over, so any saved entry there already means done. Deliberately
// ignores the debug date-nav's simulated "today" (a caller passes the
// real dateKey it wants checked) - suggestions reflect the player's
// actual daily activity, not whatever day they happen to be previewing.
function isGamePlayedToday(gameKey, dateKey) {
  try {
    var raw = localStorage.getItem(gameKey + ':' + dateKey);
    if (!raw) return false;
    var parsed = JSON.parse(raw);
    if (!parsed) return false;
    switch (gameKey) {
      case 'metrordle': return parsed.gameOver === true;
      case 'laberinto': return !!parsed.status && parsed.status !== 'playing';
      case 'metroguessr': return parsed.done === true;
      default: return true; // memoria, metrocrush, clasificador
    }
  } catch (e) {
    return false;
  }
}

// How many suggestions a game's end screen shows at once - capped so the
// promo section stays a quick glance rather than a full game menu.
var MAX_SUGGESTED_GAMES = 2;

// The ordered, filtered list a game's own end screen should suggest:
// the top MAX_SUGGESTED_GAMES games from SUGGESTABLE_GAMES's fixed
// priority order, minus the current game and minus anything already
// completed today.
function getSuggestedGames(currentGameKey, dateKey) {
  return SUGGESTABLE_GAMES.filter(function (game) {
    return game.key !== currentGameKey && !isGamePlayedToday(game.key, dateKey);
  }).slice(0, MAX_SUGGESTED_GAMES);
}

// Builds the "sigue jugando hoy" promo component for currentGameKey, or
// null if every other game is already done today (the caller should
// remove/hide any previously-inserted promo in that case). Returns a
// detached element - it only knows the component's own markup, never
// the page's - so every page stays free to mount it wherever its own
// layout wants, without this shared code reaching into that page's DOM.
function buildGamePromo(currentGameKey, dateKey) {
  var suggestions = getSuggestedGames(currentGameKey, dateKey);
  if (suggestions.length === 0) return null;

  var section = document.createElement('div');
  section.className = 'game-promo';

  var eyebrow = document.createElement('p');
  eyebrow.className = 'game-promo__eyebrow';
  eyebrow.textContent = 'Sigue jugando hoy';
  section.appendChild(eyebrow);

  var grid = document.createElement('div');
  grid.className = 'game-promo__grid';
  suggestions.forEach(function (game) {
    var a = document.createElement('a');
    a.className = 'game-promo__card';
    a.href = game.href;

    var glyph = document.createElement('span');
    glyph.className = 'game-promo__glyph';
    glyph.setAttribute('aria-hidden', 'true');
    glyph.textContent = game.glyph;

    var name = document.createElement('span');
    name.className = 'game-promo__name';
    name.textContent = game.name;

    var sub = document.createElement('span');
    sub.className = 'game-promo__sub';
    sub.textContent = game.sub;

    a.appendChild(glyph);
    a.appendChild(name);
    a.appendChild(sub);
    grid.appendChild(a);
  });
  section.appendChild(grid);

  return section;
}

function loadStreak(storageKey) {
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) return { count: 0, lastResultDate: null, max: 0 };
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.count !== 'number') return { count: 0, lastResultDate: null, max: 0 };
    // Backfill max for streaks saved before this field existed - the
    // current count is always a lower bound on the best ever reached.
    if (typeof parsed.max !== 'number') parsed.max = parsed.count;
    return parsed;
  } catch (e) {
    return { count: 0, lastResultDate: null, max: 0 };
  }
}

function saveStreak(storageKey, streak) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(streak));
  } catch (e) {
    // localStorage unavailable - streak just won't persist this session.
  }
}

function updateStreakForResult(storageKey, dateKey, won) {
  var streak = loadStreak(storageKey);

  if (won) {
    var previousDateKey = getPreviousDateKey(dateKey);
    // A win only extends the streak if yesterday's result is the last
    // one recorded; otherwise (first game ever, or a gap where a day
    // was skipped or lost) today's win starts a fresh streak of 1.
    streak.count = streak.lastResultDate === previousDateKey ? streak.count + 1 : 1;
  } else {
    streak.count = 0;
  }

  streak.max = Math.max(streak.max || 0, streak.count);
  streak.lastResultDate = dateKey;
  saveStreak(storageKey, streak);

  return streak.count;
}

function formatStreak(count) {
  return 'Racha: ' + count + (count === 1 ? ' día' : ' días');
}

function formatMaxStreak(count) {
  return 'máxima: ' + count + (count === 1 ? ' día' : ' días');
}

// The "🔥 × N" streak badge every leaderboard row that tracks a streak
// uses (Metrordle/Laberinto/Memoria's own leaderboards, and /admin/'s
// matching column for those same three collections) - a streak of 0 or
// 1 isn't yet "a streak" worth calling out, so this still returns a
// span (for the column's own fixed-width alignment, see
// .leaderboard__streak in shared.css) but leaves it empty in that case.
// Always built from entry.streak, which only reaches a leaderboard
// entry at all when the caller's own getTopLeaderboardScores() call
// names 'streak' in options.extraFields (see that function's own
// comment for why a field left out of orderBySpecs still needs that).
function buildStreakBadge(streak) {
  var span = document.createElement('span');
  span.className = 'leaderboard__streak';
  if (streak > 1) span.textContent = '🔥 × ' + streak;
  return span;
}

function copyViaExecCommand(text) {
  var textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.appendChild(textarea);
  textarea.select();

  var succeeded = false;
  try {
    succeeded = document.execCommand('copy');
  } catch (e) {
    succeeded = false;
  }

  document.body.removeChild(textarea);

  return succeeded ? Promise.resolve() : Promise.reject(new Error('copy failed'));
}

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).catch(function () {
      return copyViaExecCommand(text);
    });
  }

  return copyViaExecCommand(text);
}

function copyTextWithButtonFeedback(text, buttonEl) {
  var originalLabel = buttonEl.textContent;

  copyToClipboard(text).then(function () {
    buttonEl.textContent = '¡Copiado!';
  }, function () {
    buttonEl.textContent = 'No se pudo copiar';
  }).then(function () {
    setTimeout(function () {
      buttonEl.textContent = originalLabel;
    }, 1600);
  });
}

// Shares text via the native OS share sheet when available - it hands
// the target app a proper structured field, rather than relying on the
// player to manually paste a clipboard blob through whatever app they
// pick (which has been reported to mangle a pasted multi-line/emoji
// block into a URL-encoded mess instead of showing it as plain text).
// Falls back to a clipboard copy (with buttonEl's own label as a
// temporary confirmation) when navigator.share isn't available, or if
// the share sheet itself fails for a reason other than the player just
// closing it (AbortError).
function shareOrCopyText(text, buttonEl) {
  if (navigator.share) {
    navigator.share({ text: text }).catch(function (err) {
      if (err && err.name === 'AbortError') return;
      copyTextWithButtonFeedback(text, buttonEl);
    });
    return;
  }

  copyTextWithButtonFeedback(text, buttonEl);
}

// Daily leaderboards (Firestore-backed). The player's alias is site-wide
// (one localStorage key shared across every game), not per-game, so it
// carries over if a leaderboard ever comes to Metrordle or Laberinto too.
var ALIAS_STORAGE_KEY = 'metrordle:alias';
var ALIAS_MAX_LENGTH = 20;

function normalizeAlias(alias) {
  return String(alias || '').trim().slice(0, ALIAS_MAX_LENGTH);
}

// The document ID a given alias maps to in a leaderboard's "entries"
// subcollection - lowercased so "Eduardo" and "eduardo" land in the same
// slot instead of coexisting as separate near-duplicate entries.
function aliasDocId(alias) {
  return normalizeAlias(alias).toLowerCase();
}

function getAlias() {
  try {
    return localStorage.getItem(ALIAS_STORAGE_KEY) || '';
  } catch (e) {
    return '';
  }
}

// Returns the normalized alias that was actually saved (possibly empty,
// if the input was blank/whitespace-only), so callers can tell whether
// the save actually took.
function setAlias(alias) {
  var normalized = normalizeAlias(alias);
  try {
    if (normalized) {
      localStorage.setItem(ALIAS_STORAGE_KEY, normalized);
    } else {
      localStorage.removeItem(ALIAS_STORAGE_KEY);
    }
  } catch (e) {
    // localStorage unavailable (private mode, quota, etc.) - the alias
    // just won't persist across reloads, same tradeoff as every other
    // localStorage-backed value on this site.
  }
  return normalized;
}

// Site-wide app config (one localStorage key shared across every page,
// same pattern as the alias above) - starts with just the appearance
// mode, meant to grow more settings later without a new key or a
// migration. saveConfig() always merges its argument into whatever's
// already stored, so setting one key never clobbers another one a
// future feature added.
var CONFIG_STORAGE_KEY = 'metrordle:config';
var THEME_MODES = ['light', 'dark', 'system'];

function loadConfig() {
  try {
    var raw = localStorage.getItem(CONFIG_STORAGE_KEY);
    var parsed = raw ? JSON.parse(raw) : null;
    return (parsed && typeof parsed === 'object') ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveConfig(partialConfig) {
  var merged = Object.assign({}, loadConfig(), partialConfig);
  try {
    localStorage.setItem(CONFIG_STORAGE_KEY, JSON.stringify(merged));
  } catch (e) {
    // localStorage unavailable (private mode, quota, etc.) - the
    // setting just won't persist across reloads, same tradeoff as
    // every other localStorage-backed value on this site.
  }
  return merged;
}

// 'system' (the default, same as never having configured anything) or
// an unrecognized/corrupted stored value both mean "no override" -
// only 'light'/'dark' are ever treated as an explicit choice.
function getThemeMode() {
  var mode = loadConfig().mode;
  return THEME_MODES.indexOf(mode) === -1 ? 'system' : mode;
}

// Applies a theme mode to the DOM by itself - no storage read/write.
// shared.css's [data-theme] rules already implement both forced modes
// (:root[data-theme="dark"] forces dark regardless of the OS
// preference; :root:not([data-theme="light"]) is what lets
// prefers-color-scheme keep applying dark unless light was explicitly
// forced) - this only toggles the attribute they key off of. 'system'
// (or anything else) removes the override entirely, which is the same
// as never having set it.
function applyThemeMode(mode) {
  if (mode === 'light' || mode === 'dark') {
    document.documentElement.setAttribute('data-theme', mode);
  } else {
    document.documentElement.removeAttribute('data-theme');
  }
}

// Persists + applies in one call, immediately, no reload needed - what
// /configurar/'s mode picker calls on each click.
function setThemeMode(mode) {
  var normalized = THEME_MODES.indexOf(mode) === -1 ? 'system' : mode;
  saveConfig({ mode: normalized });
  applyThemeMode(normalized);
  return normalized;
}

// Defaults to false (no override) for anything missing/invalid, same
// "unrecognized means off" convention as getThemeMode()'s own 'system'
// fallback. This is the explicit in-app accommodation /configurar/'s
// own toggle sets - prefersReducedMotion() above is what actually
// combines it with the OS-level media query everywhere it's checked.
function getReducedMotion() {
  return loadConfig().reducedMotion === true;
}

// Applies to the DOM by itself - no storage read/write, same split as
// applyThemeMode()/setThemeMode() below. Only [data-reduced-motion]
// itself is new here; shared.css's existing prefers-reduced-motion
// media-query block (the one neutralizing every CSS transition/
// @keyframes animation site-wide for a player whose OS already
// requests it) gets a twin selector keyed off this attribute instead,
// so the two stay byte-for-byte in sync rather than this duplicating
// that rule's own declarations here in JS. This is what actually
// catches a raw CSS animation/transition that isn't gated by a JS
// check (a game's own cached delay() helper, or a live
// prefersReducedMotion() call like Metro Crush's collapseBoard()) -
// those two keep working exactly as before, since
// prefersReducedMotion() itself (see its own comment above) already
// folds this same setting in.
function applyReducedMotion(enabled) {
  if (enabled) {
    document.documentElement.setAttribute('data-reduced-motion', 'true');
  } else {
    document.documentElement.removeAttribute('data-reduced-motion');
  }
}

// Persists + applies in one call, immediately, no reload needed - what
// /configurar/'s own toggle calls on each click, same as
// setThemeMode().
function setReducedMotion(enabled) {
  var normalized = !!enabled;
  saveConfig({ reducedMotion: normalized });
  applyReducedMotion(normalized);
  return normalized;
}

// Every page's own inline <head> snippet already applies the stored
// theme before first paint (right after shared.css's own <link>, see
// any page's <head>) to avoid a flash of the wrong theme - shared.js
// loads too late in <body> for that job and can't be the mechanism
// that prevents it. This call is only a harmless, idempotent safety
// net for a page whose snippet is missing or out of date.
applyThemeMode(getThemeMode());

// Unlike the theme above, there's no pre-paint flash to avoid here (a
// frame of default motion behavior isn't jarring the way a wrong
// light/dark theme is), so this one call, running once as shared.js
// itself loads, is this setting's only real application point - not a
// backup for a per-page snippet, since none exists for this setting.
// Comfortably before any game's own animations can start, since
// nothing on these pages animates before the player interacts with it.
applyReducedMotion(getReducedMotion());

function firebaseReady() {
  return typeof firebase !== 'undefined' && firebase.apps && firebase.apps.length > 0;
}

// A localStorage-backed stand-in for the same collection/dateKey/entries
// shape Firestore would hold, so a page can exercise the whole
// submit-then-render-a-top-5 flow before any real Firebase project
// exists - or, in a sandboxed context that can never reach Firestore at
// all (like a Claude Artifact preview), as the only backend it'll ever
// have. Opt-in only (see the `options.useLocalFallback` checks below) so
// a page that hasn't asked for it keeps the original behavior: a real
// Firestore write/read when configured, a clean no-op otherwise.
var LEADERBOARD_FALLBACK_PREFIX = 'metrordle:leaderboard-fallback:';

function fallbackStorageKey(collectionName, dateKey) {
  return LEADERBOARD_FALLBACK_PREFIX + collectionName + ':' + dateKey;
}

function loadFallbackEntries(collectionName, dateKey) {
  try {
    var raw = localStorage.getItem(fallbackStorageKey(collectionName, dateKey));
    var parsed = raw ? JSON.parse(raw) : null;
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    return {};
  }
}

function saveFallbackEntries(collectionName, dateKey, entries) {
  try {
    localStorage.setItem(fallbackStorageKey(collectionName, dateKey), JSON.stringify(entries));
  } catch (e) {
    // localStorage unavailable (private mode, quota, etc.) - the
    // fallback entry just won't persist, same tradeoff as everything
    // else this site keeps in localStorage.
  }
}

// Ranks entries by an ordered list of [fieldName, 'asc'|'desc'] pairs -
// e.g. [['score', 'desc']] for Memoria (higher wins), or
// [['stations', 'asc'], ['transfers', 'asc']] for Laberinto (fewer of
// both wins, stations breaking ties first). submittedAt ascending is
// always the final tiebreak. Used for both the real Firestore path in
// getTopLeaderboardScores() below (which only asks Firestore itself to
// sort by orderBySpecs[0] - see that function's own comment for why)
// and the local fallback path.
function compareByOrderSpecs(orderBySpecs) {
  return function (a, b) {
    for (var i = 0; i < orderBySpecs.length; i++) {
      var field = orderBySpecs[i][0];
      var dir = orderBySpecs[i][1] === 'desc' ? -1 : 1;
      // A field can be missing entirely on an entry submitted before
      // that field existed on this collection (e.g. hardMode, added to
      // Metrordle/Metroguessr's leaderboards after each already had
      // real entries) - treated as false/0 rather than left undefined,
      // which would otherwise make the arithmetic below NaN and silently
      // treat every entry as tied on this field regardless of its real
      // value.
      var av = a[field] === undefined ? false : a[field];
      var bv = b[field] === undefined ? false : b[field];
      if (av !== bv) return dir * (av - bv);
    }
    return a.submittedAt - b.submittedAt;
  };
}

function submitLeaderboardScoreFallback(collectionName, dateKey, alias, fields) {
  var docId = aliasDocId(alias);
  if (!docId) return Promise.reject(new Error('Alias is required'));

  var entries = loadFallbackEntries(collectionName, dateKey);
  entries[docId] = Object.assign({ alias: normalizeAlias(alias), submittedAt: Date.now() }, fields);
  saveFallbackEntries(collectionName, dateKey, entries);
  return Promise.resolve();
}

function getTopLeaderboardScoresFallback(collectionName, dateKey, limitCount, orderBySpecs) {
  var entries = loadFallbackEntries(collectionName, dateKey);
  var results = Object.keys(entries).map(function (docId) {
    return Object.assign({ id: docId }, entries[docId]);
  });
  results.sort(compareByOrderSpecs(orderBySpecs));
  return Promise.resolve(results.slice(0, limitCount));
}

function firebaseStatusForLog() {
  return {
    firebaseDefined: typeof firebase !== 'undefined',
    firebaseAppsCount: (typeof firebase !== 'undefined' && firebase.apps) ? firebase.apps.length : 'n/a',
    firebaseReady: firebaseReady(),
  };
}

// Upserts (creates or overwrites) the caller's entry for that day - "last
// write wins" if the same alias submits from more than one device on the
// same day, which is an accepted simplification rather than a bug.
// `fields` is the game-specific ranked data to store alongside alias/
// submittedAt - e.g. { score: 10 } for Memoria, or { stations: 12,
// transfers: 2 } for Laberinto.
function submitLeaderboardScore(collectionName, dateKey, alias, fields, options) {
  var docId = aliasDocId(alias);
  var path = collectionName + '/' + dateKey + '/entries/' + docId;
  console.log('[Leaderboard] submitLeaderboardScore()', Object.assign({
    path: path, alias: alias, fields: fields, useLocalFallback: !!(options && options.useLocalFallback),
  }, firebaseStatusForLog()));

  if (!firebaseReady()) {
    if (options && options.useLocalFallback) {
      console.log('[Leaderboard] Firebase not ready - writing to the localStorage fallback instead:', path);
      return submitLeaderboardScoreFallback(collectionName, dateKey, alias, fields);
    }
    console.warn('[Leaderboard] Firebase not ready and no fallback requested - write skipped:', path);
    return Promise.reject(new Error('Firebase not available'));
  }

  if (!docId) {
    console.warn('[Leaderboard] Empty/invalid alias - write skipped:', path);
    return Promise.reject(new Error('Alias is required'));
  }

  console.log('[Leaderboard] Writing to Firestore:', path);
  return firebase.firestore()
    .collection(collectionName).doc(dateKey).collection('entries').doc(docId)
    .set(Object.assign({
      alias: normalizeAlias(alias),
      submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
    }, fields))
    .then(function () {
      console.log('[Leaderboard] Write succeeded:', path);
    })
    .catch(function (err) {
      console.error('[Leaderboard] Write FAILED:', path, '\n  code:', err && err.code, '\n  message:', err && err.message, '\n  full error:', err);
      throw err;
    });
}

// Resolves to [] (never rejects) when Firebase isn't available (and no
// fallback was requested) or the query fails - an empty leaderboard is a
// fine degraded state for a read, unlike a failed write, which callers
// may want to surface differently. `orderBySpecs` is an ordered list of
// [fieldName, 'asc'|'desc'] pairs (see compareByOrderSpecs above) - each
// returned entry carries whichever of those fields the doc has, plus id,
// alias, and any `options.extraFields` (an array of field names) too -
// for a field that's purely informational (rendered somewhere, never
// sorted/tie-broken on), passing it as an orderBySpecs entry would only
// buy it the exclusion risk described below for no benefit; extraFields
// is how such a field still reaches the returned entry at all, since
// otherwise it's silently dropped even though the Firestore document
// itself has it - Metroguessr's own hintsUsed field originally tripped
// over exactly this before this parameter existed: it was rendered via
// entry.hintsUsed in that page's own renderLeaderboard(), but nothing
// ever asked this function to actually copy it over, so it read
// undefined for every real, Firestore-backed entry despite being
// correctly submitted by submitScore().
//
// Only orderBySpecs[0] is ever passed to Firestore's own .orderBy() -
// Firestore silently EXCLUDES a document from the results (no error)
// if it's missing ANY field an active .orderBy() clause names, which
// is exactly what happens to every entry submitted before a later
// orderBySpecs field existed on that collection (e.g. hardMode, added
// to Metrordle's and then Metroguessr's leaderboards well after each
// already had real entries - see AGENTS.md's "Leaderboards" section).
// orderBySpecs[0] itself is safe there because it's each collection's
// original ranking field, present on every entry since the collection
// was created. Every later field is instead applied client-side via
// compareByOrderSpecs() (which already treats a missing field as
// false/0, so an old entry just never wins a tiebreak it predates
// rather than vanishing outright) - fetched well past limitCount first
// so that re-sort still has every real contender to promote ahead of a
// same-orderBySpecs[0] entry it should beat on a later tiebreak. This
// is a casual, low-traffic leaderboard, not a paginated one, so
// over-fetching like this is cheap.
//
// Every returned entry also carries its own real board `rank` (1-based,
// computed from the full re-sorted list, before limitCount trims it) -
// a page's own renderLeaderboard() should always show `entry.rank` (via
// formatRank() below, not a bare `entry.rank` read), not just its
// position in the returned array, since that position stops matching
// the real rank the moment `options.myAliasId` (below) pulls in a row
// from further down the board.
//
// `options.myAliasId`, if given, guarantees that alias's own entry is
// somewhere in the returned list - if it would already be within the
// top `limitCount` this changes nothing, otherwise its own row replaces
// the last slot so the list still holds at most `limitCount` rows (e.g.
// limitCount 5, the caller's own alias actually ranked #7: returns
// #1-4 plus #7, not #1-5). A page's own on-page leaderboard uses this so
// a player can always find themselves on the board; /admin/'s own,
// uncapped view (limitCount far past any real day's entry count) has
// nothing to guarantee - everyone's already shown - so it never passes
// this option.
//
// The sort/rank/myAliasId-substitution part of this (as opposed to the
// actual Firestore fetch above it) is pulled out into its own
// rankAndSelect() below, rather than inlined here, for two reasons: it's
// unit-testable on its own with a plain array (no Firestore/browser
// stub needed), and it's the same shape a test's own fixture data should
// be built with - see formatRank()'s own comment for the bug this is
// guarding against.
function rankAndSelect(entries, orderBySpecs, limitCount, myAliasId) {
  var results = entries.slice();
  results.sort(compareByOrderSpecs(orderBySpecs));
  results.forEach(function (entry, index) {
    entry.rank = index + 1;
  });

  var top = results.slice(0, limitCount);
  if (myAliasId) {
    var alreadyShown = false;
    for (var i = 0; i < top.length; i++) {
      if (top[i].id === myAliasId) { alreadyShown = true; break; }
    }
    if (!alreadyShown) {
      var mine = null;
      for (var j = 0; j < results.length; j++) {
        if (results[j].id === myAliasId) { mine = results[j]; break; }
      }
      if (mine) top = top.slice(0, limitCount - 1).concat([mine]);
    }
  }
  return top;
}

// The one place that turns an entry into the '#N' text a row actually
// shows - every one of the 6 leaderboard-rendering pages (5 games +
// /admin/) should call this instead of reading entry.rank directly.
// Guards against exactly the bug that shipped once already: a hand-
// authored test/fixture array (or any other caller that bypasses the
// real getTopLeaderboardScores()/rankAndSelect() above) that forgets to
// set .rank rendered the literal string "#undefined" in production-
// shaped markup, with nothing to catch it - schema drift between the
// data layer's contract (every entry has a numeric rank) and the render
// layer's assumption that the contract always holds. Falling back to
// the entry's own array position isn't always the *correct* rank (it
// can't be, once myAliasId's own substitution is in play), but it's a
// plausible-looking number instead of visibly broken text, and the
// console.warn means a real occurrence is still debuggable rather than
// silently wrong.
function formatRank(entry, index) {
  if (typeof entry.rank === 'number') return entry.rank;
  console.warn('[Leaderboard] entry missing its own .rank - falling back to array position:', entry);
  return index + 1;
}

function getTopLeaderboardScores(collectionName, dateKey, limitCount, orderBySpecs, options) {
  var path = collectionName + '/' + dateKey + '/entries';
  console.log('[Leaderboard] getTopLeaderboardScores()', Object.assign({
    path: path, limitCount: limitCount, orderBySpecs: orderBySpecs, extraFields: (options && options.extraFields) || [],
    myAliasId: (options && options.myAliasId) || null,
    useLocalFallback: !!(options && options.useLocalFallback),
  }, firebaseStatusForLog()));

  if (!firebaseReady()) {
    if (options && options.useLocalFallback) {
      console.log('[Leaderboard] Firebase not ready - reading from the localStorage fallback instead:', path);
      return getTopLeaderboardScoresFallback(collectionName, dateKey, limitCount, orderBySpecs);
    }
    console.warn('[Leaderboard] Firebase not ready and no fallback requested - read returns []:', path);
    return Promise.resolve([]);
  }

  console.log('[Leaderboard] Querying Firestore:', path);
  var primarySpec = orderBySpecs[0];
  var fetchLimit = Math.max(limitCount, 1000);
  var extraFields = (options && options.extraFields) || [];
  var query = firebase.firestore().collection(collectionName).doc(dateKey).collection('entries')
    .orderBy(primarySpec[0], primarySpec[1])
    .limit(fetchLimit);

  return query
    .get()
    .then(function (snapshot) {
      var results = [];
      snapshot.forEach(function (doc) {
        var data = doc.data();
        var entry = {
          id: doc.id,
          alias: data.alias,
          submittedAt: data.submittedAt ? data.submittedAt.toMillis() : 0,
        };
        orderBySpecs.forEach(function (spec) {
          entry[spec[0]] = data[spec[0]];
        });
        extraFields.forEach(function (field) {
          entry[field] = data[field];
        });
        results.push(entry);
      });
      var top = rankAndSelect(results, orderBySpecs, limitCount, options && options.myAliasId);
      console.log('[Leaderboard] Query succeeded:', path, '- got', top.length, 'result(s):', top);
      return top;
    })
    .catch(function (err) {
      console.error('[Leaderboard] Query FAILED:', path, '\n  code:', err && err.code, '\n  message:', err && err.message, '\n  full error:', err);
      return [];
    });
}

// records/{gameKey} - a single long-lived document per game tracking its
// own highest score ever, for Memoria and Metro Crush only (the two
// games ranked by a raw score rather than a fixed puzzle's outcome, so
// "highest ever" is meaningful to chase) - see firestore.rules' own
// comment on this collection for the full design rationale.
//
// A Firestore transaction (not a plain read-then-write) is what makes
// this safe against two players' near-simultaneous submissions both
// reading the same "old" record and both believing they're the new high
// score - only one of two transactions racing on the same document can
// commit; Firestore itself detects the conflict and retries the loser
// against the now-current data, so the comparison this function makes
// is always against a genuinely fresh read.
//
// Called as a best-effort side effect of a successful leaderboard
// submission (same pattern as the leaderboard write itself) - never
// rejects, so a transaction failure can't interfere with the player's
// own already-succeeded leaderboard submission. Resolves
// { isNewRecord, record } either way, so a caller that wants to
// celebrate a new record can check isNewRecord without needing its own
// try/catch.
function updateHighScoreRecord(gameKey, score, alias, dateKey, gameNumber) {
  var path = 'records/' + gameKey;
  console.log('[HighScore] updateHighScoreRecord()', Object.assign({
    path: path, score: score, alias: alias, dateKey: dateKey, gameNumber: gameNumber,
  }, firebaseStatusForLog()));

  if (!firebaseReady()) {
    console.warn('[HighScore] Firebase not ready - update skipped:', path);
    return Promise.resolve({ isNewRecord: false, record: null });
  }

  var docRef = firebase.firestore().collection('records').doc(gameKey);
  return firebase.firestore().runTransaction(function (transaction) {
    return transaction.get(docRef).then(function (snapshot) {
      var current = snapshot.exists ? snapshot.data() : null;
      // A tie keeps the earlier holder's own record - matches
      // firestore.rules' own strict `score > resource.data.score`
      // requirement on update, so a tied write here would only ever be
      // rejected server-side anyway.
      if (current && current.score >= score) {
        return { isNewRecord: false, record: current };
      }
      var record = {
        score: score,
        alias: normalizeAlias(alias),
        dateKey: dateKey,
        gameNumber: gameNumber,
        submittedAt: firebase.firestore.FieldValue.serverTimestamp(),
      };
      transaction.set(docRef, record);
      return { isNewRecord: true, record: record };
    });
  })
    .then(function (result) {
      console.log('[HighScore] Transaction succeeded:', path, result);
      return result;
    })
    .catch(function (err) {
      console.error('[HighScore] Transaction FAILED:', path, '\n  code:', err && err.code, '\n  message:', err && err.message, '\n  full error:', err);
      return { isNewRecord: false, record: null };
    });
}

// Plain read for display (e.g. /admin/'s own stat tiles) - never part of
// a transaction, so safe to call as often as needed. Resolves null both
// when Firebase isn't reachable and when the record simply doesn't
// exist yet (no score has ever been submitted for that game) - a caller
// treats both the same way, nothing to show yet.
function getHighScoreRecord(gameKey) {
  var path = 'records/' + gameKey;
  console.log('[HighScore] getHighScoreRecord()', Object.assign({ path: path }, firebaseStatusForLog()));

  if (!firebaseReady()) {
    console.warn('[HighScore] Firebase not ready - read returns null:', path);
    return Promise.resolve(null);
  }

  return firebase.firestore().collection('records').doc(gameKey).get()
    .then(function (snapshot) {
      if (!snapshot.exists) return null;
      var data = snapshot.data();
      return { score: data.score, alias: data.alias, dateKey: data.dateKey, gameNumber: data.gameNumber };
    })
    .catch(function (err) {
      console.error('[HighScore] Read FAILED:', path, '\n  code:', err && err.code, '\n  message:', err && err.message, '\n  full error:', err);
      return null;
    });
}

// record.dateKey comes straight from Firestore with no shape validation
// beyond firestore.rules' own `is string` check (see records/{gameKey}'s
// own comment) - it isn't necessarily a clean 'YYYY-MM-DD' the way every
// OTHER dateKey in this app always is, since (unlike every other write
// to Firestore here) records/{gameKey} can also be hand-edited directly
// in the Firebase console rather than only ever written by
// updateHighScoreRecord() - exactly how the real records/metrocrush
// document ended up with a trailing "\n" on its dateKey from a console
// copy-paste, which silently produced a literal "Invalid Date" string
// here (new Date(...).toLocaleDateString() on an unparseable input
// returns that as text, it doesn't throw). trim() alone fixes that
// specific case; isNaN(d.getTime()) below is the actual fault-tolerance
// backstop, for anything trim() doesn't - a missing/non-string dateKey,
// or one that still isn't a real date after trimming.
function formatRecordDateLabel(dateKey) {
  if (typeof dateKey !== 'string') return null;
  var d = new Date(dateKey.trim() + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  // es-MX, matching the rest of the site's own copy/UI language -
  // '20 sep 2026'.
  return d.toLocaleDateString('es-MX', { month: 'short', day: 'numeric', year: 'numeric' });
}

// One shared renderer for a getHighScoreRecord() result, used by
// /admin/ and by Memoria's/Metro Crush's own reveal screens alike -
// '🏆 Récord: 39 por 🐱 · #23 · 20 sep 2026', or the same line with the
// trailing date dropped entirely (not "· Invalid Date") when
// formatRecordDateLabel() can't make sense of record.dateKey.
function formatHighScoreRecord(record) {
  var base = '🏆 Récord: ' + record.score + ' por ' + record.alias + ' · #' + record.gameNumber;
  var dateLabel = formatRecordDateLabel(record.dateKey);
  return dateLabel ? base + ' · ' + dateLabel : base;
}

window.MetroShared = {
  LINES: LINES,
  STATION_ICON_SLUGS: STATION_ICON_SLUGS,
  hashStringToInt: hashStringToInt,
  createSeededRandom: createSeededRandom,
  pad2: pad2,
  getDateKey: getDateKey,
  getPreviousDateKey: getPreviousDateKey,
  getGameNumberForDateKey: getGameNumberForDateKey,
  getSuggestedGames: getSuggestedGames,
  buildGamePromo: buildGamePromo,
  isDebugMode: isDebugMode,
  getEffectiveToday: getEffectiveToday,
  prefersReducedMotion: prefersReducedMotion,
  copyViaExecCommand: copyViaExecCommand,
  copyToClipboard: copyToClipboard,
  shareOrCopyText: shareOrCopyText,
  loadStreak: loadStreak,
  saveStreak: saveStreak,
  updateStreakForResult: updateStreakForResult,
  formatStreak: formatStreak,
  formatMaxStreak: formatMaxStreak,
  buildStreakBadge: buildStreakBadge,
  normalizeAlias: normalizeAlias,
  aliasDocId: aliasDocId,
  getAlias: getAlias,
  setAlias: setAlias,
  loadConfig: loadConfig,
  saveConfig: saveConfig,
  getThemeMode: getThemeMode,
  applyThemeMode: applyThemeMode,
  setThemeMode: setThemeMode,
  getReducedMotion: getReducedMotion,
  applyReducedMotion: applyReducedMotion,
  setReducedMotion: setReducedMotion,
  submitLeaderboardScore: submitLeaderboardScore,
  getTopLeaderboardScores: getTopLeaderboardScores,
  rankAndSelect: rankAndSelect,
  formatRank: formatRank,
  updateHighScoreRecord: updateHighScoreRecord,
  getHighScoreRecord: getHighScoreRecord,
  formatHighScoreRecord: formatHighScoreRecord,
};
