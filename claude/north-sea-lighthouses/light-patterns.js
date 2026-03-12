/**
 * light-patterns.js
 * Parses seamark light sequence strings and generates CSS @keyframes animations.
 * Exposed as window.LightPatterns for use by main.js.
 */
(function () {
  "use strict";

  var styleSheet = null;
  var createdAnimations = new Set();

  function ensureStyleSheet() {
    if (styleSheet) return;
    var style = document.createElement("style");
    style.id = "light-pattern-animations";
    document.head.appendChild(style);
    styleSheet = style.sheet;
  }

  /** Parse "0.3+(7.7)" → [{active:true,duration:0.3},{active:false,duration:7.7}] */
  function parseSequence(seq) {
    if (!seq) return [];
    return seq.split("+").map(function (p) {
      var t = p.trim();
      var on = !t.startsWith("(");
      var d = parseFloat(t.replace(/[()]/g, ""));
      return isFinite(d) && d > 0 ? { active: on, duration: d } : null;
    }).filter(Boolean);
  }

  /** Fallback when no explicit sequence tag exists */
  function defaultSequence(character, period) {
    if (!period || period <= 0) return [];
    var ch = (character || "").toUpperCase();
    switch (ch) {
      case "FL":
        var f = Math.min(1, period * 0.1);
        return [{ active: true, duration: f }, { active: false, duration: period - f }];
      case "LFL":
        var lf = Math.min(2, period * 0.3);
        return [{ active: true, duration: lf }, { active: false, duration: period - lf }];
      case "Q": {
        var s = [];
        for (var i = 0; i < Math.round(period); i++) {
          s.push({ active: true, duration: 0.25 }, { active: false, duration: 0.75 });
        }
        return s;
      }
      case "VQ": {
        var v = [];
        for (var j = 0; j < Math.round(period * 2); j++) {
          v.push({ active: true, duration: 0.15 }, { active: false, duration: 0.35 });
        }
        return v;
      }
      case "OC":
        var oc = Math.min(2, period * 0.3);
        return [{ active: true, duration: period - oc }, { active: false, duration: oc }];
      case "ISO":
        return [{ active: true, duration: period / 2 }, { active: false, duration: period / 2 }];
      case "F":
        return [{ active: true, duration: period || 1 }];
      default:
        var def = Math.min(1, period * 0.15);
        return [{ active: true, duration: def }, { active: false, duration: period - def }];
    }
  }

  function getSegments(light) {
    var s = parseSequence(light.sequence);
    return s.length > 0 ? s : defaultSequence(light.character, light.period);
  }

  function totalDuration(segs) {
    var sum = 0;
    for (var i = 0; i < segs.length; i++) sum += segs[i].duration;
    return sum;
  }

  function animKey(segs) {
    return segs.map(function (s) {
      return (s.active ? "on" : "off") + Math.round(s.duration * 100);
    }).join("-");
  }

  /** Inject a CSS @keyframes and return {animationName, duration} or null */
  function createAnimation(segs) {
    if (segs.length === 0) return null;
    var total = totalDuration(segs);
    if (total <= 0) return null;
    if (segs.length === 1 && segs[0].active) return null; // fixed light

    var key = "blink-" + animKey(segs);
    if (!createdAnimations.has(key)) {
      ensureStyleSheet();
      var kf = [], elapsed = 0;
      for (var i = 0; i < segs.length; i++) {
        kf.push(((elapsed / total) * 100).toFixed(2) + "% { opacity: " + (segs[i].active ? 1 : 0) + " }");
        elapsed += segs[i].duration;
      }
      kf.push("100% { opacity: " + (segs[0].active ? 1 : 0) + " }");
      try {
        styleSheet.insertRule("@keyframes " + key + " { " + kf.join(" ") + " }", styleSheet.cssRules.length);
      } catch (_) { /* ignore */ }
      createdAnimations.add(key);
    }
    return { animationName: key, duration: total };
  }

  /** Returns CSS animation shorthand string or "" */
  function getAnimationCSS(light) {
    var anim = createAnimation(getSegments(light));
    return anim ? anim.animationName + " " + anim.duration + "s infinite step-end" : "";
  }

  /** Build popup preview HTML */
  function buildPreviewHTML(light, colour) {
    var segs = getSegments(light);
    if (segs.length === 0) return '<span class="pp-label">패턴 데이터 없음</span>';

    var total = totalDuration(segs);
    var anim = createAnimation(segs);
    var dotCss = "background:" + colour + ";box-shadow:0 0 8px " + colour + ";";
    if (anim) dotCss += "animation:" + anim.animationName + " " + anim.duration + "s infinite step-end;";

    var html = '<div class="pp-wrap">';
    html += '<span class="pp-dot" style="' + dotCss + '"></span>';
    html += '<div class="pp-bar">';
    for (var i = 0; i < segs.length; i++) {
      var bg = segs[i].active ? colour : "rgba(255,255,255,0.15)";
      html += '<span style="flex:' + (segs[i].duration / total).toFixed(3) + ";background:" + bg +
        '" title="' + (segs[i].active ? "Flash " : "Dark ") + segs[i].duration + 's"></span>';
    }
    html += "</div>";
    html += '<span class="pp-period">' + total.toFixed(1) + "s</span>";
    html += "</div>";
    return html;
  }

  function describePattern(character, group) {
    var names = {
      FL: "점멸 (Flashing)", LFL: "장점멸 (Long Flash)", Q: "급점멸 (Quick)",
      VQ: "초급점멸 (Very Quick)", OC: "차폐 (Occulting)", ISO: "등시 (Isophase)",
      F: "고정 (Fixed)", MO: "모스 (Morse)"
    };
    var ch = (character || "").toUpperCase();
    var name = names[ch] || ch || "미상";
    return group ? name + " (" + group + "회)" : name;
  }

  window.LightPatterns = {
    parseSequence: parseSequence,
    getSegments: getSegments,
    getAnimationCSS: getAnimationCSS,
    buildPreviewHTML: buildPreviewHTML,
    describePattern: describePattern,
    totalDuration: totalDuration,
  };
})();
