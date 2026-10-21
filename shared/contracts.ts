import { defineRpc } from "@getpaseo/plugin";
import { z } from "zod";

export const prefsSchema = z.object({
  group: z.enum(["status", "chat", "exec", "prov", "date"]),
  sort: z.enum(["u", "c", "t", "status", "chat", "exec"]),
  order: z.enum(["asc", "desc"]),
  hideArch: z.boolean(),
  details: z.boolean(),
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
