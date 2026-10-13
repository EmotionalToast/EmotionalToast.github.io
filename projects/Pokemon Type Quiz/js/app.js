(function () {
  const COLORS = {
    normal:"#a8a77a", fire:"#ee8130", water:"#6390f0", electric:"#f7d02c", grass:"#7ac74c",
    ice:"#96d9d6", fighting:"#c22e28", poison:"#a33ea1", ground:"#e2bf65", flying:"#a98ff3",
    psychic:"#f95587", bug:"#a6b91a", rock:"#b6a136", ghost:"#735797", dragon:"#6f35fc",
    dark:"#705746", steel:"#b7b7ce", fairy:"#d685ad"
  };
  const TYPES = Object.keys(COLORS);

  // Attacking chart: super effective (se), not very effective (nve), no effect (imm)
  const ATK = {
    normal:   { se:[], nve:["rock","steel"], imm:["ghost"] },
    fire:     { se:["grass","ice","bug","steel"], nve:["fire","water","rock","dragon"], imm:[] },
    water:    { se:["fire","ground","rock"], nve:["water","grass","dragon"], imm:[] },
    electric: { se:["water","flying"], nve:["electric","grass","dragon"], imm:["ground"] },
    grass:    { se:["water","ground","rock"], nve:["fire","grass","poison","flying","bug","dragon","steel"], imm:[] },
    ice:      { se:["grass","ground","flying","dragon"], nve:["fire","water","ice","steel"], imm:[] },
    fighting: { se:["normal","ice","rock","dark","steel"], nve:["poison","flying","psychic","bug","fairy"], imm:["ghost"] },
    poison:   { se:["grass","fairy"], nve:["poison","ground","rock","ghost"], imm:["steel"] },
    ground:   { se:["fire","electric","poison","rock","steel"], nve:["grass","bug"], imm:["flying"] },
    flying:   { se:["grass","fighting","bug"], nve:["electric","rock","steel"], imm:[] },
    psychic:  { se:["fighting","poison"], nve:["psychic","steel"], imm:["dark"] },
    bug:      { se:["grass","psychic","dark"], nve:["fire","fighting","poison","flying","ghost","steel","fairy"], imm:[] },
    rock:     { se:["fire","ice","flying","bug"], nve:["fighting","ground","steel"], imm:[] },
    ghost:    { se:["psychic","ghost"], nve:["dark"], imm:["normal"] },
    dragon:   { se:["dragon"], nve:["steel"], imm:["fairy"] },
    dark:     { se:["psychic","ghost"], nve:["fighting","dark","fairy"], imm:[] },
    steel:    { se:["ice","rock","fairy"], nve:["fire","water","electric","steel"], imm:[] },
    fairy:    { se:["fighting","dragon","dark"], nve:["fire","poison","steel"], imm:[] }
  };

  const CATS = ["weak", "resist", "immune"];
  const CAT_LABEL = { weak: "Weak to", resist: "Resists", immune: "Immune to" };
  const CAT_DESC = {
    weak: "What moves are super effective against ",
    resist: "What moves are not very effective against ",
    immune: "What moves have no effect on "
  };
  const NEED_BELOW = 0.7; // under 70% perfect = "needs work"

  const SINGLES = TYPES.map(t => [t]);
  const PAIRS = [];
  for (let i = 0; i < TYPES.length; i++) for (let j = i + 1; j < TYPES.length; j++) PAIRS.push([TYPES[i], TYPES[j]]);

  const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
  const el = id => document.getElementById(id);
  const keyOf = types => types.slice().sort().join("/");
  function textOn(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = n >> 16, g = (n >> 8) & 255, b = n & 255;
    return (0.299*r + 0.587*g + 0.114*b) > 150 ? "#17181a" : "#ffffff";
  }
  function h(tag, cls, text) {
    const e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text != null) e.textContent = text;
    return e;
  }
  function setColors(node, t) {
    node.style.setProperty("--c", COLORS[t]);
    node.style.setProperty("--on", textOn(COLORS[t]));
  }

  // ---------- matchup maths ----------
  function mult(atk, def) {
    const a = ATK[atk];
    if (a.imm.includes(def)) return 0;
    if (a.se.includes(def)) return 2;
    if (a.nve.includes(def)) return 0.5;
    return 1;
  }
  const cache = new Map();
  function answersFor(types) {
    const key = keyOf(types);
    if (cache.has(key)) return cache.get(key);
    const res = { weak: [], resist: [], immune: [], mult: {} };
    TYPES.forEach(atk => {
      let m = 1;
      types.forEach(d => { m *= mult(atk, d); });
      res.mult[atk] = m;
      if (m === 0) res.immune.push(atk);
      else if (m > 1) res.weak.push(atk);
      else if (m < 1) res.resist.push(atk);
    });
    cache.set(key, res);
    return res;
  }
  function describe(m, a) {
    if (m === 0) return "is immune to " + a;
    if (m === 0.25) return "takes ¼× damage from " + a;
    if (m === 0.5) return "resists " + a + " (½× damage)";
    if (m === 2) return "is weak to " + a + " (2× damage)";
    if (m === 4) return "takes 4× damage from " + a;
    return "takes normal damage from " + a;
  }
  function extraTag(m) { return m === 4 ? "4×" : (m === 0.25 ? "¼×" : ""); }

  function buildPool(s) {
    const enabled = CATS.filter(c => s.cats[c]);
    const pool = s.mode === "dual" ? PAIRS : SINGLES;
    return pool.filter(q => q.every(t => s.types[t]) && enabled.some(c => answersFor(q)[c].length > 0));
  }
  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ---------- settings + stats (saved in this browser) ----------
  const SK = "ptq:v2:settings", STK = "ptq:v2:stats";
  const DEFAULTS = {
    mode: "mono", cats: { weak: true, resist: true, immune: true }, hints: false, shuffle: false,
    types: Object.fromEntries(TYPES.map(t => [t, true]))
  };
  const clone = o => JSON.parse(JSON.stringify(o));

  function loadSettings() {
    const s = clone(DEFAULTS);
    try {
      const o = JSON.parse(localStorage.getItem(SK) || "null");
      if (o) {
        if (o.mode === "dual") s.mode = "dual";
        CATS.forEach(c => { if (o.cats && typeof o.cats[c] === "boolean") s.cats[c] = o.cats[c]; });
        if (!CATS.some(c => s.cats[c])) s.cats = clone(DEFAULTS.cats);
        s.hints = o.hints === true;
        s.shuffle = o.shuffle === true;
        TYPES.forEach(t => { if (o.types && typeof o.types[t] === "boolean") s.types[t] = o.types[t]; });
      }
    } catch (e) {}
    if (!buildPool(s).length) { s.mode = DEFAULTS.mode; s.cats = clone(DEFAULTS.cats); s.types = clone(DEFAULTS.types); }
    return s;
  }
  function saveSettings() { try { localStorage.setItem(SK, JSON.stringify(settings)); } catch (e) {} }

  function emptyStats() {
    const mk = () => { const o = {}; TYPES.forEach(t => { o[t] = { p: 0, n: 0 }; }); return o; };
    return { mono: mk(), dual: mk(), rounds: { mono: { p: 0, n: 0 }, dual: { p: 0, n: 0 } } };
  }
  function loadStats() {
    const s = emptyStats();
    const ok = v => v && Number.isFinite(v.p) && Number.isFinite(v.n);
    try {
      const o = JSON.parse(localStorage.getItem(STK) || "null");
      if (o) ["mono", "dual"].forEach(m => {
        TYPES.forEach(t => { const v = o[m] && o[m][t]; if (ok(v)) s[m][t] = { p: v.p, n: v.n }; });
        const r = o.rounds && o.rounds[m];
        if (ok(r)) s.rounds[m] = { p: r.p, n: r.n };
      });
    } catch (e) {}
    return s;
  }
  function saveStats() { try { localStorage.setItem(STK, JSON.stringify(stats)); } catch (e) {} }

  let settings = loadSettings();
  let stats = loadStats();

  // ---------- quiz state ----------
  const badgesEl = el("badges"), submitBtn = el("submit"), nextBtn = el("next"), clearBtn = el("clear");
  const resultEl = el("result"), mainEl = el("app");

  let current = [], currentKey = null, submitted = false, bag = [], perfect = 0, played = 0;
  const picks = { weak: new Set(), resist: new Set(), immune: new Set() };

  const enabledCats = () => CATS.filter(c => settings.cats[c]);

  // chips
  const chips = {}, grids = {};
  CATS.forEach(cat => {
    chips[cat] = {};
    const grid = document.querySelector('.grid[data-cat="' + cat + '"]');
    grids[cat] = grid;
    TYPES.forEach(t => {
      const b = h("button", "chip", cap(t));
      b.type = "button";
      setColors(b, t);
      b.setAttribute("aria-pressed", "false");
      b.addEventListener("click", () => toggle(cat, t));
      grid.appendChild(b);
      chips[cat][t] = b;
    });
  });

  function toggle(cat, t) {
    if (submitted) return;
    if (picks[cat].has(t)) {
      picks[cat].delete(t);
    } else {
      CATS.forEach(c => picks[c].delete(t)); // a type can only live in one box
      picks[cat].add(t);
    }
    render();
  }
  function render() {
    CATS.forEach(cat => TYPES.forEach(t => {
      chips[cat][t].setAttribute("aria-pressed", picks[cat].has(t) ? "true" : "false");
    }));
  }
  function clearAll() { CATS.forEach(c => picks[c].clear()); render(); }
  function applyOrder(order) {
    CATS.forEach(cat => order.forEach(t => grids[cat].appendChild(chips[cat][t])));
  }

  function applyPanels() {
    CATS.forEach(c => {
      el("panel-" + c).hidden = !settings.cats[c];
      const cnt = el("count-" + c);
      cnt.hidden = !(settings.hints && settings.cats[c]);
      if (current.length) {
        const n = answersFor(current)[c].length;
        cnt.textContent = n + (n === 1 ? " answer" : " answers");
      }
    });
  }

  function renderBadges() {
    badgesEl.textContent = "";
    badgesEl.className = "badges" + (current.length > 1 ? " dual" : "");
    current.forEach(t => {
      const d = h("div", "badge", cap(t));
      setColors(d, t);
      badgesEl.appendChild(d);
    });
  }

  function refillBag() {
    const list = shuffle(buildPool(settings));
    if (currentKey && list.length > 1 && keyOf(list[list.length - 1]) === currentKey) list.unshift(list.pop());
    bag = list;
  }

  function startQuestion() {
    if (!bag.length) refillBag();
    current = bag.pop().slice();
    if (current.length > 1 && Math.random() < 0.5) current.reverse();
    currentKey = keyOf(current);
    submitted = false;
    CATS.forEach(c => picks[c].clear());

    renderBadges();
    const name = current.map(cap).join(" / ");
    el("prompt-text").textContent = current.length > 1
      ? "When this dual type is attacked, which types are…"
      : "When this type is attacked, which types are…";
    CATS.forEach(c => { el("desc-" + c).textContent = CAT_DESC[c] + name + "?"; });

    CATS.forEach(cat => TYPES.forEach(t => {
      const b = chips[cat][t];
      b.disabled = false;
      b.className = "chip";
      b.textContent = cap(t);
    }));

    applyOrder(settings.shuffle ? shuffle(TYPES.slice()) : TYPES);
    render();
    applyPanels();
    resultEl.hidden = true;
    resultEl.textContent = "";
    submitBtn.hidden = false;
    clearBtn.hidden = false;
    nextBtn.hidden = true;
    window.scrollTo({ top: 0 });
  }

  // Changing mode or boxes starts a fresh question (not counted)
  function resetQuestion() { bag = []; currentKey = null; startQuestion(); }

  function submit() {
    submitted = true;
    const ans = answersFor(current);
    const name = current.map(cap).join(" / ");
    const wrong = [], missed = [];

    enabledCats().forEach(cat => {
      TYPES.forEach(t => {
        const b = chips[cat][t];
        const picked = picks[cat].has(t);
        const belongs = ans[cat].includes(t);
        const extra = extraTag(ans.mult[t]);
        b.disabled = true;
        const tag = label => b.appendChild(h("span", "tag", label));
        if (picked && belongs) { b.classList.add("correct"); tag("✓ correct" + (extra ? " · " + extra : "")); }
        else if (picked && !belongs) { b.classList.add("wrong"); tag("✕ wrong"); wrong.push({ type: t, cat }); }
        else if (!picked && belongs) { b.classList.add("missed"); tag("missed" + (extra ? " · " + extra : "")); missed.push({ type: t, cat }); }
      });
    });

    const isPerfect = !wrong.length && !missed.length;
    played++; if (isPerfect) perfect++;

    // lifetime stats (dual rounds count toward both types)
    const mode = settings.mode;
    current.forEach(t => { const r = stats[mode][t]; r.n++; if (isPerfect) r.p++; });
    stats.rounds[mode].n++; if (isPerfect) stats.rounds[mode].p++;
    saveStats();

    resultEl.textContent = "";
    const head = h("h3");
    if (isPerfect) {
      head.className = "perfect";
      head.textContent = "Perfect. Every " + name + " matchup is right.";
      resultEl.appendChild(head);
    } else {
      head.textContent = name + ": " + wrong.length + " wrong, " + missed.length + " missed";
      resultEl.appendChild(head);
      if (wrong.length) {
        const h4 = h("h4", "w", "Wrong");
        const ul = h("ul");
        wrong.forEach(w => {
          ul.appendChild(h("li", null,
            cap(w.type) + " is not in “" + CAT_LABEL[w.cat] + "”: " + name + " " + describe(ans.mult[w.type], cap(w.type)) + "."));
        });
        resultEl.append(h4, ul);
      }
      if (missed.length) {
        const h4 = h("h4", "m", "Missed");
        const ul = h("ul");
        missed.forEach(m => {
          const x = extraTag(ans.mult[m.type]);
          ul.appendChild(h("li", null, cap(m.type) + " belongs in “" + CAT_LABEL[m.cat] + "”" + (x ? " (" + x + " damage)" : "") + "."));
        });
        resultEl.append(h4, ul);
      }
    }

    resultEl.hidden = false;
    submitBtn.hidden = true;
    clearBtn.hidden = true;
    nextBtn.hidden = false;
    nextBtn.focus({ preventScroll: true });
    resultEl.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  submitBtn.addEventListener("click", submit);
  nextBtn.addEventListener("click", startQuestion);
  clearBtn.addEventListener("click", clearAll);

  // ---------- overlays ----------
  const overlays = { options: el("overlay-options"), stats: el("overlay-stats") };
  let openName = null, lastFocus = null;

  function openOverlay(name) {
    lastFocus = document.activeElement;
    openName = name;
    overlays[name].hidden = false;
    document.body.style.overflow = "hidden";
    if ("inert" in mainEl) mainEl.inert = true;
    overlays[name].querySelector(".close").focus();
  }
  function closeOverlay() {
    if (!openName) return;
    overlays[openName].hidden = true;
    openName = null;
    document.body.style.overflow = "";
    if ("inert" in mainEl) mainEl.inert = false;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  Object.keys(overlays).forEach(n => {
    overlays[n].addEventListener("click", e => { if (e.target === overlays[n]) closeOverlay(); });
    overlays[n].querySelector("[data-close]").addEventListener("click", closeOverlay);
  });
  document.addEventListener("keydown", e => {
    if (!openName) return;
    if (e.key === "Escape") { closeOverlay(); return; }
    if (e.key === "Tab") {
      const f = Array.from(overlays[openName].querySelectorAll("button, input")).filter(x => !x.disabled);
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ---------- options menu ----------
  const modeNote = el("mode-note"), optNote = el("opt-note");
  const typeBtns = {};
  TYPES.forEach(t => {
    const b = h("button", "chip mini", cap(t));
    b.type = "button";
    setColors(b, t);
    b.setAttribute("aria-pressed", "true");
    b.addEventListener("click", () => {
      const next = Object.assign({}, settings.types, { [t]: !settings.types[t] });
      if (!buildPool(Object.assign({}, settings, { types: next })).length) {
        flashNote("That would leave no questions. Keep more types on.");
        return;
      }
      settings.types = next;
      saveSettings(); syncOptionsUI(); resetQuestion();
    });
    el("type-toggles").appendChild(b);
    typeBtns[t] = b;
  });
  let noteTimer = null;
  function flashNote(msg) {
    optNote.textContent = msg;
    clearTimeout(noteTimer);
    noteTimer = setTimeout(() => { optNote.textContent = ""; }, 2800);
  }
  function syncOptionsUI() {
    document.querySelectorAll('input[name="mode"]').forEach(r => { r.checked = (r.value === settings.mode); });
    CATS.forEach(c => { el("opt-" + c).checked = settings.cats[c]; });
    el("opt-hints").checked = settings.hints;
    el("opt-shuffle").checked = settings.shuffle;
    TYPES.forEach(t => typeBtns[t].setAttribute("aria-pressed", String(settings.types[t])));
    const on = TYPES.filter(t => settings.types[t]).length;
    el("types-note").textContent = on + " of " + TYPES.length + " types on. Tap a type to leave it out of the questions. It still shows up as an answer choice.";
    modeNote.textContent = settings.mode === "dual"
      ? "Uses every pairing of two different types that are on. Some pairings don’t exist in the games."
      : "One type at a time.";
  }
  document.querySelectorAll('input[name="mode"]').forEach(r => {
    r.addEventListener("change", () => {
      if (!r.checked) return;
      if (!buildPool(Object.assign({}, settings, { mode: r.value })).length) {
        syncOptionsUI();
        flashNote("Not enough types are on for that mode.");
        return;
      }
      settings.mode = r.value;
      saveSettings(); syncOptionsUI(); resetQuestion();
    });
  });
  CATS.forEach(c => {
    const input = el("opt-" + c);
    input.addEventListener("change", () => {
      const next = Object.assign({}, settings.cats, { [c]: input.checked });
      if (!CATS.some(k => next[k])) { input.checked = true; flashNote("At least one box has to stay on."); return; }
      if (!buildPool(Object.assign({}, settings, { cats: next })).length) {
        input.checked = settings.cats[c];
        flashNote("No types left to ask with those boxes. Turn more types on.");
        return;
      }
      settings.cats = next;
      saveSettings(); resetQuestion();
    });
  });
  el("opt-hints").addEventListener("change", e => {
    settings.hints = e.target.checked;
    saveSettings(); applyPanels();
  });
  el("opt-shuffle").addEventListener("change", e => {
    settings.shuffle = e.target.checked;
    saveSettings();
    applyOrder(settings.shuffle ? shuffle(TYPES.slice()) : TYPES);
  });
  el("types-all").addEventListener("click", () => {
    settings.types = clone(DEFAULTS.types);
    saveSettings(); syncOptionsUI(); resetQuestion();
  });
  el("reset-defaults").addEventListener("click", () => {
    settings = clone(DEFAULTS);
    saveSettings(); syncOptionsUI(); resetQuestion();
  });
  el("open-options").addEventListener("click", () => { syncOptionsUI(); optNote.textContent = ""; openOverlay("options"); });

  // ---------- stats popup ----------
  let statsTab = "mono";

  function statRow(t, rec, cls) {
    const row = h("div", "srow");
    const pill = h("span", "pill", cap(t));
    setColors(pill, t);
    const bar = h("div", "bar");
    const fill = h("i", cls);
    fill.style.width = Math.round(rec.p / rec.n * 100) + "%";
    bar.appendChild(fill);
    row.append(pill, bar, h("span", "snum", rec.p + " of " + rec.n));
    return row;
  }

  function renderStats(focusTab) {
    const body = el("stats-body");
    body.textContent = "";

    const tabs = h("div", "tabs");
    tabs.setAttribute("role", "tablist");
    [["mono", "Single type"], ["dual", "Dual type"]].forEach(([k, label]) => {
      const b = h("button", null, label);
      b.type = "button";
      b.setAttribute("role", "tab");
      b.setAttribute("aria-selected", String(statsTab === k));
      b.addEventListener("click", () => { statsTab = k; renderStats(true); });
      tabs.appendChild(b);
    });
    body.appendChild(tabs);

    const r = stats.rounds[statsTab];
    body.appendChild(h("p", "stats-sum", r.n
      ? "All time: " + r.p + " perfect of " + r.n + " round" + (r.n === 1 ? "" : "s")
      : "No rounds in this mode yet."));
    body.appendChild(h("p", "stats-sum", "This session: " + perfect + " perfect of " + played + " round" + (played === 1 ? "" : "s") + " (all modes)"));
    body.appendChild(h("p", "stats-note",
      "Bars show perfect rounds out of tries. Under " + Math.round(NEED_BELOW * 100) + "% needs work." +
      (statsTab === "dual" ? " Each dual round counts toward both of its types." : "")));

    const rows = TYPES.map(t => ({ t, p: stats[statsTab][t].p, n: stats[statsTab][t].n }));
    const need = rows.filter(x => x.n > 0 && x.p / x.n < NEED_BELOW)
                     .sort((a, b) => (a.p / a.n) - (b.p / b.n) || b.n - a.n);
    const solid = rows.filter(x => x.n > 0 && x.p / x.n >= NEED_BELOW)
                      .sort((a, b) => (b.p / b.n) - (a.p / a.n) || b.n - a.n);
    const untried = rows.filter(x => x.n === 0);

    if (need.length) {
      body.appendChild(h("h3", "stats-group need", "Needs work"));
      need.forEach(x => body.appendChild(statRow(x.t, x, "need")));
    }
    if (solid.length) {
      body.appendChild(h("h3", "stats-group good", "Doing well"));
      solid.forEach(x => body.appendChild(statRow(x.t, x, "good")));
    }
    if (untried.length) {
      body.appendChild(h("h3", "stats-group none", "Not tried yet"));
      const wrap = h("div", "pills");
      untried.forEach(x => { const p = h("span", "pill", cap(x.t)); setColors(p, x.t); wrap.appendChild(p); });
      body.appendChild(wrap);
    }

    if (focusTab) {
      const sel = tabs.querySelector('[aria-selected="true"]');
      if (sel) sel.focus();
    }
  }

  el("open-stats").addEventListener("click", () => { statsTab = settings.mode; renderStats(false); disarmReset(); openOverlay("stats"); });

  const resetBtn = el("reset-stats");
  let armed = false, armTimer = null;
  function disarmReset() {
    armed = false; clearTimeout(armTimer);
    resetBtn.textContent = "Reset stats";
    resetBtn.classList.remove("danger");
  }
  resetBtn.addEventListener("click", () => {
    if (!armed) {
      armed = true;
      resetBtn.textContent = "Tap again to erase all stats";
      resetBtn.classList.add("danger");
      armTimer = setTimeout(disarmReset, 4000);
    } else {
      stats = emptyStats();
      saveStats();
      disarmReset();
      renderStats(false);
    }
  });

  // go
  syncOptionsUI();
  startQuestion();
})();
