import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const prefsSchema = z.object({
  group: z.enum(["status", "chat", "exec", "prov", "date"]),
  sort: z.enum(["u", "c", "t", "status", "chat", "exec"]),
  order: z.enum(["asc", "desc"]),
  hideArch: z.boolean(),
  details: z.boolean(),
  buttons: z.boolean(),
  executor: z.boolean(),
  chatSort: z.enum(["stage", "u", "c"]),
  chatOrder: z.enum(["asc", "desc"]),
  toggled: z.record(z.string(), z.boolean()),
});

// Saved prefs from an older version keep every valid field; a retired value (the "Название" sort) falls back to its default.
export function sanitizePrefs(raw: unknown, defaults: z.output<typeof prefsSchema>) {
  const saved = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const shape = prefsSchema.shape as Record<string, z.ZodTypeAny>;
  const out: Record<string, unknown> = { ...defaults };
  for (const key of Object.keys(shape)) if (key in saved && shape[key].safeParse(saved[key]).success) out[key] = saved[key];
  return prefsSchema.parse(out);
}

export const readPrefs = defineRpc({
  name: "kanban.prefs",
  input: z.object({}),
  output: prefsSchema,
});

export const savePrefs = defineRpc({
  name: "kanban.save-prefs",
  input: prefsSchema.partial(),
  output: prefsSchema,
});

export const accept = defineRpc({
  name: "kanban.accept",
  input: z.object({ agentId: z.string().min(1) }),
  output: z.object({}),
});

export const sendBack = defineRpc({
  name: "kanban.return",
  input: z.object({ agentId: z.string().min(1), text: z.string().trim().min(1).max(20_000) }),
  output: z.object({}),
});

export const lastReply = defineRpc({
  name: "kanban.last-reply",
  input: z.object({ agentId: z.string().min(1) }),
  output: z.object({ text: z.string() }),
});

export const prioritySchema = z.enum(["high", "normal", "low"]);
export const setPriority = defineRpc({
  name: "kanban.set-priority",
  input: z.object({ agentId: z.string().min(1), priority: prioritySchema }),
  output: z.object({}),
});

const cardSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  key: z.string().nullable(),
  title: z.string(),
  priority: prioritySchema,
  col: z.enum(["q", "run", "need", "acc", "done"]),
  archived: z.boolean(),
  provider: z.string(),
  executor: z.string(),
  created: z.string(),
  updated: z.string(),
  owner: z.object({ id: z.string(), title: z.string(), provider: z.string(), priority: prioritySchema, archived: z.boolean() }).nullable(),
  asks: z.boolean(),
  waitingFor: z.enum(["alexander", "techlead"]).nullable(),
  waitReason: z.enum(["permission", "ask", "review", "error", "provider-unavailable", "unmarked-stop"]).nullable(),
  accepted: z.boolean(),
});
const chatSchema = z.object({ id: z.string(), title: z.string(), provider: z.string(), workspaceId: z.string(), priority: prioritySchema });

// Cards are built on the daemon machine: the phone gets a few KB instead of every agent snapshot.
export const readCards = defineRpc({
  name: "kanban.cards",
  input: z.object({ archived: z.boolean() }),
  output: z.object({ cards: z.array(cardSchema), chats: z.array(chatSchema) }),
});
