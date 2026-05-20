(function initRiverStarStore(root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) {
    module.exports = api;
  }
  root.RiverStarStore = api;
})(typeof globalThis !== "undefined" ? globalThis : window, () => {
  const DB_NAME = "riverStarMap";
  const STORE_NAME = "memories";
  const DB_VERSION = 1;
  const LEGACY_STORAGE_KEY = "lifeMoments:v1";
  const MIGRATION_KEY = "riverStarMap:migrated:lifeMoments:v1";
  const EXPORT_VERSION = 1;

  const MOOD_TAGS = ["幸福", "感动", "热泪", "松弛", "胜利", "被理解", "想念"];

  const THEMES = {
    "warm-gold": {
      id: "warm-gold",
      core: "#ffe48b",
      glow: "#ffb23f",
      halo: "rgba(255, 150, 62, 0.7)",
      accent: "#ff7f50"
    },
    "solar-peach": {
      id: "solar-peach",
      core: "#ffd3aa",
      glow: "#ff8e72",
      halo: "rgba(255, 105, 116, 0.68)",
      accent: "#ffd166"
    },
    "candle-gold": {
      id: "candle-gold",
      core: "#fff0a8",
      glow: "#ffca4f",
      halo: "rgba(255, 196, 72, 0.72)",
      accent: "#fff6c9"
    },
    "rose-violet": {
      id: "rose-violet",
      core: "#ffc2e5",
      glow: "#ff6fb8",
      halo: "rgba(190, 92, 255, 0.66)",
      accent: "#9f7cff"
    },
    "magenta-ember": {
      id: "magenta-ember",
      core: "#ffc0d6",
      glow: "#ff567d",
      halo: "rgba(255, 76, 128, 0.68)",
      accent: "#ff9f6e"
    },
    "tear-gold": {
      id: "tear-gold",
      core: "#fff3a6",
      glow: "#ffd653",
      halo: "rgba(126, 105, 255, 0.7)",
      accent: "#8f86ff"
    },
    "silver-blue": {
      id: "silver-blue",
      core: "#d8f5ff",
      glow: "#62c9ff",
      halo: "rgba(79, 137, 255, 0.68)",
      accent: "#bdefff"
    },
    "deep-azure": {
      id: "deep-azure",
      core: "#bfe7ff",
      glow: "#4b8dff",
      halo: "rgba(52, 91, 238, 0.68)",
      accent: "#7ee6ff"
    },
    "white-gold": {
      id: "white-gold",
      core: "#fff7df",
      glow: "#ff9f45",
      halo: "rgba(255, 88, 76, 0.66)",
      accent: "#ffe066"
    },
    "nova-red": {
      id: "nova-red",
      core: "#ffe0db",
      glow: "#ff5c4d",
      halo: "rgba(255, 68, 75, 0.7)",
      accent: "#ffc857"
    },
    "mint-cyan": {
      id: "mint-cyan",
      core: "#caffee",
      glow: "#45e3cb",
      halo: "rgba(55, 207, 220, 0.68)",
      accent: "#8cffbd"
    },
    "aurora-green": {
      id: "aurora-green",
      core: "#d3ffd8",
      glow: "#61e870",
      halo: "rgba(79, 223, 149, 0.62)",
      accent: "#b8fff4"
    },
    "violet-silver": {
      id: "violet-silver",
      core: "#ded4ff",
      glow: "#9b72ff",
      halo: "rgba(145, 88, 255, 0.7)",
      accent: "#ffc1f1"
    },
    "starlight": {
      id: "starlight",
      core: "#f1f7ff",
      glow: "#b9d7ff",
      halo: "rgba(158, 180, 255, 0.62)",
      accent: "#f8fbff"
    },
    "moon-blue": {
      id: "moon-blue",
      core: "#e6fbff",
      glow: "#87e8ff",
      halo: "rgba(117, 235, 255, 0.62)",
      accent: "#b6c7ff"
    }
  };

  const THEME_FAMILIES = {
    "warm-gold": ["warm-gold", "solar-peach", "candle-gold"],
    "rose-violet": ["rose-violet", "magenta-ember", "violet-silver"],
    "tear-gold": ["tear-gold", "candle-gold", "rose-violet", "violet-silver"],
    "silver-blue": ["silver-blue", "deep-azure", "moon-blue"],
    "white-gold": ["white-gold", "nova-red", "candle-gold"],
    "mint-cyan": ["mint-cyan", "aurora-green", "moon-blue"],
    "violet-silver": ["violet-silver", "rose-violet", "deep-azure"],
    "starlight": ["starlight", "moon-blue", "silver-blue", "mint-cyan"],
    week: ["moon-blue", "silver-blue", "mint-cyan", "aurora-green", "violet-silver"],
    year: ["warm-gold", "candle-gold", "solar-peach", "rose-violet", "nova-red"]
  };

  function openDatabase() {
    return new Promise((resolve, reject) => {
      if (!globalThis.indexedDB) {
        reject(new Error("IndexedDB is not available."));
        return;
      }

      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onerror = () => reject(request.error);
      request.onsuccess = () => resolve(request.result);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
          store.createIndex("scope", "scope", { unique: false });
          store.createIndex("date", "date", { unique: false });
          store.createIndex("updatedAt", "updatedAt", { unique: false });
        }
      };
    });
  }

  function runStore(mode, callback) {
    return openDatabase().then(db => new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, mode);
      const store = transaction.objectStore(STORE_NAME);
      let result;

      try {
        result = callback(store);
      } catch (error) {
        db.close();
        reject(error);
        return;
      }

      transaction.oncomplete = () => {
        db.close();
        resolve(result);
      };
      transaction.onerror = () => {
        db.close();
        reject(transaction.error);
      };
      transaction.onabort = () => {
        db.close();
        reject(transaction.error);
      };
    }));
  }

  function getAllMemories() {
    return runStore("readonly", store => new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result.map(item => normalizeMemory(item)).filter(Boolean));
      request.onerror = () => reject(request.error);
    }));
  }

  function putMemories(memories) {
    const normalized = memories.map(item => normalizeMemory(item)).filter(Boolean);
    return runStore("readwrite", store => {
      normalized.forEach(item => store.put(item));
      return normalized;
    });
  }

  async function initStorage() {
    let memories = await getAllMemories();
    const migrated = localStorage.getItem(MIGRATION_KEY) === "1";
    if (!migrated) {
      const legacy = readLegacyStore();
      const migratedMemories = migrateLegacyStore(legacy);
      if (migratedMemories.length) {
        memories = mergeMemories(memories, migratedMemories);
        await putMemories(memories);
      }
      localStorage.setItem(MIGRATION_KEY, "1");
    }
    return memories;
  }

  function readLegacyStore() {
    try {
      return JSON.parse(localStorage.getItem(LEGACY_STORAGE_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function migrateLegacyStore(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const weekly = Array.isArray(source.weekly) ? source.weekly : [];
    const yearly = Array.isArray(source.yearly) ? source.yearly : [];
    return [
      ...weekly.map(item => normalizeMemory(item, "week")),
      ...yearly.map(item => normalizeMemory(item, "year"))
    ].filter(Boolean);
  }

  function normalizeMemory(raw, fallbackScope = "week") {
    if (!raw || typeof raw !== "object") return null;
    const scope = normalizeScope(raw.scope || (fallbackScope === "yearly" ? "year" : fallbackScope));
    const content = toText(raw.content || raw.title);
    const id = toText(raw.id) || createId(scope);
    const date = normalizeDateValue(raw.date) || getTodayValue();
    const createdAt = toText(raw.createdAt) || new Date().toISOString();
    const updatedAt = toText(raw.updatedAt) || createdAt;
    const moodTags = normalizeMoodTags(raw.moodTags || raw.mood);
    const intensity = normalizeIntensity(raw.intensity);
    const position = normalizePosition(raw.position, scope, id, date);
    const visual = normalizeVisual(raw.visual, scope, moodTags, intensity, id, date);
    const status = normalizeStatus(raw.status);

    return {
      id,
      title: toText(raw.title) || deriveMomentTitle(content),
      content,
      date,
      scope,
      moodTags,
      intensity,
      position,
      visual,
      status,
      createdAt,
      updatedAt
    };
  }

  function normalizeScope(value) {
    const text = toText(value);
    if (text === "year" || text === "yearly") return "year";
    return "week";
  }

  function normalizeMoodTags(value) {
    const values = Array.isArray(value) ? value : [value];
    const legacyMap = {
      lucky: "幸福",
      happy: "幸福",
      calm: "松弛",
      brave: "胜利",
      moved: "热泪",
      fulfilled: "被理解",
      remembered: "想念"
    };
    const normalized = values
      .map(item => {
        const text = toText(item);
        if (!text) return "";
        return legacyMap[text] || text;
      })
      .filter(Boolean);
    return Array.from(new Set(normalized)).slice(0, 4);
  }

  function normalizeIntensity(value) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return 5;
    return Math.max(1, Math.min(10, Math.round(numeric)));
  }

  function normalizePosition(value, scope, id, date) {
    const stable = createStablePosition(scope, id, date);
    if (!value || typeof value !== "object") return stable;
    return {
      x: clampNumber(value.x, 2, 98, stable.x),
      y: clampNumber(value.y, 4, 96, stable.y),
      z: Number.isFinite(Number(value.z)) ? Number(value.z) : stable.z
    };
  }

  function normalizeVisual(value, scope, moodTags, intensity, id, date) {
    const fallback = createStableVisual(scope, moodTags, intensity, id, date);
    if (!value || typeof value !== "object") return fallback;
    return {
      colorTheme: THEMES[toText(value.colorTheme)] ? toText(value.colorTheme) : fallback.colorTheme,
      sizeLevel: clampNumber(value.sizeLevel, 1, 4, fallback.sizeLevel),
      glowLevel: clampNumber(value.glowLevel, 0.25, 1, fallback.glowLevel),
      orbitSpeed: clampNumber(value.orbitSpeed, 0.2, 1.4, fallback.orbitSpeed)
    };
  }

  function normalizeStatus(value) {
    const source = value && typeof value === "object" ? value : {};
    return {
      hidden: Boolean(source.hidden),
      archived: Boolean(source.archived),
      deleted: Boolean(source.deleted),
      favorite: Boolean(source.favorite)
    };
  }

  function createStablePosition(scope, id, date) {
    const hash = hashString(`${scope}:${id}:${date}:position`);
    if (scope === "year") {
      return {
        x: 54 + (hash % 40),
        y: 13 + (Math.floor(hash / 13) % 72),
        z: Math.floor(hash / 31) % 4
      };
    }
    return {
      x: 7 + (hash % 42),
      y: 18 + (Math.floor(hash / 13) % 66),
      z: Math.floor(hash / 31) % 3
    };
  }

  function createStableVisual(scope, moodTags, intensity, id, date) {
    const hash = hashString(`${scope}:${id}:${date}:visual`);
    const visual = buildVisual(moodTags, intensity, scope, `${id}:${date}`);
    return {
      ...visual,
      orbitSpeed: Math.max(0.2, visual.orbitSpeed - (hash % 8) / 100)
    };
  }

  function buildVisual(moodTags, intensity, scope, seed = "") {
    const normalizedIntensity = normalizeIntensity(intensity);
    const theme = pickColorTheme(moodTags, scope, seed);
    return {
      colorTheme: theme.id,
      sizeLevel: intensityToSizeLevel(normalizedIntensity, scope),
      glowLevel: intensityToGlow(normalizedIntensity),
      orbitSpeed: scopeToOrbitSpeed(scope, normalizedIntensity)
    };
  }

  function pickColorTheme(moodTags, scope, seed = "") {
    const tags = Array.isArray(moodTags) ? moodTags : [];
    let base = "";
    if (tags.includes("热泪")) base = "tear-gold";
    else if (tags.includes("被理解")) base = "silver-blue";
    else if (tags.includes("胜利")) base = "white-gold";
    else if (tags.includes("松弛")) base = "mint-cyan";
    else if (tags.includes("想念")) base = "violet-silver";
    else if (tags.includes("感动")) base = "rose-violet";
    else if (tags.includes("幸福")) base = "warm-gold";

    const family = base ? THEME_FAMILIES[base] : THEME_FAMILIES[scope === "year" ? "year" : "week"];
    const id = pickFromFamily(family, seed || tags.join("|") || scope);
    return THEMES[id] || THEMES[base] || THEMES.starlight;
  }

  function themeById(id) {
    return THEMES[toText(id)] || THEMES.starlight;
  }

  function pickFromFamily(family, seed) {
    const candidates = Array.isArray(family) && family.length ? family : THEME_FAMILIES.starlight;
    return candidates[hashString(seed) % candidates.length];
  }

  function intensityToSizeLevel(intensity, scope) {
    let level = 1;
    if (intensity > 3) level = 2;
    if (intensity > 6) level = 3;
    if (intensity > 8) level = 4;
    return scope === "year" ? Math.min(4, level + 1) : level;
  }

  function intensityToGlow(intensity) {
    return Math.min(1, 0.42 + normalizeIntensity(intensity) * 0.058);
  }

  function scopeToOrbitSpeed(scope, intensity) {
    const normalizedIntensity = normalizeIntensity(intensity);
    if (scope === "year") return 0.34 + (10 - normalizedIntensity) * 0.018;
    return 0.72 + (10 - normalizedIntensity) * 0.034;
  }

  function sizeLevelToPx(level, scope = "week") {
    const normalized = Math.max(1, Math.min(4, Math.round(Number(level) || 2)));
    const weekly = [14, 22, 32, 44];
    const yearly = [22, 34, 48, 64];
    return (scope === "year" ? yearly : weekly)[normalized - 1];
  }

  function mergeMemories(existing, incoming) {
    const map = new Map();
    existing.map(item => normalizeMemory(item)).filter(Boolean).forEach(item => map.set(item.id, item));
    incoming.map(item => normalizeMemory(item)).filter(Boolean).forEach(item => {
      const current = map.get(item.id);
      if (!current || String(item.updatedAt || "").localeCompare(String(current.updatedAt || "")) >= 0) {
        map.set(item.id, item);
      }
    });
    return Array.from(map.values()).sort(compareMemories);
  }

  function createExportPayload(memories) {
    return {
      version: EXPORT_VERSION,
      app: "river-star-map",
      exportedAt: new Date().toISOString(),
      memories: memories.map(item => normalizeMemory(item)).filter(Boolean).filter(item => !item.status.deleted)
    };
  }

  function parseImportPayload(raw) {
    const payload = typeof raw === "string" ? JSON.parse(raw) : raw;
    if (!payload || typeof payload !== "object") {
      throw new Error("备份文件不是有效的 JSON。");
    }
    const memories = Array.isArray(payload.memories) ? payload.memories : [];
    return memories.map(item => normalizeMemory(item)).filter(Boolean);
  }

  function deriveMomentTitle(content) {
    const text = toText(content).split(/\r?\n/).map(line => line.trim()).find(Boolean) || "未命名回顾";
    return text.length > 18 ? `${text.slice(0, 18)}…` : text;
  }

  function compareMemories(a, b) {
    const dateDiff = (b.date || "").localeCompare(a.date || "");
    if (dateDiff !== 0) return dateDiff;
    return (b.updatedAt || "").localeCompare(a.updatedAt || "");
  }

  function hashString(value) {
    let hash = 2166136261;
    for (let index = 0; index < String(value).length; index += 1) {
      hash ^= String(value).charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return Math.abs(hash >>> 0);
  }

  function createId(prefix) {
    return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`;
  }

  function normalizeDateValue(value) {
    const text = toText(value);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : "";
  }

  function getTodayValue() {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function clampNumber(value, min, max, fallback) {
    const numeric = Number(value);
    if (!Number.isFinite(numeric)) return fallback;
    return Math.max(min, Math.min(max, numeric));
  }

  function toText(value) {
    return String(value ?? "").trim();
  }

  return {
    DB_NAME,
    STORE_NAME,
    LEGACY_STORAGE_KEY,
    MIGRATION_KEY,
    MOOD_TAGS,
    buildVisual,
    createExportPayload,
    deriveMomentTitle,
    getTodayValue,
    hashString,
    initStorage,
    mergeMemories,
    migrateLegacyStore,
    normalizeMemory,
    parseImportPayload,
    putMemories,
    scopeToOrbitSpeed,
    sizeLevelToPx,
    themeById
  };
});
