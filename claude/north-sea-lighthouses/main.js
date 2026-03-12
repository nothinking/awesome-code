(function () {
  "use strict";

  /* ── Data ────────────────────────────────────────────── */
  var dataset = window.NORTH_SEA_LIGHTHOUSES_DATA;
  if (!dataset || !Array.isArray(dataset.lighthouses)) {
    document.body.innerHTML = '<p style="color:#f44;padding:2rem">Lighthouse dataset not loaded.</p>';
    return;
  }

  var LP = window.LightPatterns;
  var allRecords = dataset.lighthouses;

  /* ── Colour palette ─────────────────────────────────── */
  var COLOURS = {
    white:  "#FFFDE7",
    red:    "#FF1744",
    green:  "#00E676",
    yellow: "#FFD600",
    blue:   "#64B5F6",
    orange: "#FFA726",
  };

  var COUNTRY_FLAGS = {
    "Great Britain": "\uD83C\uDDEC\uD83C\uDDE7",
    "Norway": "\uD83C\uDDF3\uD83C\uDDF4",
    "Denmark": "\uD83C\uDDE9\uD83C\uDDF0",
    "Germany": "\uD83C\uDDE9\uD83C\uDDEA",
    "Netherlands": "\uD83C\uDDF3\uD83C\uDDF1",
    "Belgium / France": "\uD83C\uDDE7\uD83C\uDDEA",
  };

  /* ── State ──────────────────────────────────────────── */
  var state = {
    activeColours: new Set(Object.keys(COLOURS)),
    minRange: 0,
    searchText: "",
    showRangeCircles: false,
    showLabels: true,
    showBlink: true,
  };

  /* ── DOM refs ───────────────────────────────────────── */
  var statTotal     = document.getElementById("stat-total");
  var statVisible   = document.getElementById("stat-visible");
  var statMedian    = document.getElementById("stat-median");
  var statLongest   = document.getElementById("stat-longest");
  var searchInput   = document.getElementById("search-input");
  var rangeSlider   = document.getElementById("range-slider");
  var rangeValue    = document.getElementById("range-value");
  var colourFilters = document.getElementById("colour-filters");
  var toggleRange   = document.getElementById("toggle-range");
  var toggleLabels  = document.getElementById("toggle-labels");
  var toggleBlink   = document.getElementById("toggle-blink");
  var sourceNote    = document.getElementById("source-note");
  var sidebar       = document.getElementById("sidebar");
  var sidebarToggle = document.getElementById("sidebar-toggle");

  /* ── Map init ───────────────────────────────────────── */
  var map = L.map("map-container", {
    center: [56, 4],
    zoom: 6,
    minZoom: 4,
    maxZoom: 14,
    zoomControl: true,
  });

  L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png", {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
    subdomains: "abcd",
    maxZoom: 19,
  }).addTo(map);

  /* ── Layers ─────────────────────────────────────────── */
  var markerLayer = L.layerGroup().addTo(map);
  var rangeLayer  = L.layerGroup();
  var labelLayer  = L.layerGroup().addTo(map);

  /* ── Helpers ────────────────────────────────────────── */
  var NM_TO_M = 1852;

  function colourHex(c) { return COLOURS[c] || COLOURS.white; }

  function markerSize(rec, zoom) {
    var base = 4 + (rec.rangeNm || 0) * 0.35;
    var scale = Math.max(0.5, Math.min(1.4, (zoom - 4) / 6));
    return Math.max(4, Math.min(16, base * scale));
  }

  function formatRange(nm) { return nm ? nm + " nm (" + (nm * 1.852).toFixed(1) + " km)" : "-"; }

  function titleCase(s) {
    return s.replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }

  function median(arr) {
    if (!arr.length) return null;
    var s = arr.slice().sort(function (a, b) { return a - b; });
    return s[Math.floor(s.length / 2)];
  }

  /* ── Build colour filter buttons ────────────────────── */
  function initColourFilters() {
    var names = { white: "흰색", red: "빨간색", green: "초록색", yellow: "노란색", blue: "파란색", orange: "주황색" };
    Object.keys(COLOURS).forEach(function (c) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "colour-btn active";
      btn.dataset.colour = c;
      btn.innerHTML = '<span class="dot" style="background:' + COLOURS[c] + ';box-shadow:0 0 6px ' + COLOURS[c] + '"></span>' + (names[c] || titleCase(c));
      btn.addEventListener("click", function () {
        if (state.activeColours.has(c) && state.activeColours.size === 1) return;
        if (state.activeColours.has(c)) {
          state.activeColours.delete(c);
          btn.classList.remove("active");
        } else {
          state.activeColours.add(c);
          btn.classList.add("active");
        }
        applyFilters();
      });
      colourFilters.appendChild(btn);
    });
  }

  /* ── Filtering ──────────────────────────────────────── */
  function matchSearch(rec) {
    if (!state.searchText) return true;
    var q = state.searchText.toLowerCase();
    return (rec.name && rec.name.toLowerCase().indexOf(q) !== -1) ||
           (rec.region && rec.region.toLowerCase().indexOf(q) !== -1) ||
           (rec.reference && String(rec.reference).toLowerCase().indexOf(q) !== -1);
  }

  function filterRecords() {
    return allRecords.filter(function (rec) {
      return (rec.rangeNm || 0) >= state.minRange &&
             matchSearch(rec) &&
             state.activeColours.has(rec.primaryColour);
    });
  }

  /* ── Render markers ─────────────────────────────────── */
  function clearLayers() {
    markerLayer.clearLayers();
    rangeLayer.clearLayers();
    labelLayer.clearLayers();
  }

  function renderMarkers(records) {
    clearLayers();
    var zoom = map.getZoom();

    records.forEach(function (rec) {
      var hex = colourHex(rec.primaryColour);
      var size = markerSize(rec, zoom);
      var glowSize = size * 2.2;

      /* Build marker HTML */
      var animCSS = "";
      if (state.showBlink && rec.lights && rec.lights.length > 0) {
        animCSS = LP.getAnimationCSS(rec.lights[0]);
      }
      var coreStyle = "width:" + size + "px;height:" + size + "px;background:" + hex + ";";
      if (animCSS) coreStyle += "animation:" + animCSS + ";";

      var glowStyle = "width:" + glowSize + "px;height:" + glowSize + "px;background:" + hex + ";";
      if (animCSS) glowStyle += "animation:" + animCSS + ";";

      var html = '<div class="lh-marker" style="width:' + glowSize + 'px;height:' + glowSize + 'px;">' +
        '<span class="lh-glow" style="' + glowStyle + '"></span>' +
        '<span class="lh-core" style="' + coreStyle + '"></span>' +
        '</div>';

      var icon = L.divIcon({
        html: html,
        className: "",
        iconSize: [glowSize, glowSize],
        iconAnchor: [glowSize / 2, glowSize / 2],
        popupAnchor: [0, -glowSize / 2],
      });

      var marker = L.marker([rec.lat, rec.lon], { icon: icon });
      marker.bindPopup(function () { return buildPopup(rec); }, {
        maxWidth: 320,
        minWidth: 260,
        closeButton: true,
      });
      markerLayer.addLayer(marker);

      /* Range circle */
      if (state.showRangeCircles && rec.rangeNm) {
        var circle = L.circle([rec.lat, rec.lon], {
          radius: rec.rangeNm * NM_TO_M,
          color: hex,
          weight: 1,
          opacity: 0.4,
          fillColor: hex,
          fillOpacity: 0.06,
          dashArray: "4 4",
          interactive: false,
        });
        rangeLayer.addLayer(circle);
      }

      /* Name label */
      if (state.showLabels && zoom >= 8 && rec.name) {
        var labelIcon = L.divIcon({
          html: '<span class="lh-label">' + rec.name + '</span>',
          className: "",
          iconSize: [0, 0],
          iconAnchor: [-size / 2 - 4, 0],
        });
        labelLayer.addLayer(L.marker([rec.lat, rec.lon], { icon: labelIcon, interactive: false }));
      }
    });
  }

  /* ── Popup builder ──────────────────────────────────── */
  function buildPopup(rec) {
    var hex = colourHex(rec.primaryColour);
    var flag = COUNTRY_FLAGS[rec.region] || "";
    var patternDesc = rec.lights && rec.lights.length > 0
      ? LP.describePattern(rec.lights[0].character, rec.lights[0].group)
      : rec.pattern || "-";

    var h = '<div class="popup-inner">';
    h += '<h3>' + escapeHTML(rec.name) + '</h3>';
    h += '<p class="popup-location">' + escapeHTML(rec.region) + ' ' + flag + ' &middot; ' +
      rec.lat.toFixed(4) + '&deg;N, ' + rec.lon.toFixed(4) + '&deg;E</p>';

    h += '<dl class="popup-grid">';
    h += field("불빛", '<span class="popup-colour-dot" style="background:' + hex + '"></span> ' +
      titleCase(rec.primaryColour) + " " + patternDesc);
    h += field("주기", rec.periodSeconds ? rec.periodSeconds + "s" : "-");
    h += field("가시거리", formatRange(rec.rangeNm));
    h += field("높이", rec.heightMeters ? rec.heightMeters + "m" : "-");
    h += "</dl>";

    /* Blink preview */
    if (rec.lights && rec.lights.length > 0) {
      h += '<p class="popup-section-title">점멸 미리보기</p>';
      h += LP.buildPreviewHTML(rec.lights[0], hex);
    }

    /* Sector lights */
    if (rec.lights && rec.lights.length > 1) {
      h += '<p class="popup-section-title">섹터 라이트 (' + rec.lights.length + ')</p>';
      for (var i = 0; i < rec.lights.length; i++) {
        var lt = rec.lights[i];
        var lc = lt.colours && lt.colours.length > 0 ? lt.colours.map(titleCase).join("/") : "?";
        var sector = (lt.sectorStart != null && lt.sectorEnd != null)
          ? lt.sectorStart + "&deg;&ndash;" + lt.sectorEnd + "&deg;"
          : "전방향";
        h += '<div class="popup-sector">';
        h += '<p class="popup-sector-title">' + (lt.pattern || "-") + " &middot; " + lc + "</p>";
        h += '<p class="popup-sector-info">' + (lt.rangeNm ? lt.rangeNm + " nm" : "-") + " &middot; " + sector + "</p>";
        h += "</div>";
      }
    }

    /* Reference / links */
    if (rec.reference) {
      h += '<p class="popup-section-title">참조</p>';
      h += '<p style="margin:0;font-size:0.82rem;color:' + "var(--text-dim)" + '">' + escapeHTML(rec.reference) + '</p>';
    }

    h += "</div>";
    return h;
  }

  function field(label, value) {
    return '<div class="popup-field"><dt>' + label + '</dt><dd>' + value + '</dd></div>';
  }

  function escapeHTML(s) {
    if (!s) return "";
    return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  /* ── Stats update ───────────────────────────────────── */
  function updateStats(records) {
    statTotal.textContent = allRecords.length;
    statVisible.textContent = records.length;
    var ranges = records.map(function (r) { return r.rangeNm || 0; }).filter(function (v) { return v > 0; });
    var med = median(ranges);
    statMedian.textContent = med ? med + " nm" : "-";

    var sorted = records.slice().sort(function (a, b) { return (b.rangeNm || 0) - (a.rangeNm || 0); });
    statLongest.textContent = sorted[0] ? sorted[0].name + " (" + sorted[0].rangeNm + " nm)" : "-";
  }

  /* ── Apply all filters & re-render ──────────────────── */
  function applyFilters() {
    var records = filterRecords();
    updateStats(records);
    renderMarkers(records);
  }

  /* ── Event bindings ─────────────────────────────────── */
  searchInput.addEventListener("input", function () {
    state.searchText = searchInput.value.trim();
    applyFilters();
  });

  rangeSlider.addEventListener("input", function () {
    state.minRange = parseInt(rangeSlider.value, 10);
    rangeValue.textContent = state.minRange + " nm";
    applyFilters();
  });

  toggleRange.addEventListener("change", function () {
    state.showRangeCircles = toggleRange.checked;
    if (state.showRangeCircles) {
      map.addLayer(rangeLayer);
    } else {
      map.removeLayer(rangeLayer);
    }
    applyFilters();
  });

  toggleLabels.addEventListener("change", function () {
    state.showLabels = toggleLabels.checked;
    applyFilters();
  });

  toggleBlink.addEventListener("change", function () {
    state.showBlink = toggleBlink.checked;
    applyFilters();
  });

  map.on("zoomend", function () {
    applyFilters();
  });

  sidebarToggle.addEventListener("click", function () {
    sidebar.classList.toggle("collapsed");
  });

  /* ── Source note ─────────────────────────────────────── */
  function renderSourceNote() {
    var ts = dataset.metadata.osmBaseTimestamp
      ? new Date(dataset.metadata.osmBaseTimestamp).toLocaleDateString("ko-KR")
      : "N/A";
    sourceNote.innerHTML =
      "데이터: OpenStreetMap seamark tags (" + ts + ")<br/>" +
      "총 " + allRecords.length + "개 등대 &middot; 북해 다각형 필터 적용";
  }

  /* ── Init ───────────────────────────────────────────── */
  initColourFilters();
  renderSourceNote();
  applyFilters();
})();
