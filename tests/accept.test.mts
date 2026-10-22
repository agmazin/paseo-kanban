import test from "node:test";
import assert from "node:assert/strict";
import { register } from "node:module";
import { columnOf, cardsOf, clearedOnTurn, columns, DEFAULT_PREFS } from "../shared/model.ts";

register("./resolve-ts.mjs", import.meta.url);
const { acceptCard, acceptedNote } = await import("../server/runtime.ts");

const base = { provider: "claude", status: "idle", createdAt: "2026-10-21T10:00:00Z", workspaceId: "w1" };
const chat = { ...base, id: "chat", title: "Тендер" };
const sub = (extra: object = {}) => ({ ...base, id: "a", title: "Макет виджета", parentAgentId: "chat", ...extra });

function fakePaseo(agents: Record<string, object>) {
  const sent: [string, string][] = [];
  const paseo = {
    agents: {
      ref: (id: string) => ({
        refresh: async () => (agents[id] ? { agent: agents[id] } : null),
        send: async (text: string) => void sent.push([id, text]),
      }),
    },
  };
  return { paseo: paseo as never, sent };
}

test("accepted card stays in work with its tag until the chat sets done", () => {
  const accepted = sub({ labels: { kanban: "accepted" } });
  assert.equal(columnOf(accepted, chat), "run");
  assert.equal(columnOf(accepted, { ...chat, status: "running" }), "run");
  assert.equal(columnOf({ ...accepted, archivedAt: "x" }, chat), "run");
  assert.equal(columnOf(sub({ labels: { kanban: "done" } }), chat), "done");
  const [card] = cardsOf([chat, accepted]);
  assert.equal(card.accepted, true);
  assert.deepEqual(columns([card], DEFAULT_PREFS)[1].cards.map((c) => c.id), ["a"]);
  assert.equal(columns([card], DEFAULT_PREFS)[3].cards.length, 0);
  assert.equal(cardsOf([chat, sub()])[0].accepted, false);
});

test("a new executor turn keeps accepted, clears the other marks", () => {
  assert.equal(clearedOnTurn("accepted"), false);
  for (const m of ["queue", "review", "done", "ask"]) assert.equal(clearedOnTurn(m), true);
  assert.equal(clearedOnTurn("work"), false);
  assert.equal(clearedOnTurn(undefined), false);
});

test("Принять marks the card accepted and tells the owner chat", async () => {
  const { paseo, sent } = fakePaseo({ a: sub(), chat });
  const marks: [string, string][] = [];
  const to = await acceptCard(paseo, "a", async (id, v) => void marks.push([id, v]));
  assert.equal(to, "chat");
  assert.deepEqual(marks, [["a", "accepted"]]);
  assert.equal(sent.length, 1);
  assert.equal(sent[0][0], "chat");
  assert.match(sent[0][1], /^Александр принял карточку "Макет виджета" \(a\)\./);
  assert.match(sent[0][1], /paseo agent update a --label kanban=done$/);
  assert.equal(sent[0][1], acceptedNote("a", "Макет виджета"));
});

test("Принять without a live owner chat tells the executor; running executor is refused", async () => {
  const lone = fakePaseo({ a: sub({ parentAgentId: null, labels: { "paseo.parent-agent-id": "gone" } }) });
  assert.equal(await acceptCard(lone.paseo, "a", async () => {}), "a");
  const archived = fakePaseo({ a: sub(), chat: { ...chat, archivedAt: "x" } });
  assert.equal(await acceptCard(archived.paseo, "a", async () => {}), "a");
  const busy = fakePaseo({ a: sub({ status: "running" }), chat });
  const marks: string[] = [];
  await assert.rejects(acceptCard(busy.paseo, "a", async (_id, v) => void marks.push(v)), /ещё работает/);
  assert.deepEqual(marks, []);
  assert.equal(busy.sent.length, 0);
});
