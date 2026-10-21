// Kanban model: a card is a Paseo subagent (executor), its owner is the parent chat.
export type Col = "q" | "run" | "need" | "acc" | "done";
export const COLS: readonly [Col, string][] = [
  ["q", "Очередь"],
  ["run", "В работе"],
  ["need", "Нужен ответ"],
  ["acc", "Ждёт приёмки"],
  ["done", "Готово"],
];
export const STATUS: Record<Col, string> = Object.fromEntries(COLS) as Record<Col, string>;
// Label an agent or orchestrator sets with `paseo agent update <id> --label kanban=<value>`.
export const LABEL = "kanban";
export const MARKS = ["queue", "review", "done", "ask"] as const;
export const NEUTRAL = "work";

export interface AgentLike {
  id: string;
  workspaceId?: string | null;
  provider: string;
  model?: string | null;
  status: string;
  title?: string | null;
  createdAt: string;
  updatedAt?: string;
  lastActivityAt?: string;
  archivedAt?: string | null;
  parentAgentId?: string | null;
  labels?: Readonly<Record<string, string>>;
  requiresAttention?: boolean;
  attentionReason?: string | null;
  pendingPermissions?: readonly unknown[] | null;
}

export interface Owner {
  id: string;
  title: string;
  provider: string;
  archived: boolean;
}

export interface Card {
  id: string;
  workspaceId: string;
  title: string;
  col: Col;
  archived: boolean;
  provider: string;
  executor: string;
  created: string;
  updated: string;
  owner: Owner | null;
  // The executor asked Alexander and waits for his answer ("Вопрос к тебе").
  asks: boolean;
}

export function parentOf(a: AgentLike) {
  return a.parentAgentId || a.labels?.["paseo.parent-agent-id"] || null;
}

export function providerOf(provider: string) {
  return provider.split("/")[0] || provider;
}

export function modelName(provider: string, model?: string | null) {
  const p = providerOf(provider);
  const m = (model || provider.split("/")[1] || "").trim();
  const claude = /^claude-(opus|sonnet|haiku|fable)-(\d+)-(\d+)/.exec(m);
  if (claude) return `${claude[1][0].toUpperCase()}${claude[1].slice(1)} ${claude[2]}.${claude[3]}`;
  const gpt = /^gpt-(.+)$/i.exec(m);
  if (gpt) return `GPT-${gpt[1].split("-").map((w, i) => (i ? w[0].toUpperCase() + w.slice(1) : w)).join("-")}`;
  if (m) return m;
  return p === "codex" ? "Codex" : p === "claude" ? "Claude" : p;
}

// A pending permission or question keeps the turn running, so it is checked first.
export function waitsForAnswer(a: AgentLike) {
  return (a.pendingPermissions?.length ?? 0) > 0 || a.attentionReason === "permission";
}

// Runtime state wins over labels: a running executor is in work even if it was accepted before.
export function columnOf(a: AgentLike, parent?: AgentLike | null): Col {
  const mark = a.labels?.[LABEL];
  if (a.archivedAt) return mark === "queue" ? "q" : mark === "review" ? "acc" : "done";
  if (waitsForAnswer(a)) return "need";
  if (a.status === "running" || a.status === "initializing") return "run";
  if (a.status === "error" || a.attentionReason === "error" || mark === "ask") return "need";
  if (mark === "done") return "done";
  if (mark === "queue") return "q";
  if (mark === "review") return "acc";
  // Finished executor: the parent chat checks it while its own turn is running.
  if (parent && !parent.archivedAt && parent.status === "running") return "run";
  return "acc";
}

export function cardsOf(agents: readonly AgentLike[]): Card[] {
  const byId = new Map(agents.map((a) => [a.id, a]));
  const cards: Card[] = [];
  for (const a of agents) {
    const parentId = parentOf(a);
    if (!parentId || !a.workspaceId) continue;
    const parent = byId.get(parentId) ?? null;
    cards.push({
      id: a.id,
      workspaceId: a.workspaceId,
      title: a.title?.trim() || "Без названия",
      col: columnOf(a, parent),
      archived: !!a.archivedAt,
      provider: providerOf(a.provider),
      executor: modelName(a.provider, a.model),
      created: a.createdAt,
      updated: a.lastActivityAt || a.updatedAt || a.createdAt,
      asks: !a.archivedAt && a.labels?.[LABEL] === "ask" && a.status !== "running",
      owner: parent
        ? {
            id: parent.id,
            title: parent.title?.trim() || "Без названия",
            provider: providerOf(parent.provider),
            archived: !!parent.archivedAt,
          }
        : null,
    });
  }
  return cards;
}

export type GroupKey = "status" | "chat" | "exec" | "prov" | "date";
export type SortKey = "u" | "c" | "t" | "status" | "chat" | "exec";
export const GROUPS: readonly [GroupKey, string][] = [
  ["status", "Статус"],
  ["chat", "Агент"],
  ["exec", "Исполнитель"],
  ["prov", "Нейросеть"],
  ["date", "Дата изменения"],
];
export const SORTS: readonly [SortKey, string][] = [
  ["u", "Дата изменения"],
  ["c", "Дата создания"],
  ["t", "Название"],
  ["status", "Статус"],
  ["chat", "Агент"],
  ["exec", "Исполнитель"],
];

export interface Prefs {
  group: GroupKey;
  sort: SortKey;
  order: "asc" | "desc";
  hideArch: boolean;
  details: boolean;
  // Subgroups are open by default, archive groups are closed by default.
  toggled: Record<string, boolean>;
}
export const DEFAULT_PREFS: Prefs = {
  group: "status",
  sort: "chat",
  order: "asc",
  hideArch: false,
  details: false,
  toggled: {},
};

export function dayBucket(date: string, now = new Date()) {
  const d = new Date(date);
  if (d.toDateString() === now.toDateString()) return "Сегодня";
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  return d.toDateString() === y.toDateString() ? "Вчера" : "Раньше";
}

export function fieldOf(c: Card, f: GroupKey | SortKey, now = new Date()): string {
  if (f === "status") return c.col;
  if (f === "chat") return c.owner?.title ?? "Без чата";
  if (f === "exec") return c.executor;
  if (f === "prov") return c.provider === "codex" ? "Codex" : c.provider === "claude" ? "Claude" : c.provider;
  if (f === "date") return dayBucket(c.updated, now);
  if (f === "t") return c.title;
  if (f === "c") return c.created;
  return c.updated;
}

export function labelOf(f: GroupKey | SortKey, v: string) {
  return f === "status" ? STATUS[v as Col] ?? v : v;
}

export function sortCards(list: readonly Card[], prefs: Prefs) {
  const dir = prefs.order === "asc" ? 1 : -1;
  return [...list].sort((a, b) => {
    if (prefs.sort === "t") return a.title.localeCompare(b.title, "ru") * dir;
    const key = prefs.sort === "c" ? "created" : "updated";
    // Ascending dates mean the newest first, as in the approved mockup.
    return b[key].localeCompare(a[key]) * dir;
  });
}

const SUBS: readonly SortKey[] = ["chat", "exec", "status"];
export function subgroupField(prefs: Prefs, inChat = false): "chat" | "exec" | "status" | null {
  if (inChat) return null;
  if (!SUBS.includes(prefs.sort)) return null;
  if (prefs.sort !== prefs.group) return prefs.sort as "chat" | "exec" | "status";
  return prefs.group !== "status" ? "status" : null;
}

export interface Subgroup {
  key: string;
  value: string;
  label: string;
  cards: Card[];
}

export function subgroups(list: readonly Card[], field: "chat" | "exec" | "status", prefs: Prefs): Subgroup[] {
  const values =
    field === "status"
      ? COLS.map(([k]) => k as string)
      : [...new Set(list.map((c) => fieldOf(c, field)))].sort((a, b) => a.localeCompare(b, "ru"));
  return values
    .map((value) => ({
      key: value,
      value,
      label: labelOf(field, value),
      cards: sortCards(list.filter((c) => fieldOf(c, field) === value), prefs),
    }))
    .filter((g) => g.cards.length > 0);
}

export interface Column {
  key: string;
  name: string;
  status: Col | null;
  cards: Card[];
  archived: Card[];
  // Group by chat or executor: cards of archived chats live in their own column.
  archivedChats?: Subgroup[];
}

export function columns(all: readonly Card[], prefs: Prefs, now = new Date()): Column[] {
  const byChat = prefs.group === "chat" || prefs.group === "exec";
  const archivedChat = (c: Card) => byChat && !!c.owner?.archived;
  const live = all.filter((c) => !c.archived && !archivedChat(c));
  const arch = prefs.hideArch ? [] : all.filter((c) => c.archived && !archivedChat(c));
  let keys: string[];
  if (prefs.group === "status") keys = COLS.map(([k]) => k);
  else if (prefs.group === "date") keys = ["Сегодня", "Вчера", "Раньше"];
  else
    keys = [...new Set([...live, ...arch].map((c) => fieldOf(c, prefs.group, now)))].sort((a, b) =>
      a.localeCompare(b, "ru"),
    );
  const cols: Column[] = keys.map((key) => ({
    key,
    name: labelOf(prefs.group, key),
    status: prefs.group === "status" ? (key as Col) : null,
    cards: live.filter((c) => fieldOf(c, prefs.group, now) === key),
    archived: arch.filter((c) => fieldOf(c, prefs.group, now) === key),
  }));
  const visible = prefs.group === "status" || prefs.group === "date" ? cols : cols.filter((c) => c.cards.length || c.archived.length);
  if (byChat && !prefs.hideArch) {
    const old = all.filter(archivedChat);
    if (old.length) {
      const chats = [...new Set(old.map((c) => fieldOf(c, "chat")))].sort((a, b) => a.localeCompare(b, "ru"));
      visible.push({
        key: "archchats",
        name: "Архивные чаты",
        status: null,
        cards: [],
        archived: [],
        archivedChats: chats.map((chat) => ({
          key: chat,
          value: chat,
          label: chat,
          cards: sortCards(old.filter((c) => fieldOf(c, "chat") === chat), prefs),
        })),
      });
    }
  }
  return visible;
}

// Chat panel order: what needs Alexander first.
export const CHAT_ORDER: readonly Col[] = ["acc", "need", "run", "q", "done"];

export function shortDate(date: string, now = new Date()) {
  const d = new Date(date);
  if (!Number.isFinite(d.getTime())) return "";
  if (now.getTime() - d.getTime() < 120_000) return "сейчас";
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return "вчера";
  const months = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];
  return `${d.getDate()} ${months[d.getMonth()]}`;
}
