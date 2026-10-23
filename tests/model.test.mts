import test from "node:test";
import assert from "node:assert/strict";
import { cardsOf, columnOf, columns, DEFAULT_PREFS, modelName, subgroupField, subgroups, priorityOf, sortCards } from "../shared/model.ts";

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
  assert.equal(columnOf(sub("a"), chat), "need");
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
  assert.deepEqual(subgroups(cards, "status", DEFAULT_PREFS).map((g) => g.value), ["run", "need"]);
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


test("waiting owner distinguishes explicit human decisions from runtime stops", () => {
  const cases = [
    [{ labels: { kanban: "ask" } }, "alexander", "ask"],
    [{ labels: { kanban: "review" } }, "alexander", "review"],
    [{ status: "running", pendingPermissions: [{}] }, "alexander", "permission"],
    [{ status: "error" }, "techlead", "error"],
    [{ lastError: "Rate limit reached" }, "techlead", "error"],
    [{ lastError: "Authentication expired" }, "techlead", "error"],
    [{ providerUnavailable: true }, "techlead", "provider-unavailable"],
    [{}, "techlead", "unmarked-stop"],
    [{ status: "running", lastError: "old error" }, null, null],
    [{ status: "initializing", labels: { kanban: "ask" } }, null, null],
    [{ archivedAt: "x", status: "error" }, null, null],
    [{ labels: { kanban: "done" } }, null, null],
    [{ labels: { kanban: "queue" } }, null, null],
    [{ labels: { kanban: "accepted" } }, null, null],
    [{ status: "error", labels: { kanban: "ask" } }, "alexander", "ask"],
  ] as const;
  for (const [extra, owner, reason] of cases) {
    const card = cardsOf([chat, sub("case", extra)])[0];
    assert.equal(card.waitingFor, owner, JSON.stringify(extra));
    assert.equal(card.waitReason, reason, JSON.stringify(extra));
    assert.equal(card.asks, owner === "alexander");
  }
});

test("priority defaults, owner propagation and stable ordering independent of direction", () => {
  assert.equal(priorityOf({}), "normal");
  assert.equal(priorityOf({ labels: { "kanban.priority": "invalid" } }), "normal");
  const agents = [chat, sub("low", { labels: { "kanban.priority": "low" } }), sub("normal"), sub("high1", { labels: { "kanban.priority": "high" } }), sub("high2", { labels: { "kanban.priority": "high" } })];
  const cards = cardsOf(agents);
  for (const order of ["asc", "desc"] as const) assert.deepEqual(sortCards(cards, { ...DEFAULT_PREFS, order }).map(c => c.id), ["high1", "high2", "normal", "low"]);
  assert.equal(cards[0].owner?.priority, "normal");
  assert.deepEqual(subgroups(cards, "chat", DEFAULT_PREFS).flatMap(g => g.cards).map(c => c.id), ["high1", "high2", "normal", "low"]);
});
