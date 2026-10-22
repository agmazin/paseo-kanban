import type { PluginServerContext } from "@getpaseo/plugin/server";
import type { PaseoApi } from "@getpaseo/client";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { accept, lastReply, prefsSchema, readCards, readPrefs, sanitizePrefs, savePrefs, sendBack } from "../shared/contracts";
import { ACCEPTED, cardsOf, clearedOnTurn, DEFAULT_PREFS, LABEL, NEUTRAL, parentOf, providerOf, type AgentLike, type Prefs } from "../shared/model";

const home = process.env.PASEO_HOME || join(homedir(), ".paseo");
const directory = join(home, "plugin-data", "paseo-kanban");
const path = join(directory, "state.json");
const run = promisify(execFile);

// Alexander's Mac has the CLI from Homebrew; the ЭкоЭксперт portal (Linux container) sets PASEO_BIN or has it in PATH.
const MAC_BIN = "/opt/homebrew/bin/paseo";
const bin = process.env.PASEO_BIN || (existsSync(MAC_BIN) ? MAC_BIN : "paseo");

async function setMark(agentId: string, value: string) {
  await run(bin, ["agent", "update", agentId, "--label", `${LABEL}=${value}`, "--json", "--home", home], {
    timeout: 10_000,
  });
}

async function subagent(paseo: PaseoApi, agentId: string) {
  const result = await paseo.agents.ref(agentId).refresh();
  if (!result || !parentOf(result.agent)) throw new Error("Это не карточка канбана");
  return result.agent;
}

async function listAgents(paseo: PaseoApi, includeArchived: boolean) {
  let cursor: string | undefined;
  const all: AgentLike[] = [];
  do {
    const r = await paseo.agents.list({ filter: { includeArchived }, page: { limit: 200, cursor } });
    all.push(...r.entries.map((e) => e.agent));
    cursor = r.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

export function acceptedNote(agentId: string, title?: string | null) {
  const name = title?.trim() || "Без названия";
  return (
    `Александр принял карточку "${name}" (${agentId}). Реши, что из этого следует (выкатка, внедрение, следующая карточка, ` +
    `обновление доков), сделай и проверь. Когда всё доделано или делать нечего - поставь карточке метку done: ` +
    `paseo agent update ${agentId} --label ${LABEL}=done`
  );
}

// "Принять" is not the end: the owner chat does what follows (rollout, docs, next card) and sets done itself.
// Without a live owner chat the note goes to the executor.
export async function acceptCard(paseo: PaseoApi, agentId: string, mark = setMark) {
  const agent = await subagent(paseo, agentId);
  if (agent.status === "running") throw new Error("Исполнитель ещё работает");
  await mark(agentId, ACCEPTED);
  const parentId = parentOf(agent);
  const parent = parentId ? (await paseo.agents.ref(parentId).refresh().catch(() => null))?.agent : null;
  const to = parent && !parent.archivedAt ? parent.id : agentId;
  await paseo.agents.ref(to).send(acceptedNote(agentId, agent.title));
  return to;
}

export function register(server: PluginServerContext) {
  let prefs: Prefs = { ...DEFAULT_PREFS };
  let queue = Promise.resolve();
  const ready = (async () => {
    try {
      const saved = JSON.parse(await readFile(path, "utf8"));
      prefs = sanitizePrefs(saved.prefs, DEFAULT_PREFS);
    } catch (e) {
      if ((e as { code?: string }).code !== "ENOENT") console.error("Канбан: не удалось прочитать настройки вида");
    }
  })();
  const persist = () => {
    const snapshot = JSON.stringify({ prefs }, null, 2);
    queue = queue
      .then(async () => {
        await mkdir(directory, { recursive: true, mode: 0o700 });
        const tmp = `${path}.${randomUUID()}.tmp`;
        await writeFile(tmp, snapshot, { mode: 0o600 });
        await rename(tmp, path);
      })
      .catch(() => console.error("Канбан: не удалось сохранить настройки вида"));
    return queue;
  };

  server.handle(readPrefs, async () => {
    await ready;
    return prefs;
  });
  server.handle(savePrefs, async (patch) => {
    await ready;
    prefs = prefsSchema.parse({ ...prefs, ...patch });
    await persist();
    return prefs;
  });
  server.handle(accept, async ({ agentId }, { paseo }) => {
    await acceptCard(paseo, agentId);
    console.log("Канбан: карточка принята, доделывает чат");
    return {};
  });
  server.handle(sendBack, async ({ agentId, text }, { paseo }) => {
    await subagent(paseo, agentId);
    await setMark(agentId, NEUTRAL);
    await paseo.agents.ref(agentId).send(text);
    console.log("Канбан: карточка возвращена в работу");
    return {};
  });
  server.handle(readCards, async ({ archived }, { paseo }) => {
    const agents = await listAgents(paseo, archived);
    const chats = agents
      .filter((a) => !parentOf(a) && !a.archivedAt && a.workspaceId)
      .map((a) => ({ id: a.id, title: a.title?.trim() || "Без названия", provider: providerOf(a.provider), workspaceId: a.workspaceId as string }));
    return { cards: cardsOf(agents), chats };
  });
  server.handle(lastReply, async ({ agentId }, { paseo }) => {
    const page = await paseo.agents.ref(agentId).timeline.refetch({ direction: "tail", limit: 40 });
    for (let i = page.entries.length - 1; i >= 0; i--) {
      const item = page.entries[i].item;
      if (item.type === "assistant_message" && item.text.trim()) return { text: item.text.trim().slice(0, 600) };
    }
    return { text: "" };
  });

  // A new turn returns a marked card to work; the runtime state then drives the column.
  const offStarted = server.on("agent.turn_started", async ({ agent }, { paseo }) => {
    if (!agent.parentAgentId) return;
    try {
      const fresh = await paseo.agents.ref(agent.id).refresh();
      const mark = fresh?.agent.labels?.[LABEL];
      if (clearedOnTurn(mark)) await setMark(agent.id, NEUTRAL);
    } catch {
      console.error("Канбан: не удалось снять отметку карточки");
    }
  });
  console.log("Канбан: сервер запущен");
  return async () => {
    offStarted();
    await queue;
  };
}
