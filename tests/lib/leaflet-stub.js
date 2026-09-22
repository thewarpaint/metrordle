// A fake Leaflet + maplibre-gl-leaflet bridge, served in place of the
// real CDN scripts (see stubMap() in metroguessr-helpers.js) so
// Metroguessr's tests don't depend on cdnjs.cloudflare.com/
// cdn.jsdelivr.net/tiles.openfreemap.org being reachable, or on real
// map tiles rendering at all. Unlike Firebase elsewhere in this test
// suite (an OPTIONAL dependency the app itself degrades gracefully
// without, deliberately left unstubbed so a real "player whose network
// blocks Firebase" is exercised for free), Leaflet is a hard rendering
// dependency here - if `L` never loads, `L.map(...)` throws and nothing
// on the page works at all, so there is no "degrades gracefully"
// behavior to test. Stubbing it lets these tests reliably exercise
// Metroguessr's own game logic (guessing, scoring, reveal, leaderboard)
// without coupling to third-party map rendering or live network access.
//
// This file is loaded as a plain script (via fs.readFileSync in
// metroguessr-helpers.js, then route.fulfill()'d in place of the real
// CDN response) rather than required as a Node module - it runs in the
// PAGE, not in the test process. Elements it creates are never attached
// to the real document (see makeEl()) - a test reads them via the
// window.__mg* globals this file sets, not via page.locator().
window.L = (function () {
  function makeEl(className) {
    var el = document.createElement('div');
    el.className = className || '';
    return el;
  }
  function makeHandler(name) {
    var h = { _enabled: false, enable: function () { h._enabled = true; }, disable: function () { h._enabled = false; } };
    window.__mgHandlers = window.__mgHandlers || {};
    window.__mgHandlers[name] = h;
    return h;
  }
  return {
    map: function (id, opts) {
      var layers = [];
      var obj = {
        _center: null, _zoom: null,
        dragging: makeHandler('dragging'),
        touchZoom: makeHandler('touchZoom'),
        scrollWheelZoom: makeHandler('scrollWheelZoom'),
        doubleClickZoom: makeHandler('doubleClickZoom'),
        boxZoom: makeHandler('boxZoom'),
        keyboard: makeHandler('keyboard'),
        setView: function (latlng, zoom) { obj._center = latlng; obj._zoom = zoom; return obj; },
        addLayer: function (layer) { if (layers.indexOf(layer) === -1) layers.push(layer); return obj; },
        removeLayer: function (layer) {
          var i = layers.indexOf(layer);
          if (i !== -1) layers.splice(i, 1);
          return obj;
        },
        hasLayer: function (layer) { return layers.indexOf(layer) !== -1; },
        removeControl: function () { window.__mgZoomControlAdded = false; return obj; },
        panBy: function (offset) {
          window.__mgLastPanByOffset = { x: offset[0], y: offset[1] };
          return obj;
        },
      };
      window.__mgMap = obj;
      return obj;
    },
    control: {
      attribution: function () {
        var c = { addAttribution: function () { return c; }, addTo: function () { return c; } };
        return c;
      },
      zoom: function () {
        var c = { addTo: function () { window.__mgZoomControlAdded = true; return c; } };
        return c;
      },
    },
    tileLayer: function (url, opts) {
      var t = {
        url: url,
        addTo: function (map) { map.addLayer(t); return t; },
      };
      window.__mgTileLayer = t;
      return t;
    },
    circleMarker: function (latlng, opts) {
      var el = makeEl(opts.className);
      window.__mgMarkerEl = el;
      var m = {
        _el: el, _latlng: latlng,
        addTo: function (map) { map.addLayer(m); return m; },
        setLatLng: function (ll) { m._latlng = ll; return m; },
        setStyle: function () { return m; },
        getElement: function () { return el; },
      };
      window.__mgLastCircle = m;
      return m;
    },
    divIcon: function (opts) {
      return { options: opts || {} };
    },
    // Every L.marker() call (the reveal's own icon badge AND each debug
    // guess pin) gets recorded in window.__mgMarkers, keyed by
    // className, so a test can inspect any of them without needing a
    // real DOM to query.
    marker: function (latlng, opts) {
      opts = opts || {};
      var icon = opts.icon || { options: {} };
      var el = makeEl(icon.options.className);
      if (icon.options.html) el.innerHTML = icon.options.html;
      var m = {
        _el: el, _latlng: latlng,
        addTo: function (map) { map.addLayer(m); return m; },
        setLatLng: function (ll) { m._latlng = ll; return m; },
        getElement: function () { return el; },
      };
      window.__mgMarkers = window.__mgMarkers || [];
      window.__mgMarkers.push({ latlng: latlng, className: icon.options.className, el: el, marker: m });
      if (icon.options.className === 'target-icon-marker') window.__mgIconMarkerEl = el;
      return m;
    },
    // Stands in for the real maplibre-gl-leaflet bridge - a fake vector
    // "style" with a representative mix of symbol (label) and
    // non-symbol layers, so applyLabelVisibility()'s "toggle every
    // symbol layer" logic has something real to filter. Simulates a
    // realistic 'data' event sequence (a non-style event first, THEN
    // the style one, both async) so a test exercises the real code's
    // dataType === 'style' filter actually discriminating between
    // them, not just reacting to whatever fires first.
    maplibreGL: function (opts) {
      // Records which style URL setTileLayer() actually picked
      // (MAPLIBRE_STYLES.light vs .dark) so a test can assert on it
      // directly, rather than inferring it from rendered tiles that
      // this stub never really draws.
      window.__mgLastGlStyle = opts && opts.style;
      var layers = [
        { id: 'background', type: 'background' },
        { id: 'water', type: 'fill' },
        { id: 'roads', type: 'line' },
        { id: 'place-labels', type: 'symbol' },
        { id: 'poi-labels', type: 'symbol' },
      ];
      var listeners = {};

      var glMap = {
        style: opts && opts.style,
        on: function (event, cb) {
          listeners[event] = listeners[event] || [];
          listeners[event].push(cb);
        },
        off: function (event, cb) {
          if (!listeners[event]) return;
          var i = listeners[event].indexOf(cb);
          if (i !== -1) listeners[event].splice(i, 1);
        },
        _fire: function (event, payload) {
          (listeners[event] || []).slice().forEach(function (cb) { cb(payload); });
        },
        getStyle: function () { return { layers: layers }; },
        setLayoutProperty: function (layerId, prop, value) {
          window.__mgLayoutProps = window.__mgLayoutProps || {};
          window.__mgLayoutProps[layerId] = window.__mgLayoutProps[layerId] || {};
          window.__mgLayoutProps[layerId][prop] = value;
        },
      };

      // Staggered on purpose (not both at 0ms) so a test can reliably
      // sample state in between: after the non-style event fires but
      // before the style one does.
      setTimeout(function () { glMap._fire('data', { dataType: 'source' }); }, 0);
      setTimeout(function () { glMap._fire('data', { dataType: 'style' }); }, 60);

      var gl = {
        addTo: function (map) { map.addLayer(gl); return gl; },
        getMaplibreMap: function () { return glMap; },
      };
      window.__mgLastGlLayer = gl;
      return gl;
    },
  };
})();
