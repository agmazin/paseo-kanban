// Dry run of the numbering against a daemon: what planKeys would write, nothing is written.
// node --experimental-strip-types tests/keys-dry-run.mts [paseo home] [out.md]
import { readFile, writeFile } from "node:fs/promises";
import { createRequire, register } from "node:module";
register("./resolve-ts.mjs", import.meta.url);
const { planKeys, EMPTY_KEYS } = await import("../shared/keys.ts");
const { parentOf } = await import("../shared/model.ts");
const require = createRequire("/Users/agmazin/Library/Developer/paseo-kanban/package.json");
const { DaemonClient } = await import(require.resolve("@getpaseo/client/internal/daemon-client"));
const home = process.argv[2] || "/Users/agmazin/.paseo";
const out = process.argv[3] || new URL("../docs/keys-dry-run.md", import.meta.url).pathname;
const pid = JSON.parse(await readFile(`${home}/paseo.pid`, "utf8"));
const c = new DaemonClient({ url: `ws://${pid.listen}/ws`, clientId: "kanban-keys-dry-run", clientType: "cli", localCredential: async () => (await readFile(`${home}/local-credential`, "utf8")).trim(), reconnect: { enabled: false } });
await c.connect();
let cursor: string | undefined;
const agents: any[] = [];
do {
  const r = await c.fetchAgents({ filter: { includeArchived: true }, page: { limit: 200, cursor } });
  agents.push(...r.entries.map((e: any) => e.agent));
  cursor = r.pageInfo.nextCursor ?? undefined;
} while (cursor);
const workspaces = (await c.fetchWorkspaces({ page: { limit: 200 } })).entries.map((w: any) => ({ id: w.id, name: w.name, title: w.title }));
await c.close();
let saved = EMPTY_KEYS;
try {
  saved = { ...EMPTY_KEYS, ...JSON.parse(await readFile(`${home}/plugin-data/paseo-kanban/state.json`, "utf8")).keys };
} catch {}
const { state, changes } = planKeys(agents, workspaces, saved);
const byId = new Map(agents.map((a) => [a.id, a]));
const keyOf = (id: string) => changes.find((x) => x.id === id)?.key ?? byId.get(id)?.labels?.["kanban.key"] ?? "";
const nat = (k: string) => k.split(/-/).map((p) => (/^\d+$/.test(p) ? p.padStart(5, "0") : p)).join("-");
const rows = [...changes].sort((x, y) => nat(x.key).localeCompare(nat(y.key)));
const wsName = Object.fromEntries(workspaces.map((w: any) => [w.id, w.name || w.title]));
const cell = (s: string | null | undefined) => (s ?? "").replace(/\|/g, "\\|");
const lines = [
  "# Сухой прогон номеров чатов и карточек",
  "",
  `Демон: \`${home}\`, снято ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC. Ничего не записано.`,
  "",
  `Агентов всего ${agents.length}, изменений ${changes.length}. Префиксы: ${Object.entries(state.prefixes).map(([id, p]) => `${wsName[id] ?? id} - ${p}`).join(", ")}.`,
  "",
  "Порядок записи - от давно изменённых к недавним: переименование сдвигает дату изменения, так порядок в Диалогах и на доске сохраняется.",
  "",
  "| Номер | Старое название | Новое название | Метки | Чат | Архив |",
  "|---|---|---|---|---|---|",
  ...rows.map((x) => {
    const a = byId.get(x.id);
    const parent = parentOf(a);
    return `| ${x.key} | ${cell(x.oldTitle)} | ${cell(x.title ?? "(без изменений)")} | ${Object.entries(x.labels).map(([k, v]) => `${k}=${v}`).join(", ")} | ${parent ? cell(keyOf(parent)) : "чат"} | ${a.archivedAt ? "да" : ""} |`;
  }),
  "",
];
await writeFile(out, lines.join("\n"));
console.log(out, changes.length);
