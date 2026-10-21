import type { PluginServerContext } from "@getpaseo/plugin/server";
import type { PaseoApi } from "@getpaseo/client";
import { readFile, mkdir, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { join } from "node:path";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { randomUUID } from "node:crypto";
import { accept, lastReply, prefsSchema, readPrefs, savePrefs, sendBack } from "../shared/contracts";
import { DEFAULT_PREFS, LABEL, MARKS, NEUTRAL, parentOf, type Prefs } from "../shared/model";

const home = process.env.PASEO_HOME || join(homedir(), ".paseo");
const directory = join(home, "plugin-data", "paseo-kanban");
const path = join(directory, "state.json");
const run = promisify(execFile);

async function setMark(agentId: string, value: string) {
  await run("/opt/homebrew/bin/paseo", ["agent", "update", agentId, "--label", `${LABEL}=${value}`, "--json", "--home", home], {
    timeout: 10_000,
  });
}

async function subagent(paseo: PaseoApi, agentId: string) {
  const result = await paseo.agents.ref(agentId).refresh();
  if (!result || !parentOf(result.agent)) throw new Error("Это не карточка канбана");
  return result.agent;
}

export function register(server: PluginServerContext) {
  let prefs: Prefs = { ...DEFAULT_PREFS };
  let queue = Promise.resolve();
  const ready = (async () => {
    try {
      const saved = JSON.parse(await readFile(path, "utf8"));
      prefs = prefsSchema.parse({ ...DEFAULT_PREFS, ...saved.prefs });
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
    const agent = await subagent(paseo, agentId);
    if (agent.status === "running") throw new Error("Исполнитель ещё работает");
    await setMark(agentId, "done");
    console.log("Канбан: карточка принята");
    return {};
  });
  server.handle(sendBack, async ({ agentId, text }, { paseo }) => {
    await subagent(paseo, agentId);
    await setMark(agentId, NEUTRAL);
    await paseo.agents.ref(agentId).send(text);
    console.log("Канбан: карточка возвращена в работу");
    return {};
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
      if (mark && (MARKS as readonly string[]).includes(mark)) await setMark(agent.id, NEUTRAL);
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
