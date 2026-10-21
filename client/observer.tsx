import { useState } from "react";
import { Pressable, TextInput, View } from "react-native";
import type {
  PluginButtonContentProps,
  PluginButtonIconProps,
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import type { PaseoAgent } from "@getpaseo/client";
import { accept, sendBack } from "../shared/contracts";
import { columnOf, parentOf, STATUS, type Col } from "../shared/model";
import { allAgents } from "./data";
import { palette, T } from "./ui";
import { isWorkspaceRouteOpen } from "./web";

const CHAT_PANEL = "chat";
const BOARD_PANEL = "board";

function dotIcon(col: Col) {
  return function StatusDot({ theme, size }: PluginButtonIconProps) {
    const d = Math.max(7, Math.round(size * 0.55));
    return (
      <View style={{ width: size, height: size, alignItems: "center", justifyContent: "center" }}>
        <View style={{ width: d, height: d, borderRadius: d / 2, backgroundColor: palette(theme).dots[col] }} />
      </View>
    );
  };
}
const DOTS = Object.fromEntries((["q", "run", "need", "acc", "done"] as Col[]).map((c) => [c, dotIcon(c)])) as Record<
  Col,
  ReturnType<typeof dotIcon>
>;

function returnForm(client: PluginClientContext, agentId: string) {
  return function ReturnForm({ theme, close }: PluginButtonContentProps) {
    const p = palette(theme);
    const [text, setText] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");
    const submit = async () => {
      if (!text.trim() || busy) return;
      setBusy(true);
      setError("");
      try {
        await client.rpc(sendBack, { agentId, text: text.trim() });
        close();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Не отправилось");
        setBusy(false);
      }
    };
    return (
      <View style={{ width: 340, padding: 4, gap: 10 }}>
        <T color={p.fg2} size={12.5}>
          Что поправить - уйдёт исполнителю сообщением
        </T>
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Замечания"
          placeholderTextColor={p.fg3}
          style={{
            minHeight: 72,
            color: p.fg,
            fontSize: 13.5,
            borderWidth: 1,
            borderColor: p.menuLine,
            borderRadius: 9,
            padding: 9,
            backgroundColor: p.bg,
          }}
        />
        {error ? (
          <T color={theme.colors.statusDanger} size={12} lines={3}>
            {error}
          </T>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Вернуть в работу"
          disabled={!text.trim() || busy}
          onPress={submit}
          style={{
            alignSelf: "flex-end",
            paddingHorizontal: 14,
            paddingVertical: 7,
            borderRadius: 9,
            backgroundColor: text.trim() && !busy ? theme.colors.accent : p.button,
          }}
        >
          <T color={text.trim() && !busy ? theme.colors.accentForeground : p.fg3} size={13.5}>
            {busy ? "Отправляю" : "Вернуть"}
          </T>
        </Pressable>
      </View>
    );
  };
}

// One owned agent observation drives composer pills, header buttons and auto-open.
export function observe(client: PluginClientContext) {
  const lifetime = new AbortController();
  const agents = new Map<string, PaseoAgent>();
  const pills = new Map<string, { sig: string; regs: PluginButtonRegistration[] }>();
  const headers = new Map<string, PluginButtonRegistration>();
  const known = new Set<string>();
  const opened = new Set<string>();
  let primed = false;

  const header = (workspaceId: string) => {
    if (headers.has(workspaceId)) return;
    headers.set(
      workspaceId,
      client.addHeaderButton({
        id: "board",
        workspaceId,
        button: {
          title: "Открыть канбан пространства",
          icon: "SquareKanban",
          label: "Канбан",
          behavior: { kind: "action", onPress: () => client.openPanel(BOARD_PANEL, { workspaceId }) },
        },
      }),
    );
  };

  const syncPills = (a: PaseoAgent) => {
    const parentId = parentOf(a);
    const old = pills.get(a.id);
    if (!parentId || a.archivedAt || !a.workspaceId) {
      old?.regs.forEach((r) => r.remove());
      pills.delete(a.id);
      return;
    }
    const col = columnOf(a, agents.get(parentId));
    const canAccept = col === "acc";
    const sig = `${col}|${canAccept}`;
    if (old?.sig === sig) return;
    old?.regs.forEach((r) => r.remove());
    const workspaceId = a.workspaceId;
    const regs = [
      client.addComposerPill({
        id: "status",
        workspaceId,
        agentId: a.id,
        button: {
          title: "Канбан чата",
          icon: DOTS[col],
          label: STATUS[col],
          behavior: {
            kind: "action",
            onPress: () => client.openPanel(CHAT_PANEL, { workspaceId, agentId: parentId, location: "explorer" }),
          },
        },
      }),
    ];
    if (canAccept)
      regs.push(
        client.addComposerPill({
          id: "accept",
          workspaceId,
          agentId: a.id,
          button: {
            title: "Принять работу",
            icon: "Check",
            label: "Принять",
            behavior: { kind: "action", onPress: async () => void (await client.rpc(accept, { agentId: a.id })) },
          },
        }),
        client.addComposerPill({
          id: "return",
          workspaceId,
          agentId: a.id,
          button: {
            title: "Вернуть в работу с замечаниями",
            icon: "Undo2",
            label: "Вернуть",
            behavior: { kind: "popover", Content: returnForm(client, a.id) },
          },
        }),
      );
    pills.set(a.id, { sig, regs });
  };

  // The chat kanban opens by itself when a chat starts its first executor while on screen.
  const autoOpen = (a: PaseoAgent) => {
    const parentId = parentOf(a);
    if (!primed || known.has(a.id) || !parentId || a.archivedAt || !a.workspaceId) return;
    if (Date.now() - new Date(a.createdAt).getTime() > 120_000 || opened.has(parentId)) return;
    if (!isWorkspaceRouteOpen(a.workspaceId)) return;
    opened.add(parentId);
    client.openPanel(CHAT_PANEL, { workspaceId: a.workspaceId, agentId: parentId, location: "explorer" });
  };

  const upsert = (a: PaseoAgent) => {
    autoOpen(a);
    known.add(a.id);
    agents.set(a.id, a);
    if (a.workspaceId && !a.archivedAt) header(a.workspaceId);
    syncPills(a);
    // A parent turn changes its executors' column (checking vs awaiting acceptance).
    for (const child of agents.values()) if (parentOf(child) === a.id) syncPills(child);
  };

  const reload = async () => {
    const list = await allAgents(client.paseo);
    if (lifetime.signal.aborted) return;
    for (const a of list) upsert(a);
    primed = true;
  };

  void reload().catch(() => {});
  void client.paseo.agents
    .list({ filter: { includeArchived: true }, page: { limit: 1 }, subscribe: {}, signal: lifetime.signal })
    .then(({ subscription }) => {
      subscription.subscribe({
        snapshot: () => void reload().catch(() => {}),
        update: (message) => {
          if (message.type !== "agent_update") return;
          const update = message.payload;
          if (update.kind === "upsert") return upsert(update.agent);
          agents.delete(update.agentId);
          pills.get(update.agentId)?.regs.forEach((r) => r.remove());
          pills.delete(update.agentId);
        },
      });
      return undefined;
    })
    .catch(() => {
      if (!lifetime.signal.aborted) console.error("Канбан: наблюдение за агентами не запустилось");
    });
  void client.paseo.workspaces
    .list({ page: { limit: 200 } })
    .then((r) => {
      if (lifetime.signal.aborted) return;
      for (const w of r.entries) if (!w.archivingAt && !w.background) header(w.id);
    })
    .catch(() => {});

  return () => {
    lifetime.abort();
    for (const { regs } of pills.values()) regs.forEach((r) => r.remove());
    pills.clear();
    for (const r of headers.values()) r.remove();
    headers.clear();
  };
}
