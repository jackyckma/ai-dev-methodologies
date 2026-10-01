// Reader/writer for .agents/METHODOLOGY.lock.
// v1 locks are a small YAML-like document with no `files` map. v2 adds
// lock_schema, manifest_version, and files: { dest: sha256 }.

const SCALAR_ORDER = [
  "source",
  "version",
  "source_commit",
  "synced_at",
  "synced_by",
  "lock_schema",
  "manifest_version",
];

const LIST_KEYS = new Set(["customized_files"]);
const MAP_KEYS = new Set(["files"]);

function unquote(s) {
  if (s.length >= 2) {
    const q = s[0];
    if ((q === '"' || q === "'") && s.endsWith(q)) return s.slice(1, -1);
  }
  return s;
}

export function emptyLockData() {
  return { scalars: {}, lists: {}, maps: {} };
}

export function lockToData(text) {
  const data = emptyLockData();
  const lines = String(text).split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim() === "" || /^\s*#/.test(line)) continue;
    const top = line.match(/^(\S.*?):\s*(.*)$/);
    if (!top) continue;
    const key = top[1].trim();
    const rest = top[2].trim();
    if (rest !== "") {
      data.scalars[key] = unquote(rest);
      continue;
    }
    let kind = LIST_KEYS.has(key) ? "list" : MAP_KEYS.has(key) ? "map" : null;
    const items = [];
    const map = {};
    let j = i + 1;
    for (; j < lines.length; j++) {
      const nxt = lines[j];
      if (nxt.trim() === "" || /^\s*#/.test(nxt)) continue;
      if (/^\S/.test(nxt)) break;
      const li = nxt.match(/^\s+-\s+(.*)$/);
      if (li && kind !== "map") {
        kind = "list";
        items.push(unquote(li[1].trim()));
        continue;
      }
      const mi = nxt.match(/^\s+(.+?):\s*(.*)$/);
      if (mi && kind !== "list") {
        kind = "map";
        map[mi[1].trim()] = unquote(mi[2].trim());
        continue;
      }
      break;
    }
    if (kind === "map") data.maps[key] = map;
    else if (kind === "list") data.lists[key] = items;
    else data.scalars[key] = "";
    i = j - 1;
  }
  return data;
}

function emit(key, value) {
  if (key === "version" || key === "manifest_version") return `${key}: "${value}"`;
  return `${key}: ${value}`;
}

export function serializeLock(data) {
  const lines = [
    "# Methodology bundle pin — update only after a manual sync (see framework-adoption.md).",
    "",
  ];
  const s = data.scalars;
  for (const key of SCALAR_ORDER) {
    if (s[key] !== undefined && s[key] !== "") lines.push(emit(key, s[key]));
  }
  if (data.lists.customized_files) {
    lines.push("customized_files:");
    for (const item of data.lists.customized_files) lines.push(`  - ${item}`);
  }
  if (data.maps.files) {
    lines.push("files:");
    for (const key of Object.keys(data.maps.files).sort()) {
      lines.push(`  ${key}: ${data.maps.files[key]}`);
    }
  }
  if (s.notes !== undefined && s.notes !== "") lines.push(emit("notes", s.notes));

  const known = new Set([...SCALAR_ORDER, "notes", "customized_files", "files"]);
  const extras = [];
  for (const key of Object.keys(s)) if (!known.has(key)) extras.push({ kind: "scalar", key });
  for (const key of Object.keys(data.lists)) if (!known.has(key)) extras.push({ kind: "list", key });
  for (const key of Object.keys(data.maps)) if (!known.has(key)) extras.push({ kind: "map", key });
  extras.sort((a, b) => a.key.localeCompare(b.key));
  for (const ex of extras) {
    if (ex.kind === "scalar") lines.push(emit(ex.key, s[ex.key]));
    else if (ex.kind === "list") {
      lines.push(`${ex.key}:`);
      for (const item of data.lists[ex.key]) lines.push(`  - ${item}`);
    } else {
      lines.push(`${ex.key}:`);
      for (const key of Object.keys(data.maps[ex.key]).sort()) {
        lines.push(`  ${key}: ${data.maps[ex.key][key]}`);
      }
    }
  }
  return lines.join("\n") + "\n";
}
