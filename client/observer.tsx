import { useState } from "react";
import { Platform, Pressable, TextInput, View } from "react-native";
import type {
  PluginButtonBehavior,
  PluginButtonContentProps,
  PluginButtonIconProps,
  PluginButtonRegistration,
  PluginClientContext,
} from "@getpaseo/plugin/client";
import { accept, readCards, sendBack } from "../shared/contracts";
import { STATUS, type Card, type Col } from "../shared/model";
import { onAgentEvents } from "./data";
import { overlayFor } from "./overlay";
import { palette, T } from "./ui";
import { isCompactWeb, isWorkspaceRouteOpen, keepExplorerKanban } from "./web";

const CHAT_PANEL = "chat";
type Chat = { id: string; title: string; provider: string; workspaceId: string };
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

type FormText = { hint: string; placeholder: string; button: string; action: string };
const RETURN: FormText = { hint: "Что поправить - уйдёт исполнителю сообщением", placeholder: "Замечания", button: "Вернуть", action: "Вернуть в работу" };

function returnForm(client: PluginClientContext, agentId: string, copy: FormText = RETURN) {
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
          {copy.hint}
        </T>
        <TextInput
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder={copy.placeholder}
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
          accessibilityLabel={copy.action}
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
            {busy ? "Отправляю" : copy.button}
          </T>
        </Pressable>
      </View>
    );
  };
}

// Composer pills, header buttons and auto-open from the daemon-built card list
// (a few KB), refreshed on agent events Paseo already receives.
export function observe(client: PluginClientContext) {
  const lifetime = new AbortController();
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

  // Phones have no explorer tabs and no plugin header buttons: every chat gets a "Канбан" pill instead.
  const mobile = Platform.OS !== "web" || isCompactWeb();
  // Phones: the chat kanban opens as a window over the chat (pill popover), not as a tab.
  const chatBehavior = (workspaceId: string, chatId: string): PluginButtonBehavior =>
    mobile
      ? { kind: "popover", Content: overlayFor(client, workspaceId, chatId) }
      : { kind: "action", onPress: () => client.openPanel(CHAT_PANEL, { workspaceId, location: "explorer" }) };

  const setPills = (id: string, sig: string, make: () => PluginButtonRegistration[]) => {
    const old = pills.get(id);
    if (old?.sig === sig) return;
    old?.regs.forEach((r) => r.remove());
    pills.set(id, { sig, regs: make() });
  };

  const chatPill = (chat: Chat) =>
    setPills(chat.id, "chat", () => [
      client.addComposerPill({
        id: "kanban",
        workspaceId: chat.workspaceId,
        agentId: chat.id,
        button: { title: "Канбан чата", icon: "SquareKanban", label: "Канбан", behavior: chatBehavior(chat.workspaceId, chat.id) },
      }),
    ]);

  const cardPills = (card: Card) => {
    const parentId = card.owner?.id;
    if (!parentId) return;
    const canAccept = card.col === "acc";
    setPills(card.id, `${card.col}|${canAccept}`, () => {
      const regs = [
        client.addComposerPill({
          id: "status",
          workspaceId: card.workspaceId,
          agentId: card.id,
          button: { title: "Канбан чата", icon: DOTS[card.col], label: STATUS[card.col], behavior: chatBehavior(card.workspaceId, parentId) },
        }),
      ];
      if (canAccept)
        regs.push(
          client.addComposerPill({
            id: "accept",
            workspaceId: card.workspaceId,
            agentId: card.id,
            button: {
              title: "Принять работу",
              icon: "Check",
              label: "Принять",
              behavior: { kind: "action", onPress: async () => void (await client.rpc(accept, { agentId: card.id })) },
            },
          }),
          client.addComposerPill({
            id: "return",
            workspaceId: card.workspaceId,
            agentId: card.id,
            button: {
              title: "Вернуть в работу с замечаниями",
              icon: "Undo2",
              label: "Вернуть",
              behavior: { kind: "popover", Content: returnForm(client, card.id) },
            },
          }),
        );
      return regs;
    });
  };

  // The chat kanban opens by itself when a chat starts its first executor while on screen.
  const autoOpen = (card: Card) => {
    const parentId = card.owner?.id;
    if (mobile || !primed || known.has(card.id) || !parentId || card.archived) return;
    if (Date.now() - new Date(card.created).getTime() > 120_000 || opened.has(parentId)) return;
    if (!isWorkspaceRouteOpen(card.workspaceId)) return;
    opened.add(parentId);
    client.openPanel(CHAT_PANEL, { workspaceId: card.workspaceId, location: "explorer" });
  };

  let loading = false;
  let again = false;
  const refresh = async () => {
    if (loading) return void (again = true);
    loading = true;
    try {
      const { cards, chats } = await client.rpc(readCards, { archived: false });
      if (lifetime.signal.aborted) return;
      const live = new Set<string>();
      for (const card of cards) {
        autoOpen(card);
        known.add(card.id);
        if (card.archived) continue;
        live.add(card.id);
        header(card.workspaceId);
        cardPills(card);
      }
      for (const chat of chats) {
        header(chat.workspaceId);
        if (!mobile) continue;
        live.add(chat.id);
        chatPill(chat);
      }
      for (const [id, entry] of pills)
        if (!live.has(id)) {
          entry.regs.forEach((r) => r.remove());
          pills.delete(id);
        }
      primed = true;
    } catch {
      if (!lifetime.signal.aborted) console.error("Канбан: не удалось обновить карточки");
    } finally {
      loading = false;
      if (again && !lifetime.signal.aborted) {
        again = false;
        void refresh();
      }
    }
  };

  void refresh();
  // The plugin's single agent subscription (live agents, first page only): its events reach
  // every Kanban listener through paseo.agents.subscribe, panels do not open their own.
  void client.paseo.agents
    .list({ filter: { includeArchived: false }, page: { limit: 1 }, subscribe: {}, signal: lifetime.signal })
    .catch(() => {
      if (!lifetime.signal.aborted) console.error("Канбан: подписка на агентов не запустилась");
    });
  const offEvents = onAgentEvents(client.paseo, () => void refresh());
  const timer = setInterval(() => void refresh(), 60_000);
  void client.paseo.workspaces
    .list({ page: { limit: 200 } })
    .then((r) => {
      if (lifetime.signal.aborted) return;
      for (const w of r.entries) if (!w.archivingAt && !w.background) header(w.id);
    })
    .catch(() => {});

  const stopExplorer = mobile
    ? () => {}
    : keepExplorerKanban((workspaceId) => client.openPanel(CHAT_PANEL, { workspaceId, location: "explorer" }));

  return () => {
    stopExplorer();
    offEvents();
    clearInterval(timer);
    lifetime.abort();
    for (const { regs } of pills.values()) regs.forEach((r) => r.remove());
    pills.clear();
    for (const r of headers.values()) r.remove();
    headers.clear();
  };
}
