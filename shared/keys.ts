// Numbers of chats and cards: "AGM-1" is a chat of the agmazin workspace, "AGM-1-2" is its second card,
// "AGM-1-2-1" is a subagent of that card. The plugin server assigns them; numbers are never reused.
import { KEY_LABEL, parentOf, type AgentLike } from "./model";

export { KEY_LABEL, splitTitle } from "./model";
export const MULTICA_LABEL = "multica.key";
export const KNOWN_PREFIXES: Readonly<Record<string, string>> = {
  agmazin: "AGM",
  ЭкоЭксперт: "ECO",
  CTG: "CTG",
  otchetico: "OTC",
};

export interface KeysState {
  // workspaceId -> prefix.
  prefixes: Record<string, string>;
  // Last number used in a scope: "AGM" for chats, "AGM-1" for cards of AGM-1.
  last: Record<string, number>;
  // agentId -> key: a backup of the label, so a failed write never hands the number out again.
  assigned: Record<string, string>;
}
export const EMPTY_KEYS: KeysState = { prefixes: {}, last: {}, assigned: {} };

export interface WorkspaceLike {
  id: string;
  name?: string | null;
  title?: string | null;
}

export interface KeyChange {
  id: string;
  key: string;
  oldTitle: string | null;
  // New title, absent when the title stays.
  title?: string;
  // Labels to set.
  labels: Record<string, string>;
}

const KEY = /^([A-Z]{3})-(\d+(?:-\d+)*)$/;
// Separators of old Multica keys: "ECO-57: ...", "ECO-88 - ...", "ECO-52 ...". U+2013 and U+2014 are dashes.
const SEP = String.raw`(?:\s*:\s*|\s+[-–—]\s+|\s+)`;
const esc = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

export function parseKey(key?: string | null) {
  const m = key ? KEY.exec(key) : null;
  if (!m) return null;
  const nums = m[2].split("-").map(Number);
  return { prefix: m[1], nums, scope: key!.slice(0, key!.lastIndexOf("-")), n: nums[nums.length - 1] };
}

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "i", к: "k", л: "l", м: "m",
  н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f", х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch",
  ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

// Three Latin letters from the workspace name, unique among the taken prefixes.
export function prefixFor(name: string, taken: ReadonlySet<string>) {
  if (KNOWN_PREFIXES[name] && !taken.has(KNOWN_PREFIXES[name])) return KNOWN_PREFIXES[name];
  const letters = [...name.toLowerCase()]
    .map((ch) => TRANSLIT[ch] ?? ch)
    .join("")
    .replace(/[^a-z]/g, "")
    .toUpperCase();
  const src = (letters || "WSP").padEnd(3, "X");
  for (let i = 1; i < src.length; i++)
    for (let j = i + 1; j < src.length; j++) {
      const p = src[0] + src[i] + src[j];
      if (!taken.has(p)) return p;
    }
  const abc = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  for (const a of abc) for (const b of abc) if (!taken.has(src[0] + a + b)) return src[0] + a + b;
  throw new Error("Канбан: кончились префиксы");
}

// The title without our key, the stored Multica key or a key copied from another card ("AGM-5-3: AGM-23: ...").
export function bareTitle(title: string, key: string | null, multica: string | null, prefixes: readonly string[]) {
  const own = prefixes.length ? new RegExp(`^(?:${prefixes.map(esc).join("|")})-\\d+(?:-\\d+)+:\\s*`) : null;
  const exact = [key, multica].filter(Boolean).map((k) => new RegExp(`^${esc(k!)}(?![-\\d])${SEP}`));
  let t = title.trim();
  for (let changed = true; changed; ) {
    changed = false;
    for (const re of own ? [...exact, own] : exact) {
      const next = t.replace(re, "");
      if (next !== t && next.trim()) {
        t = next.trim();
        changed = true;
      }
    }
  }
  return t;
}

// An old Multica key at the start of a title that has no number of ours yet.
export function multicaKey(title: string, prefixes: readonly string[]) {
  if (!prefixes.length) return null;
  const m = new RegExp(`^((?:${prefixes.map(esc).join("|")})-\\d+)(?![-\\d])${SEP}(\\S.*)$`).exec(title.trim());
  return m ? { key: m[1], rest: m[2].trim() } : null;
}

const byCreated = (a: AgentLike, b: AgentLike) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id);

// Pure: the server applies the changes, the dry run prints them.
export function planKeys(agents: readonly AgentLike[], workspaces: readonly WorkspaceLike[], prev: KeysState) {
  const state: KeysState = { prefixes: { ...prev.prefixes }, last: { ...prev.last }, assigned: { ...prev.assigned } };
  const keyOf = new Map<string, string>();
  const fresh = new Set<string>();
  for (const a of agents) {
    const k = a.labels?.[KEY_LABEL] || state.assigned[a.id];
    if (!parseKey(k)) continue;
    keyOf.set(a.id, k!);
    state.assigned[a.id] = k!;
  }
  // Counters never go below a number in use, even if the state file was lost.
  for (const k of keyOf.values()) {
    const p = parseKey(k)!;
    state.last[p.scope] = Math.max(state.last[p.scope] ?? 0, p.n);
  }
  const taken = new Set(Object.values(state.prefixes));
  for (const a of agents) {
    const k = keyOf.get(a.id);
    if (!k || !a.workspaceId || parentOf(a) || state.prefixes[a.workspaceId]) continue;
    const p = parseKey(k)!.prefix;
    state.prefixes[a.workspaceId] = p;
    taken.add(p);
  }
  const wsById = new Map(workspaces.map((w) => [w.id, w]));
  const prefixOf = (workspaceId: string) => {
    if (!state.prefixes[workspaceId]) {
      const w = wsById.get(workspaceId);
      const name = w?.name || w?.title || workspaceId;
      // Workspaces with one name (worktrees of a project) share the prefix and the chat numbers.
      const twin = workspaces.find((o) => o.id !== workspaceId && (o.name || o.title) === name && state.prefixes[o.id]);
      const p = twin ? state.prefixes[twin.id] : prefixFor(name, taken);
      state.prefixes[workspaceId] = p;
      taken.add(p);
    }
    return state.prefixes[workspaceId];
  };
  const next = (scope: string) => `${scope}-${(state.last[scope] = (state.last[scope] ?? 0) + 1)}`;

  const chats = agents.filter((a) => !parentOf(a) && !a.archivedAt && a.workspaceId && !keyOf.has(a.id)).sort(byCreated);
  for (const a of chats) {
    const k = next(prefixOf(a.workspaceId!));
    keyOf.set(a.id, k);
    fresh.add(a.id);
  }
  const children = new Map<string, AgentLike[]>();
  for (const a of agents) {
    const p = parentOf(a);
    if (p) children.set(p, [...(children.get(p) ?? []), a]);
  }
  const queue = [...keyOf.keys()];
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of (children.get(id) ?? []).sort(byCreated)) {
      if (!keyOf.has(c.id)) {
        keyOf.set(c.id, next(keyOf.get(id)!));
        fresh.add(c.id);
      }
      queue.push(c.id);
    }
  }

  const known = [...new Set([...Object.values(KNOWN_PREFIXES), ...taken])];
  const changes: KeyChange[] = [];
  for (const a of agents) {
    const key = keyOf.get(a.id);
    if (!key) continue;
    state.assigned[a.id] = key;
    const labels: Record<string, string> = {};
    if (a.labels?.[KEY_LABEL] !== key) labels[KEY_LABEL] = key;
    let title = (a.title ?? "").trim();
    let multica = a.labels?.[MULTICA_LABEL] || null;
    if (fresh.has(a.id) && title) {
      const old = multicaKey(title, known);
      if (old) {
        multica = old.key;
        labels[MULTICA_LABEL] = old.key;
        title = old.rest;
      }
    }
    // A chat without a title yet gets its key now and the prefix when Paseo names it.
    const name = title ? bareTitle(title, key, multica, known) : "";
    const wanted = name ? `${key}: ${name}` : undefined;
    const change: KeyChange = { id: a.id, key, oldTitle: a.title ?? null, labels };
    if (wanted && wanted !== a.title) change.title = wanted;
    if (change.title || Object.keys(labels).length) changes.push(change);
  }
  // A rename moves updatedAt (the activity time of Dialogs and the card date): oldest first keeps the order.
  const touched = new Map(agents.map((a) => [a.id, a.updatedAt || a.createdAt]));
  changes.sort((x, y) => touched.get(x.id)!.localeCompare(touched.get(y.id)!));
  return { state, changes };
}
