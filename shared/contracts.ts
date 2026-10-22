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
  chatSort: z.enum(["u", "c", "t"]),
  chatOrder: z.enum(["asc", "desc"]),
  toggled: z.record(z.string(), z.boolean()),
});

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

const cardSchema = z.object({
  id: z.string(),
  workspaceId: z.string(),
  title: z.string(),
  col: z.enum(["q", "run", "need", "acc", "done"]),
  archived: z.boolean(),
  provider: z.string(),
  executor: z.string(),
  created: z.string(),
  updated: z.string(),
  owner: z.object({ id: z.string(), title: z.string(), provider: z.string(), archived: z.boolean() }).nullable(),
  asks: z.boolean(),
});
const chatSchema = z.object({ id: z.string(), title: z.string(), provider: z.string(), workspaceId: z.string() });

// Cards are built on the daemon machine: the phone gets a few KB instead of every agent snapshot.
export const readCards = defineRpc({
  name: "kanban.cards",
  input: z.object({ archived: z.boolean() }),
  output: z.object({ cards: z.array(cardSchema), chats: z.array(chatSchema) }),
});
