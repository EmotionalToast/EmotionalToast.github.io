(function () {
  // Where the project folders live. On a yourname.github.io site the owner and
  // repo are detected from the address; these values are used as a fallback
  // (for example when testing locally or on a custom domain).
  var CONFIG = { owner: "EmotionalToast", repo: "EmotionalToast.github.io", folder: "projects" };

  var cardsEl = document.getElementById("cards");
  var statusEl = document.getElementById("status");
  var countEl = document.getElementById("count");
  var CACHE_KEY = "et-projects:v1";

  function detectRepo() {
    var m = location.hostname.match(/^([^.]+)\.github\.io$/i);
    if (m) return { owner: m[1], repo: location.hostname.toLowerCase() };
    return { owner: CONFIG.owner, repo: CONFIG.repo };
  }
  function prettify(name) {
    return name.replace(/[-_]+/g, " ").replace(/\b\w/g, function (c) { return c.toUpperCase(); });
  }
  function str(v) { return typeof v === "string" ? v.trim() : ""; }
  function readCache() {
    try {
      var o = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return o && Array.isArray(o.names) ? o.names : null;
    } catch (e) { return null; }
  }
  function writeCache(names) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ names: names, t: Date.now() })); } catch (e) {}
  }

  // Ask GitHub which folders exist inside /projects
  async function listFolders() {
    var r = detectRepo();
    var url = "https://api.github.com/repos/" + r.owner + "/" + r.repo + "/contents/" + CONFIG.folder;
    var res = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (res.status === 404) return [];
    if (!res.ok) throw new Error("GitHub API " + res.status);
    var items = await res.json();
    return items
      .filter(function (i) { return i.type === "dir" && !/^[._]/.test(i.name); })
      .map(function (i) { return i.name; });
  }

  // Optional card details from projects/<folder>/project.json
  async function loadMeta(name) {
    try {
      var res = await fetch(CONFIG.folder + "/" + encodeURIComponent(name) + "/project.json");
      if (!res.ok) return {};
      var j = await res.json();
      return j && typeof j === "object" ? j : {};
    } catch (e) { return {}; }
  }

  function el(tag, cls, text) {
    var e = document.createElement(tag);
    if (cls) e.className = cls;
    if (text) e.textContent = text;
    return e;
  }

  function render(projects) {
    cardsEl.textContent = "";
    if (!projects.length) {
      var empty = el("div", "card soon");
      empty.appendChild(el("h3", null, "No projects yet"));
      empty.appendChild(el("p", null, "Add a folder with an index.html inside the " + CONFIG.folder + " folder and it will show up here."));
      cardsEl.appendChild(empty);
      countEl.textContent = "0 projects";
      return;
    }
    projects.forEach(function (p) {
      var a = el("a", "card");
      a.href = CONFIG.folder + "/" + encodeURIComponent(p.name) + "/";
      a.appendChild(el("h3", null, p.title));
      if (p.desc) a.appendChild(el("p", null, p.desc));
      if (p.tags.length) {
        var tags = el("div", "tags");
        p.tags.forEach(function (t) { tags.appendChild(el("span", "tag", t)); });
        a.appendChild(tags);
      }
      a.appendChild(el("span", "open", "Open →"));
      cardsEl.appendChild(a);
    });
    countEl.textContent = projects.length + (projects.length === 1 ? " project" : " projects");
  }

  async function init() {
    var names;
    try {
      names = await listFolders();
      writeCache(names);
    } catch (e) {
      names = readCache(); // fall back to the last list that worked
      if (!names) {
        countEl.textContent = "";
        statusEl.textContent = "Couldn’t load the project list. GitHub may be limiting requests right now, so try again in a few minutes.";
        statusEl.hidden = false;
        return;
      }
    }
    var metas = await Promise.all(names.map(loadMeta));
    var projects = names.map(function (n, i) {
      var m = metas[i];
      return {
        name: n,
        title: str(m.title) || prettify(n),
        desc: str(m.description),
        tags: Array.isArray(m.tags) ? m.tags.filter(function (t) { return typeof t === "string" && t.trim(); }).slice(0, 4) : [],
        order: Number.isFinite(m.order) ? m.order : 1000
      };
    });
    projects.sort(function (a, b) { return a.order - b.order || a.title.localeCompare(b.title); });
    render(projects);
  }

  init();
})();
