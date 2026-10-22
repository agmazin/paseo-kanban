import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";

register("./resolve-ts.mjs", import.meta.url);
const { planKeys, prefixFor, bareTitle, multicaKey, EMPTY_KEYS } = await import("../shared/keys.ts");
const { cardsOf } = await import("../shared/model.ts");

const ws = [
  { id: "w1", name: "agmazin" },
  { id: "w2", name: "ЭкоЭксперт" },
];
let t = 0;
const at = () => `2026-10-22T10:${String(t++).padStart(2, "0")}:00Z`;
const chat = (id: string, title: string | null, extra: object = {}) => ({ id, title, provider: "claude", status: "idle", workspaceId: "w1", createdAt: at(), ...extra });
const card = (id: string, parent: string, title: string, extra: object = {}) => chat(id, title, { parentAgentId: parent, ...extra });

// Applies a plan the way the CLI does: labels merge, the name replaces the title.
function apply(agents: any[], changes: any[]) {
  return agents.map((a) => {
    const c = changes.find((x) => x.id === a.id);
    return c ? { ...a, title: c.title ?? a.title, labels: { ...a.labels, ...c.labels } } : a;
  });
}

test("first numbering: live chats by creation date per workspace, all their cards, archived chats skipped", () => {
  const agents = [
    chat("c1", "Paseo Канбан"),
    chat("old", "Старый", { archivedAt: "x" }),
    chat("e1", "Сайт", { workspaceId: "w2" }),
    chat("c2", "Бэкапы"),
    card("k1", "c1", "Кнопки приёмки"),
    card("k2", "c1", "Архивная", { archivedAt: "x", labels: { kanban: "done" } }),
    card("k3", "old", "Карточка архивного чата"),
    card("n1", "k1", "Вложенный"),
  ];
  const { changes, state } = planKeys(agents, ws, EMPTY_KEYS);
  const by = Object.fromEntries(changes.map((c) => [c.id, c.title]));
  assert.deepEqual(by, {
    c1: "AGM-1: Paseo Канбан",
    e1: "ECO-1: Сайт",
    c2: "AGM-2: Бэкапы",
    k1: "AGM-1-1: Кнопки приёмки",
    k2: "AGM-1-2: Архивная",
    n1: "AGM-1-1-1: Вложенный",
  });
  assert.equal(changes.find((c) => c.id === "k2")!.labels["kanban.key"], "AGM-1-2");
  assert.deepEqual(state.prefixes, { w1: "AGM", w2: "ECO" });
  // Idempotent: the applied plan has nothing left to change.
  assert.deepEqual(planKeys(apply(agents, changes), ws, state).changes, []);
});

test("numbers are never reused, a chat back from the archive gets the next one", () => {
  const agents = [chat("c1", "Один"), chat("c2", "Два"), chat("c3", "Три", { archivedAt: "x" })];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  let live = apply(agents, first.changes).filter((a) => a.id !== "c2");
  // c2 deleted; a new card for c1, c3 back from the archive and a new chat.
  live = live.map((a) => (a.id === "c3" ? { ...a, archivedAt: null } : a));
  live.push(card("k1", "c1", "Новая"), chat("c4", "Четыре"));
  const second = planKeys(live, ws, first.state);
  const by = Object.fromEntries(second.changes.map((c) => [c.id, c.title]));
  assert.deepEqual(by, { c3: "AGM-3: Три", c4: "AGM-4: Четыре", k1: "AGM-1-1: Новая" });
  // A lost state file: counters come back from the labels.
  const third = planKeys([...apply(live, second.changes), chat("c5", "Пять")], ws, EMPTY_KEYS);
  assert.equal(third.changes.find((c) => c.id === "c5")!.title, "AGM-5: Пять");
});

test("changes go oldest first, so renames keep the activity order", () => {
  const agents = [
    chat("c1", "Новый", { updatedAt: "2026-10-22T12:00:00Z" }),
    chat("c2", "Старый", { updatedAt: "2026-10-20T12:00:00Z" }),
    card("k", "c1", "Средний", { updatedAt: "2026-10-21T12:00:00Z" }),
  ];
  assert.deepEqual(planKeys(agents, ws, EMPTY_KEYS).changes.map((c) => c.id), ["c2", "k", "c1"]);
});

test("a failed write keeps the number: the state remembers the assignment", () => {
  const agents = [chat("c1", "Один")];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  const again = planKeys(agents, ws, first.state);
  assert.equal(again.changes[0].title, "AGM-1: Один");
  assert.equal(again.state.last.AGM, 1);
});

test("old Multica keys move to multica.key, no double prefix", () => {
  const agents = [
    chat("c1", "Бэкапы"),
    card("a", "c1", "AGM-23: Бэкап vps-multica-uploads: сбой команды"),
    card("b", "c1", "ECO-88 - amoCRM: файлы, письма, события"),
    card("c", "c1", "ECO-52 Справочник терминов"),
    card("d", "c1", "GPT-6-Astra: мнение"),
  ];
  const { changes, state } = planKeys(agents, ws, EMPTY_KEYS);
  const by = Object.fromEntries(changes.map((c) => [c.id, c]));
  assert.equal(by.a.title, "AGM-1-1: Бэкап vps-multica-uploads: сбой команды");
  assert.equal(by.a.labels["multica.key"], "AGM-23");
  assert.equal(by.b.title, "AGM-1-2: amoCRM: файлы, письма, события");
  assert.equal(by.b.labels["multica.key"], "ECO-88");
  assert.equal(by.c.title, "AGM-1-3: Справочник терминов");
  assert.equal(by.d.title, "AGM-1-4: GPT-6-Astra: мнение");
  assert.equal(by.d.labels["multica.key"], undefined);
  // An agent later puts the Multica key back: it goes away again.
  const applied = apply(agents, changes).map((x) => (x.id === "a" ? { ...x, title: "AGM-23: Бэкап" } : x));
  assert.equal(planKeys(applied, ws, state).changes[0].title, "AGM-1-1: Бэкап");
});

test("a failed first write: the Multica key still goes to its label, a double prefix is repaired", () => {
  const agents = [chat("c1", "Телефония"), card("k", "c1", "ECO-42: Архив звонков")];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  // The write of k failed: no labels, the old title; its key is in the state.
  const second = planKeys(apply(agents, first.changes.filter((c) => c.id !== "k")), ws, first.state);
  assert.deepEqual(second.changes.map((c) => [c.title, c.labels]), [["AGM-1-1: Архив звонков", { "kanban.key": "AGM-1-1", "multica.key": "ECO-42" }]]);
  // Already written with a double prefix (0.3.0 before the fix).
  const doubled = [chat("c1", "AGM-1: Телефония", { labels: { "kanban.key": "AGM-1" } }), card("k", "c1", "AGM-1-1: ECO-42: Архив звонков", { labels: { "kanban.key": "AGM-1-1" } })];
  assert.deepEqual(planKeys(doubled, ws, EMPTY_KEYS).changes.map((c) => [c.title, c.labels]), [["AGM-1-1: Архив звонков", { "multica.key": "ECO-42" }]]);
  // A chat named like its own key is not a Multica key.
  assert.deepEqual(planKeys([chat("c2", "AGM-1: Чат", { labels: { "kanban.key": "AGM-1" } })], ws, EMPTY_KEYS).changes, []);
});

test("the prefix comes back after a rename, without loops", () => {
  const agents = [chat("c1", null), card("k", "c1", "Задача")];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  // Untitled chat: the key now, the title later.
  assert.deepEqual(first.changes.find((c) => c.id === "c1"), { id: "c1", key: "AGM-1", oldTitle: null, labels: { "kanban.key": "AGM-1" } });
  let now = apply(agents, first.changes).map((a) => (a.id === "c1" ? { ...a, title: "Автоназвание Paseo" } : a));
  let plan = planKeys(now, ws, first.state);
  assert.deepEqual(plan.changes.map((c) => [c.id, c.title, c.labels]), [["c1", "AGM-1: Автоназвание Paseo", {}]]);
  now = apply(now, plan.changes);
  assert.deepEqual(planKeys(now, ws, plan.state).changes, []);
  // The agent renames its card, sometimes with a wrong number of its own.
  now = now.map((a) => (a.id === "k" ? { ...a, title: "AGM-7-3: Новое имя" } : a));
  plan = planKeys(now, ws, plan.state);
  assert.deepEqual(plan.changes.map((c) => c.title), ["AGM-1-1: Новое имя"]);
  assert.deepEqual(planKeys(apply(now, plan.changes), ws, plan.state).changes, []);
});

test("new workspace prefixes: three Latin letters, unique", () => {
  assert.equal(prefixFor("otchetico", new Set()), "OTC");
  assert.equal(prefixFor("Личное", new Set()), "LIC");
  assert.equal(prefixFor("Личное", new Set(["LIC"])), "LIH");
  assert.equal(prefixFor("ab", new Set()), "ABX");
  const { state } = planKeys([chat("x", "Чат", { workspaceId: "w9" })], [...ws, { id: "w9", name: "Ремонт" }], EMPTY_KEYS);
  assert.equal(state.prefixes.w9, "REM");
  const twins = planKeys(
    [chat("x", "Один", { workspaceId: "w2" }), chat("y", "Два", { workspaceId: "w3" })],
    [...ws, { id: "w3", name: "ЭкоЭксперт" }],
    EMPTY_KEYS,
  );
  assert.deepEqual(twins.changes.map((c) => c.title), ["ECO-1: Один", "ECO-2: Два"]);
});

test("title helpers and the card shows the key apart", () => {
  assert.equal(bareTitle("AGM-1-2: AGM-1-2: Имя", ["AGM-1-2", null], ["AGM"]), "Имя");
  assert.equal(bareTitle("AGM-1: Имя", ["AGM-1-2", null], ["AGM"]), "AGM-1: Имя");
  assert.equal(multicaKey("AGM-1-2: x", ["AGM"]), null);
  const [c] = cardsOf([chat("c1", "AGM-1: Чат"), card("k", "c1", "AGM-1-1: Задача", { labels: { "kanban.key": "AGM-1-1" } })]);
  assert.equal(c.key, "AGM-1-1");
  assert.equal(c.title, "Задача");
});

test("a chat moved to another workspace: next number there, cards keep their own numbers, old keys in prev-key", () => {
  const agents = [
    chat("e1", "Сайт", { workspaceId: "w2" }),
    chat("c1", "Один"),
    chat("c2", "geoexpert-msk.ru"),
    card("k1", "c2", "Картинки"),
    card("k2", "c2", "Архивная", { archivedAt: "x" }),
    card("n1", "k2", "Вложенный"),
  ];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  let now = apply(agents, first.changes);
  assert.equal(now.find((a) => a.id === "c2").title, "AGM-2: geoexpert-msk.ru");
  // Dialogs move c2 to ЭкоЭксперт: same id, new workspace, labels and title kept; the cards stay where they were.
  now = now.map((a) => (a.id === "c2" ? { ...a, workspaceId: "w2" } : a));
  const plan = planKeys(now, ws, first.state);
  const by = Object.fromEntries(plan.changes.map((c) => [c.id, [c.title, c.labels]]));
  assert.deepEqual(by, {
    c2: ["ECO-2: geoexpert-msk.ru", { "kanban.key": "ECO-2", "kanban.prev-key": "AGM-2" }],
    k1: ["ECO-2-1: Картинки", { "kanban.key": "ECO-2-1", "kanban.prev-key": "AGM-2-1" }],
    k2: ["ECO-2-2: Архивная", { "kanban.key": "ECO-2-2", "kanban.prev-key": "AGM-2-2" }],
    n1: ["ECO-2-2-1: Вложенный", { "kanban.key": "ECO-2-2-1", "kanban.prev-key": "AGM-2-2-1" }],
  });
  assert.deepEqual(plan.state.prefixes, { w2: "ECO", w1: "AGM" });
  now = apply(now, plan.changes);
  assert.deepEqual(planKeys(now, ws, plan.state).changes, []);
  // A new card of the moved chat continues its numbers; AGM-2 is never handed out again.
  now.push(card("k3", "c2", "Новая"), chat("c3", "Три"));
  const after = planKeys(now, ws, plan.state);
  assert.deepEqual(after.changes.map((c) => c.title), ["ECO-2-3: Новая", "AGM-3: Три"]);
});

test("moved there and back: the next free number again, not the old one; a failed write does not renumber twice", () => {
  const agents = [chat("c1", "Чат"), card("k1", "c1", "Карточка"), chat("e1", "Эко", { workspaceId: "w2" })];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  let now = apply(agents, first.changes).map((a) => (a.id === "c1" ? { ...a, workspaceId: "w2" } : a));
  const there = planKeys(now, ws, first.state);
  // The writes failed: the labels still say AGM-1, the state remembers ECO-2.
  const again = planKeys(now, ws, there.state);
  assert.deepEqual(again.changes.map((c) => c.key), ["ECO-2", "ECO-2-1"]);
  now = apply(now, there.changes).map((a) => (a.id === "c1" ? { ...a, workspaceId: "w1" } : a));
  const back = planKeys(now, ws, there.state);
  const by = Object.fromEntries(back.changes.map((c) => [c.id, [c.title, c.labels]]));
  assert.deepEqual(by, {
    c1: ["AGM-2: Чат", { "kanban.key": "AGM-2", "kanban.prev-key": "AGM-1;ECO-2" }],
    k1: ["AGM-2-1: Карточка", { "kanban.key": "AGM-2-1", "kanban.prev-key": "AGM-1-1;ECO-2-1" }],
  });
  assert.deepEqual(planKeys(apply(now, back.changes), ws, back.state).changes, []);
});

test("moved to a new workspace without a prefix: it gets its own, not the one the chat brought", () => {
  const wss = [...ws, { id: "w9", name: "Ремонт" }];
  const agents = [chat("c1", "Кухня"), card("k1", "c1", "Плитка")];
  const first = planKeys(agents, wss, EMPTY_KEYS);
  const now = apply(agents, first.changes).map((a) => (a.id === "c1" ? { ...a, workspaceId: "w9" } : a));
  // The state file was lost too: the prefix of w1 is learned from c1's card-less neighbours only.
  for (const state of [first.state, EMPTY_KEYS]) {
    const plan = planKeys([...now, chat("c2", "AGM-2: Другой", { labels: { "kanban.key": "AGM-2" } })], wss, state);
    assert.equal(plan.state.prefixes.w9, "REM");
    const c1 = plan.changes.find((c) => c.id === "c1")!;
    assert.equal(c1.title, "REM-1: Кухня");
    assert.equal(plan.changes.find((c) => c.id === "k1")!.title, "REM-1-1: Плитка");
    assert.equal(plan.state.last.AGM, 2);
  }
});

test("a card detached for a moment during a move keeps its card key", () => {
  const agents = [chat("c1", "Чат"), card("k1", "c1", "Карточка")];
  const first = planKeys(agents, ws, EMPTY_KEYS);
  // The chat moved to ЭкоЭксперт, its card in agmazin lost the parent label until Dialogs give it back.
  let now = apply(agents, first.changes).map((a) => (a.id === "c1" ? { ...a, workspaceId: "w2" } : a));
  const mid = planKeys(now.map((a) => (a.id === "k1" ? { ...a, parentAgentId: null } : a)), ws, first.state);
  assert.deepEqual(mid.changes.map((c) => [c.id, c.key]), [["c1", "ECO-1"]]);
  now = apply(now, mid.changes);
  const back = planKeys(now, ws, mid.state);
  assert.deepEqual(back.changes.map((c) => [c.id, c.title]), [["k1", "ECO-1-1: Карточка"]]);
});
