// Numbers of chats and cards: "AGM-1" is a chat of the agmazin workspace, "AGM-1-2" is its second card,
// "AGM-1-2-1" is a subagent of that card. The plugin server assigns them; numbers are never reused.
import { KEY_LABEL, parentOf, type AgentLike } from "./model";

export { KEY_LABEL, splitTitle } from "./model";
export const MULTICA_LABEL = "multica.key";
// Keys a chat and its cards had before the chat moved to another workspace, oldest first, separated by ";":
// the CLI splits --label on commas.
export const PREV_LABEL = "kanban.prev-key";
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
  // Old key -> new key after a move, so a failed label write never renumbers the chat twice.
  retired: Record<string, string>;
}
export const EMPTY_KEYS: KeysState = { prefixes: {}, last: {}, assigned: {}, retired: {} };

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
export function bareTitle(title: string, keys: readonly (string | null)[], prefixes: readonly string[]) {
  const own = prefixes.length ? new RegExp(`^(?:${prefixes.map(esc).join("|")})-\\d+(?:-\\d+)+:\\s*`) : null;
  const exact = keys.filter(Boolean).map((k) => new RegExp(`^${esc(k!)}(?![-\\d])${SEP}`));
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
  const state: KeysState = {
    prefixes: { ...prev.prefixes },
    last: { ...prev.last },
    assigned: { ...prev.assigned },
    retired: { ...prev.retired },
  };
  const keyOf = new Map<string, string>();
  // Keys an agent had before, for kanban.prev-key and for cutting them off the title.
  const prevOf = new Map<string, string[]>();
  const addPrev = (id: string, k: string) => {
    const list = prevOf.get(id) ?? [];
    if (!list.includes(k)) prevOf.set(id, [...list, k]);
  };
  const current = (k: string) => {
    for (let i = 0; state.retired[k] && i < 50; i++) k = state.retired[k];
    return k;
  };
  for (const a of agents) {
    for (const k of (a.labels?.[PREV_LABEL] ?? "").split(/[;,]/).map((x) => x.trim()).filter((x) => parseKey(x))) addPrev(a.id, k);
    const label = a.labels?.[KEY_LABEL] || state.assigned[a.id];
    if (!parseKey(label)) continue;
    const k = current(label!);
    if (k !== label) addPrev(a.id, label!);
    keyOf.set(a.id, k);
    state.assigned[a.id] = k;
  }
  // Counters never go below a number in use or retired, even if the state file was lost.
  for (const k of [...keyOf.values(), ...[...prevOf.values()].flat(), ...Object.keys(state.retired)]) {
    const p = parseKey(k);
    if (p) state.last[p.scope] = Math.max(state.last[p.scope] ?? 0, p.n);
  }
  const wsById = new Map(workspaces.map((w) => [w.id, w]));
  const nameOf = (id: string) => wsById.get(id)?.name || wsById.get(id)?.title || id;
  const owner = new Map<string, string>(Object.entries(state.prefixes).map(([w, p]) => [p, w]));
  // A workspace learns its prefix from the keys of its chats, the most common first. A prefix of a workspace with
  // another name is never learned: a chat moved in from there still carries it.
  const votes = new Map<string, Map<string, number>>();
  for (const a of agents) {
    const k = keyOf.get(a.id);
    if (!k || !a.workspaceId || parentOf(a) || state.prefixes[a.workspaceId]) continue;
    const byPrefix = votes.get(a.workspaceId) ?? new Map<string, number>();
    const p = parseKey(k)!.prefix;
    byPrefix.set(p, (byPrefix.get(p) ?? 0) + 1);
    votes.set(a.workspaceId, byPrefix);
  }
  // A tie goes to the workspace whose own name gives the prefix.
  const natural = (w: string, p: string) => (prefixFor(nameOf(w), new Set()) === p ? 1 : 0);
  const ballots = [...votes].flatMap(([w, byPrefix]) => [...byPrefix].map(([p, n]) => ({ w, p, n: n + natural(w, p) / 2 })));
  for (const { w, p } of ballots.sort((x, y) => y.n - x.n)) {
    if (state.prefixes[w]) continue;
    const other = owner.get(p);
    if (other && other !== w && nameOf(other) !== nameOf(w)) continue;
    state.prefixes[w] = p;
    owner.set(p, w);
  }
  const taken = new Set(Object.values(state.prefixes));
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

  // A chat moved to a workspace with another prefix gets the next number there, its cards keep their own numbers
  // under it (AGM-8-2 -> ECO-12-2). Archived chats keep their keys.
  const renamed = new Map<string, string>();
  const moved = agents.filter((a) => !parentOf(a) && !a.archivedAt && a.workspaceId && keyOf.has(a.id)).sort(byCreated);
  for (const a of moved) {
    const old = parseKey(keyOf.get(a.id))!;
    // A card key on a chat is a card detached for a moment (Dialogs archive its chat during a move): not a move.
    if (old.nums.length !== 1 || old.prefix === prefixOf(a.workspaceId!)) continue;
    renamed.set(a.id, next(prefixOf(a.workspaceId!)));
  }
  const children = new Map<string, AgentLike[]>();
  for (const a of agents) {
    const p = parentOf(a);
    if (p) children.set(p, [...(children.get(p) ?? []), a]);
  }
  // Cards follow a renamed parent; a card left with another prefix (detached while its chat moved) is brought under it.
  const walk = agents.filter((a) => !parentOf(a) && keyOf.has(a.id)).map((a) => a.id);
  while (walk.length) {
    const id = walk.shift()!;
    const parentKey = renamed.get(id) ?? keyOf.get(id)!;
    for (const c of (children.get(id) ?? []).sort(byCreated)) {
      walk.push(c.id);
      const old = keyOf.get(c.id);
      if (!old || renamed.has(c.id)) continue;
      const p = parseKey(old)!;
      if (!renamed.has(id) && p.prefix === parseKey(parentKey)!.prefix) continue;
      if (p.n > (state.last[parentKey] ?? 0)) state.last[parentKey] = p.n;
      renamed.set(c.id, `${parentKey}-${p.n}`);
    }
  }
  // A clash with a number in use (copied keys, a card made meanwhile) takes the next free one.
  const used = new Set([...keyOf].filter(([id]) => !renamed.has(id)).map(([, k]) => k));
  for (const [id, k] of renamed) {
    let key = k;
    if (used.has(key)) key = next(key.slice(0, key.lastIndexOf("-")));
    used.add(key);
    const old = keyOf.get(id)!;
    addPrev(id, old);
    state.retired[old] = key;
    keyOf.set(id, key);
  }

  const chats = agents.filter((a) => !parentOf(a) && !a.archivedAt && a.workspaceId && !keyOf.has(a.id)).sort(byCreated);
  for (const a of chats) {
    const k = next(prefixOf(a.workspaceId!));
    keyOf.set(a.id, k);
  }
  const queue = [...keyOf.keys()];
  while (queue.length) {
    const id = queue.shift()!;
    for (const c of (children.get(id) ?? []).sort(byCreated)) {
      if (!keyOf.has(c.id)) {
        keyOf.set(c.id, next(keyOf.get(id)!));
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
    const prevKeys = prevOf.get(a.id) ?? [];
    if (prevKeys.length && a.labels?.[PREV_LABEL] !== prevKeys.join(";")) labels[PREV_LABEL] = prevKeys.join(";");
    const title = (a.title ?? "").trim();
    let multica = a.labels?.[MULTICA_LABEL] || null;
    // A chat without a title yet gets its key now and the prefix when Paseo names it.
    let name = title ? bareTitle(title, [key, multica, ...prevKeys], known) : "";
    // An old Multica key goes to its label once; also after a failed first write, when the key came from the state.
    const old = !multica && name ? multicaKey(name, known) : null;
    if (old && old.key !== key) {
      multica = old.key;
      labels[MULTICA_LABEL] = old.key;
      name = bareTitle(old.rest, [key, multica, ...prevKeys], known);
    }
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
