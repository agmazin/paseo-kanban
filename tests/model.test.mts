import test from "node:test";
import assert from "node:assert/strict";
import { cardsOf, columnOf, columns, DEFAULT_PREFS, modelName, subgroupField, subgroups } from "../shared/model.ts";

const base = { provider: "claude", status: "idle", createdAt: "2026-10-21T10:00:00Z", lastActivityAt: "2026-10-21T10:05:00Z", workspaceId: "w1" };
const chat = { ...base, id: "chat", title: "Тендер" };
const sub = (id: string, extra: object = {}) => ({ ...base, id, title: id, parentAgentId: "chat", ...extra });

test("columns follow runtime state first, then labels, then parent check", () => {
  assert.equal(columnOf(sub("a", { status: "running", labels: { kanban: "done" } }), chat), "run");
  assert.equal(columnOf(sub("a", { attentionReason: "permission" }), chat), "need");
  assert.equal(columnOf(sub("a", { status: "running", pendingPermissions: [{}] }), chat), "need");
  assert.equal(columnOf(sub("a", { status: "error" }), chat), "need");
  assert.equal(columnOf(sub("a", { labels: { kanban: "done" } }), chat), "done");
  assert.equal(columnOf(sub("a", { labels: { kanban: "ask" } }), chat), "need");
  assert.equal(columnOf(sub("a", { status: "running", labels: { kanban: "ask" } }), chat), "run");
  assert.equal(cardsOf([chat, sub("a", { labels: { kanban: "ask" } })])[0].asks, true);
  assert.equal(columnOf(sub("a", { labels: { kanban: "queue" } }), chat), "q");
  assert.equal(columnOf(sub("a", { labels: { kanban: "review" } }), { ...chat, status: "running" }), "acc");
  assert.equal(columnOf(sub("a"), { ...chat, status: "running" }), "run");
  assert.equal(columnOf(sub("a"), chat), "acc");
  assert.equal(columnOf(sub("a", { archivedAt: "2026-10-21T11:00:00Z" }), chat), "done");
});

test("only subagents become cards, parent label is a fallback", () => {
  const cards = cardsOf([chat, sub("a"), { ...base, id: "b", labels: { "paseo.parent-agent-id": "chat" } }]);
  assert.deepEqual(cards.map((c) => c.id), ["a", "b"]);
  assert.equal(cards[0].owner?.title, "Тендер");
});

test("model names", () => {
  assert.equal(modelName("claude", "claude-opus-5-5"), "Opus 5.5");
  assert.equal(modelName("codex", "gpt-5.5"), "GPT-5.5");
  assert.equal(modelName("codex", "gpt-6.1-sol"), "GPT-6.1-Sol");
  assert.equal(modelName("codex", null), "Codex");
});

test("status columns are fixed, archive groups sit inside columns", () => {
  const cards = cardsOf([chat, sub("a", { status: "running" }), sub("b", { archivedAt: "x" })]);
  const cols = columns(cards, DEFAULT_PREFS);
  assert.deepEqual(cols.map((c) => c.key), ["q", "run", "need", "acc", "done"]);
  assert.equal(cols[1].cards.length, 1);
  assert.equal(cols[4].archived.length, 1);
  assert.equal(columns(cards, { ...DEFAULT_PREFS, hideArch: true })[4].archived.length, 0);
});

test("group by chat moves archived chats to their own column", () => {
  const old = { ...base, id: "old", title: "Старый", archivedAt: "x" };
  const cards = cardsOf([chat, old, sub("a"), sub("c", { archivedAt: "x" }), { ...sub("b"), parentAgentId: "old" }]);
  const cols = columns(cards, { ...DEFAULT_PREFS, group: "chat" });
  assert.deepEqual(cols.map((c) => c.name), ["Тендер", "Архивные чаты"]);
  assert.deepEqual(cols[0].archived.map((c) => c.id), ["c"]);
  assert.equal(cols[1].archivedChats?.[0].label, "Старый");
});

test("subgroups by sort field, not by the grouping field", () => {
  assert.equal(subgroupField({ ...DEFAULT_PREFS, group: "status", sort: "chat" }), "chat");
  assert.equal(subgroupField({ ...DEFAULT_PREFS, group: "chat", sort: "chat" }), "status");
  assert.equal(subgroupField({ ...DEFAULT_PREFS, group: "status", sort: "status" }), null);
  assert.equal(subgroupField({ ...DEFAULT_PREFS, sort: "u" }), null);
  const cards = cardsOf([chat, sub("a"), sub("b", { status: "running" })]);
  assert.deepEqual(subgroups(cards, "status", DEFAULT_PREFS).map((g) => g.value), ["run", "acc"]);
});

test("panel stage sort: pipeline groups, still cards; old saved sorts fall back to it", async () => {
  const { panelOrder } = await import("../shared/model.ts");
  const { sanitizePrefs } = await import("../shared/contracts.ts");
  const prefs = sanitizePrefs({ chatSort: "t", buttons: true, executor: false, toggled: { "p|done": true } }, DEFAULT_PREFS);
  assert.equal(prefs.chatSort, "stage");
  assert.equal(prefs.buttons, true);
  assert.equal(prefs.executor, false);
  assert.deepEqual(prefs.toggled, { "p|done": true });
  assert.deepEqual(panelOrder(prefs).groups, ["q", "run", "need", "acc", "done"]);
  assert.equal(panelOrder(prefs).sort.sort, "c");
  assert.deepEqual(panelOrder({ ...prefs, chatOrder: "desc" }).groups, ["done", "acc", "need", "run", "q"]);
  assert.equal(DEFAULT_PREFS.chatSort, "stage");
});
