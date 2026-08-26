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

function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
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

function loadStreak(storageKey) {
  try {
    var raw = localStorage.getItem(storageKey);
    if (!raw) return { count: 0, lastResultDate: null };
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed.count !== 'number') return { count: 0, lastResultDate: null };
    return parsed;
  } catch (e) {
    return { count: 0, lastResultDate: null };
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

  streak.lastResultDate = dateKey;
  saveStreak(storageKey, streak);

  return streak.count;
}

function formatStreak(count) {
  return 'Racha: ' + count + (count === 1 ? ' día' : ' días');
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

window.MetroShared = {
  LINES: LINES,
  STATION_ICON_SLUGS: STATION_ICON_SLUGS,
  hashStringToInt: hashStringToInt,
  createSeededRandom: createSeededRandom,
  pad2: pad2,
  getDateKey: getDateKey,
  getPreviousDateKey: getPreviousDateKey,
  getGameNumberForDateKey: getGameNumberForDateKey,
  isDebugMode: isDebugMode,
  getEffectiveToday: getEffectiveToday,
  prefersReducedMotion: prefersReducedMotion,
  copyViaExecCommand: copyViaExecCommand,
  copyToClipboard: copyToClipboard,
  loadStreak: loadStreak,
  saveStreak: saveStreak,
  updateStreakForResult: updateStreakForResult,
  formatStreak: formatStreak,
};
