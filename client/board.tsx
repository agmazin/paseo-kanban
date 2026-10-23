import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, TextInput, View } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import { usePaseo, useRpc, useWorkspace, type PluginAgentPanelProps, type PluginScreenProps, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { lastBoardWorkspace, rememberWorkspace } from "./focus";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { accept, lastReply, sendBack, setPriority } from "../shared/contracts";
import {
  GROUPS,
  PRIORITIES,
  type Priority,
  PANEL_SORTS,
  SORTS,
  STATUS,
  columns,
  panelOrder,
  parentOf,
  sortCards,
  subgroupField,
  subgroups,
  type Card,
  type Column,
  type Prefs,
} from "../shared/model";
import { useCards, usePrefs } from "./data";
import { Button, CardView, Dot, GroupHeader, MenuBox, MenuItem, T, ToolButton, palette, type Palette, type Theme } from "./ui";
import { fadeStyle, installScrollbarStyle, observeSelectedAgent } from "./web";

type Open = (card: Card) => void;

function DetailedCard({
  prefs,
  ...props
}: {
  card: Card;
  inChat: boolean;
  showStatus: boolean;
  prefs: Prefs;
  hostId: string;
  onPress(): void;
  p: Palette;
}) {
  const read = useRpc(lastReply);
  const reply = useQuery({
    queryKey: ["kanban-reply", props.hostId, props.card.id, props.card.updated],
    queryFn: () => read({ agentId: props.card.id }),
    enabled: prefs.details,
    staleTime: 5 * 60_000,
  });
  const actions = prefs.buttons && (props.card.col === "acc" || props.card.accepted) && !props.card.archived;
  return (
    <CardView
      {...props}
      details={prefs.details ? reply.data?.text || null : null}
      executor={prefs.executor}
      priorityControl={<PriorityControl compact agentId={props.card.id} priority={props.card.priority} hostId={props.hostId} p={props.p} />}
      actions={actions ? <AcceptActions card={props.card} hostId={props.hostId} p={props.p} /> : null}
    />
  );
}

function PriorityControl({ agentId, priority, hostId, p, compact = false }: { compact?: boolean; agentId: string; priority: Priority; hostId: string; p: Palette }) {
  const save = useRpc(setPriority);
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const choose = async (value: Priority) => {
    setBusy(true);
    setError("");
    try {
      await save({ agentId, priority: value });
      await qc.invalidateQueries({ queryKey: ["kanban-cards", hostId] });
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  };
  const color = priority === "high" ? (p.dark ? "#df7773" : "#c94f49") : priority === "low" ? (p.dark ? "#79b3db" : "#438fc4") : p.fg3;
  return (
    <View style={{ zIndex: open ? 50 : 1 }}>
      <Pressable testID={`kanban-priority-${agentId}`} accessibilityRole="button" accessibilityLabel={`Приоритет: ${PRIORITIES.find(([v]) => v === priority)?.[1] ?? "Обычный"}`} onPress={() => setOpen(!open)} style={{ width: compact ? 20 : 28, height: compact ? 16 : 28, alignItems: "center", justifyContent: "center" }}>
        <Icon name={priority === "normal" ? "Ellipsis" : "Flag"} color={color} size={compact ? 14 : 17} />
      </Pressable>
      {open ? <MenuBox p={p} style={{ position: "relative", top: 0, right: 0, width: 175 }}>
        <T color={p.fg2} size={12} style={{ padding: 8 }}>Приоритет</T>
        {PRIORITIES.map(([value, label]) => <MenuItem key={value} label={label} selected={priority === value} onPress={() => { if (!busy) void choose(value); }} p={p} />)}
        {error ? <T color={p.danger} size={12} lines={3}>{error}</T> : null}
      </MenuBox> : null}
    </View>
  );
}

// "Принять" hands the card back to its chat to finish what follows (the chat sets done);
// "Вернуть" opens a field whose text goes to the executor. An accepted card keeps only "Вернуть".
function AcceptActions({ card, hostId, p }: { card: Card; hostId: string; p: Palette }) {
  const qc = useQueryClient();
  const doAccept = useRpc(accept);
  const doReturn = useRpc(sendBack);
  const [mode, setMode] = useState<"idle" | "return">("idle");
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError("");
    try {
      await fn();
      setMode("idle");
      setText("");
      await qc.invalidateQueries({ queryKey: ["kanban-cards", hostId] });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Не получилось");
    } finally {
      setBusy(false);
    }
  };
  if (mode === "return")
    return (
      <View style={{ gap: 7 }}>
        <TextInput
          testID="kanban-return-input"
          autoFocus
          multiline
          value={text}
          onChangeText={setText}
          placeholder="Что поправить - уйдёт исполнителю"
          placeholderTextColor={p.fg3}
          style={{ minHeight: 60, color: p.fg, fontSize: 13, borderWidth: 1, borderColor: p.menuLine, borderRadius: 8, padding: 8, backgroundColor: p.bg }}
        />
        {error ? (
          <T color={p.danger} size={12} lines={3}>
            {error}
          </T>
        ) : null}
        <View style={{ flexDirection: "row", gap: 6 }}>
          <Button label="Отмена" disabled={busy} onPress={() => (setMode("idle"), setError(""))} p={p} />
          <Button
            testID="kanban-return-send"
            label={busy ? "Отправляю" : "Отправить"}
            icon="Send"
            primary
            disabled={busy || !text.trim()}
            onPress={() => run(() => doReturn({ agentId: card.id, text: text.trim() }))}
            p={p}
          />
        </View>
      </View>
    );
  return (
    <View style={{ gap: 6 }}>
      {error ? (
        <T color={p.danger} size={12} lines={3}>
          {error}
        </T>
      ) : null}
      <View style={{ flexDirection: "row", gap: 6 }}>
        {card.accepted ? null : (
          <Button
            testID="kanban-accept"
            label={busy ? "Принимаю" : "Принять"}
            icon="Check"
            primary
            disabled={busy}
            onPress={() => run(() => doAccept({ agentId: card.id }))}
            p={p}
          />
        )}
        <Button testID="kanban-return" label="Вернуть" icon="Undo2" disabled={busy} onPress={() => setMode("return")} p={p} />
      </View>
    </View>
  );
}

function useToggle(prefs: Prefs, update: (patch: Partial<Prefs>) => void) {
  return (key: string) => update({ toggled: { ...prefs.toggled, [key]: !prefs.toggled[key] } });
}

function ColumnBody({
  col,
  prefs,
  toggle,
  open,
  hostId,
  p,
}: {
  col: Column;
  prefs: Prefs;
  toggle(key: string): void;
  open: Open;
  hostId: string;
  p: Palette;
}) {
  const card = (c: Card, sub: string | null) => (
    <DetailedCard
      key={c.id}
      card={c}
      inChat={false}
      showStatus={prefs.group !== "status" && sub !== "status"}
      prefs={prefs}
      hostId={hostId}
      onPress={() => open(c)}
      p={p}
    />
  );
  if (col.archivedChats)
    return (
      <>
        {col.archivedChats.map((g) => {
          const key = `ac|${g.value}`;
          const isOpen = !!prefs.toggled[key];
          return (
            <View key={key}>
              <GroupHeader label={g.label} count={g.cards.length} open={isOpen} archive onPress={() => toggle(key)} p={p} />
              {isOpen ? g.cards.map((c) => card(c, "chat")) : null}
            </View>
          );
        })}
      </>
    );
  const sub = subgroupField(prefs);
  const archKey = `arch|${col.key}`;
  const archOpen = !!prefs.toggled[archKey];
  return (
    <>
      {sub
        ? subgroups(col.cards, sub, prefs).map((g) => {
            const key = `${col.key}|${g.key}`;
            const isOpen = !prefs.toggled[key];
            return (
              <View key={key}>
                <GroupHeader
                  label={g.label}
                  count={g.cards.length}
                  open={isOpen}
                  col={sub === "status" ? (g.value as Card["col"]) : null}
                  onPress={() => toggle(key)}
                  p={p}
                />
                {isOpen ? g.cards.map((c) => card(c, sub)) : null}
              </View>
            );
          })
        : sortCards(col.cards, prefs).map((c) => card(c, null))}
      {col.archived.length ? (
        <View>
          <GroupHeader
            testID={`kanban-archive-${col.key}`}
            label="Архив"
            count={col.archived.length}
            open={archOpen}
            archive
            onPress={() => toggle(archKey)}
            p={p}
          />
          {archOpen ? sortCards(col.archived, prefs).map((c) => card(c, null)) : null}
        </View>
      ) : null}
    </>
  );
}

// TickTick draws an empty column as a faint block fading towards the bottom.
const SLICES = 20;
function EmptyColumn({ p }: { p: Palette }) {
  const tint = p.dark ? "255,255,255" : "0,0,0";
  const top = p.dark ? 0.018 : 0.03;
  const web = fadeStyle(tint, top);
  if (web) return <View testID="kanban-col-empty" style={{ flex: 1, minHeight: 160, borderRadius: 8, ...web }} />;
  return (
    <View testID="kanban-col-empty" style={{ flex: 1, minHeight: 160, borderRadius: 8, overflow: "hidden" }}>
      {Array.from({ length: SLICES }, (_, i) => (
        <View key={i} style={{ flex: 1, backgroundColor: `rgba(${tint},${(top * (1 - i / SLICES)).toFixed(4)})` }} />
      ))}
    </View>
  );
}

type Menu = null | "sort" | "groupBy" | "sortBy" | "order" | "view";

function Menus({ menu, setMenu, prefs, update, p }: { menu: Menu; setMenu(m: Menu): void; prefs: Prefs; update(patch: Partial<Prefs>): void; p: Palette }) {
  if (!menu) return null;
  if (menu === "view")
    return (
      <MenuBox p={p} style={{ top: 50, right: 22, minWidth: 260 }}>
        <T color={p.fg3} size={12.5} style={{ paddingTop: 6, paddingBottom: 4, paddingHorizontal: 10 }}>
          Вид
        </T>
        <MenuItem icon="Archive" label="Скрыть архивные" checked={prefs.hideArch} onPress={() => update({ hideArch: !prefs.hideArch })} p={p} />
        <MenuItem icon="AlignLeft" label="Показать детали" checked={prefs.details} onPress={() => update({ details: !prefs.details })} p={p} />
        <MenuItem icon="UserRound" label="Показывать ответственного" checked={prefs.executor} onPress={() => update({ executor: !prefs.executor })} p={p} />
        <MenuItem icon="SquareCheck" label="Кнопки приёмки" checked={prefs.buttons} onPress={() => update({ buttons: !prefs.buttons })} p={p} />
      </MenuBox>
    );
  const name = <K extends string>(list: readonly [K, string][], key: K) => list.find(([k]) => k === key)?.[1] ?? "";
  const items: [Menu, string, string, string][] = [
    ["groupBy", "Rows3", "Группировать по", name(GROUPS, prefs.group)],
    ["sortBy", "ArrowDownWideNarrow", "Сортировать по", name(SORTS, prefs.sort)],
    ["order", "ArrowUpDown", "Порядок", prefs.order === "asc" ? "По возрастанию" : "По убыванию"],
  ];
  const index = items.findIndex(([m]) => m === menu);
  const list = (entries: readonly [string, string][], current: string, pick: (key: string) => void) => (
    <MenuBox p={p} style={{ top: 50 + 6 + (index + 1) * 38 + 4, right: 62, minWidth: 240 }}>
      {entries.map(([k, n]) => (
        <MenuItem key={k} label={n} selected={current === k} onPress={() => pick(k)} p={p} />
      ))}
    </MenuBox>
  );
  return (
    <>
      <MenuBox p={p} style={{ top: 50, right: 62, minWidth: 340 }}>
        {items.map(([m, icon, label, value]) => (
          <MenuItem key={label} icon={icon} label={label} value={value} highlighted={menu === m} onPress={() => setMenu(menu === m ? "sort" : m)} p={p} />
        ))}
      </MenuBox>
      {menu === "groupBy" ? list(GROUPS, prefs.group, (k) => (update({ group: k as Prefs["group"] }), setMenu(null))) : null}
      {menu === "sortBy" ? list(SORTS, prefs.sort, (k) => (update({ sort: k as Prefs["sort"] }), setMenu(null))) : null}
      {menu === "order"
        ? list(
            [
              ["asc", "По возрастанию"],
              ["desc", "По убыванию"],
            ],
            prefs.order,
            (k) => (update({ order: k as Prefs["order"] }), setMenu(null)),
          )
        : null}
    </>
  );
}

type Nav = PluginWorkspacePanelProps["navigation"];
type ViewProps = { workspaceId: string; theme: Theme; host: { id: string }; navigation?: Nav };

export function Board(props: PluginWorkspacePanelProps) {
  const ws = useWorkspace(props.workspaceId, (w) => ({ name: w.name, title: w.title }));
  useEffect(() => rememberWorkspace(props.workspaceId), [props.workspaceId]);
  return <BoardView {...props} title={ws?.title || ws?.name || "Канбан"} />;
}

// Left menu entry: the workspace board as a screen with workspace chips (reachable on phones too).
export function BoardScreen({ theme, host, navigation, params }: PluginScreenProps) {
  const p = palette(theme);
  const paseo = usePaseo();
  const list = useQuery({
    queryKey: ["kanban-workspaces", host.id],
    queryFn: async () => (await paseo.workspaces.list({ page: { limit: 200 } })).entries.filter((w) => !w.archivingAt && !w.background),
    staleTime: 30_000,
  });
  const workspaces = list.data ?? [];
  const [picked, setPicked] = useState<string | null>(params.workspaceId || lastBoardWorkspace());
  const workspaceId = workspaces.some((w) => w.id === picked) ? picked : (workspaces[0]?.id ?? null);
  return (
    <View style={{ flex: 1, backgroundColor: p.bg }}>
      <ScrollView horizontal style={{ flexGrow: 0 }} contentContainerStyle={{ gap: 8, paddingHorizontal: 22, paddingTop: 14 }}>
        {workspaces.map((w) => (
          <Pressable
            key={w.id}
            accessibilityRole="button"
            accessibilityLabel={`Канбан ${w.title || w.name}`}
            onPress={() => (setPicked(w.id), rememberWorkspace(w.id))}
            style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 999, backgroundColor: w.id === workspaceId ? p.button : "transparent" }}
          >
            <T color={w.id === workspaceId ? p.fg : p.fg2} size={13.5}>
              {w.title || w.name}
            </T>
          </Pressable>
        ))}
      </ScrollView>
      {workspaceId ? (
        <BoardView
          workspaceId={workspaceId}
          title={workspaces.find((w) => w.id === workspaceId)?.title || workspaces.find((w) => w.id === workspaceId)?.name || "Канбан"}
          theme={theme}
          host={host}
          navigation={navigation}
        />
      ) : null}
    </View>
  );
}

function BoardView({ workspaceId, title, theme, host, navigation }: ViewProps & { title: string }) {
  const p = palette(theme);
  const { cards } = useCards(host.id);
  const { prefs, update } = usePrefs(host.id);
  const toggle = useToggle(prefs, update);
  const [menu, setMenu] = useState<Menu>(null);
  useEffect(() => installScrollbarStyle(), []);
  const cols = useMemo(() => columns(cards.filter((c) => c.workspaceId === workspaceId), prefs), [cards, prefs, workspaceId]);
  const open: Open = (c) => navigation?.openAgent({ agentId: c.id });
  return (
    <View testID="kanban-board" style={{ flex: 1, backgroundColor: p.bg, paddingTop: 16, paddingLeft: 22 }}>
      <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 10, paddingRight: 22 }}>
        <T color={p.fg} size={18} weight="600" style={{ flexShrink: 1 }}>
          {title}
        </T>
        <View style={{ flex: 1 }} />
        <ToolButton
          testID="kanban-sort-button"
          icon="ArrowUpDown"
          label="Группировка и сортировка"
          active={!!menu && menu !== "view"}
          onPress={() => setMenu(menu && menu !== "view" ? null : "sort")}
          p={p}
        />
        <ToolButton testID="kanban-view-button" icon="Ellipsis" label="Вид" active={menu === "view"} onPress={() => setMenu(menu === "view" ? null : "view")} p={p} />
      </View>
          <ScrollView
            testID="kanban-cols"
            horizontal
            style={{ flex: 1 }}
            contentContainerStyle={{ gap: 16, paddingRight: 22, minHeight: "100%" }}
          >
            {cols.map((col) => (
              <View key={col.key} testID={`kanban-col-${col.key}`} style={{ width: 282, flexShrink: 0 }}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8, paddingTop: 4, paddingBottom: 8, paddingHorizontal: 2 }}>
                  {col.status ? <Dot col={col.status} p={p} /> : null}
                  <T color={p.fg} size={14.5} weight="600" style={{ flexShrink: 1 }}>
                    {col.name}
                  </T>
                  <T color={p.fg3} size={12.5}>
                    {col.archivedChats ? col.archivedChats.reduce((n, g) => n + g.cards.length, 0) : col.cards.length}
                  </T>
                </View>
                <ScrollView
                  testID="kanban-col-scroll"
                  style={{ flex: 1 }}
                  contentContainerStyle={{ paddingRight: 4, paddingBottom: 16, flexGrow: 1 }}
                >
                  <ColumnBody col={col} prefs={prefs} toggle={toggle} open={open} hostId={host.id} p={p} />
                  {!col.archivedChats && col.cards.length === 0 ? <EmptyColumn p={p} /> : null}
                </ScrollView>
              </View>
            ))}
          </ScrollView>
      {menu ? (
        <Pressable
          accessibilityLabel="Закрыть меню"
          onPress={() => setMenu(null)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
        />
      ) : null}
      <Menus menu={menu} setMenu={setMenu} prefs={prefs} update={update} p={p} />
    </View>
  );
}

// Workspace-level explorer panel (listed in the explorer "+" menu); shows the chat of the selected tab.
export function ChatBoard(props: PluginWorkspacePanelProps) {
  return <ChatView {...props} />;
}

// Mobile: the explorer has fixed tabs in Paseo 0.12, so the chat kanban opens as a tab for a known chat.
export function ChatBoardTab({ agentId, workspaceId, theme, host, navigation }: PluginAgentPanelProps) {
  return <ChatView workspaceId={workspaceId} theme={theme} host={host} navigation={navigation} fixedAgentId={agentId} />;
}

export function ChatView({
  workspaceId,
  theme,
  host,
  navigation,
  fixedAgentId,
  onOpenCard,
  sheet = false,
}: ViewProps & { fixedAgentId?: string; onOpenCard?: (card: Card) => void; sheet?: boolean }) {
  const p = palette(theme);
  const { cards, chats, loading } = useCards(host.id);
  const { prefs, update } = usePrefs(host.id);
  const toggle = useToggle(prefs, update);
  const [menu, setMenu] = useState<null | "main" | "sort">(null);
  const [focused, setFocused] = useState<string | null>(null);
  useEffect(() => (fixedAgentId ? undefined : observeSelectedAgent(setFocused)), [fixedAgentId]);
  const selected = fixedAgentId ?? focused;
  // A selected executor shows its chat; a selected chat shows itself, archived chats included.
  const selectedCard = selected ? cards.find((c) => c.id === selected && c.workspaceId === workspaceId) : undefined;
  const selectedChat = selected ? chats.find((c) => c.id === selected && c.workspaceId === workspaceId) : undefined;
  const selectedOwner = selected && cards.some((c) => c.owner?.id === selected && c.workspaceId === workspaceId) ? selected : null;
  // No agent tab selected yet: the most recently active chat of this workspace that has cards.
  const fallback = useMemo(
    () =>
      cards
        .filter((c) => c.workspaceId === workspaceId && c.owner && !c.owner.archived)
        .sort((a, b) => b.updated.localeCompare(a.updated))[0]?.owner?.id ?? null,
    [cards, workspaceId],
  );
  const chatId = selectedCard?.owner?.id ?? selectedChat?.id ?? selectedOwner ?? fallback;
  const chat = chats.find((c) => c.id === chatId) ?? cards.find((c) => c.owner?.id === chatId)?.owner ?? null;
  const mine = chatId ? cards.filter((c) => c.owner?.id === chatId) : [];
  const live = mine.filter((c) => !c.archived);
  const arch = mine.filter((c) => c.archived);
  const open: Open = (c) => (onOpenCard ? onOpenCard(c) : navigation?.openAgent({ agentId: c.id }));
  const { groups, sort: order } = panelOrder(prefs);
  const card = (c: Card) => (
    <DetailedCard key={c.id} card={c} inChat showStatus={false} prefs={prefs} hostId={host.id} onPress={() => open(c)} p={p} />
  );
  const more = (
    <ToolButton testID="kanban-chat-menu" icon="Ellipsis" label="Настройки панели" active={!!menu} onPress={() => setMenu(menu ? null : "main")} p={p} />
  );
  // On the phone the host sheet scrolls by itself (it is capped at 80% of the screen and adds its own title):
  // a second scroller inside could not bring the last cards above the sheet's bottom edge.
  const Body = sheet ? View : ScrollView;
  const bodyProps = sheet
    ? { style: { paddingBottom: 6 } }
    : { style: { flex: 1 }, contentContainerStyle: { paddingHorizontal: 14, paddingBottom: 14 } };
  return (
    <View style={sheet ? undefined : { flex: 1 }}>
      {sheet ? (
        <View style={{ flexDirection: "row", justifyContent: "flex-end", zIndex: 10 }}>{chat ? <PriorityControl agentId={chat.id} priority={chat.priority} hostId={host.id} p={p} /> : null}{more}</View>
      ) : (
        <View style={{ flexDirection: "row", alignItems: "center", paddingLeft: 16, paddingRight: 10, paddingTop: 8 }}>
          <T color={p.fg3} size={12} style={{ flexShrink: 1 }}>
            {chat ? `Чат ${chat.title || "без названия"}` : "Выберите вкладку чата"}
          </T>
          <View style={{ flex: 1 }} />
          {chat ? <PriorityControl agentId={chat.id} priority={chat.priority} hostId={host.id} p={p} /> : null}
          {more}
        </View>
      )}
      <Body testID="kanban-chat" {...bodyProps}>
        {groups.map((col) => {
          const list = sortCards(
            live.filter((c) => c.col === col),
            order,
          );
          const key = `p|${col}`;
          const isOpen = !prefs.toggled[key];
          return (
            <View key={col}>
              <GroupHeader label={STATUS[col]} count={list.length} open={isOpen} col={col} dense={sheet} onPress={() => toggle(key)} p={p} />
              {isOpen ? list.map(card) : null}
            </View>
          );
        })}
        {!loading && chat && mine.length === 0 ? (
          <T color={p.fg3} size={12} lines={3} style={{ paddingHorizontal: 2, paddingTop: 8 }}>
            Карточки появятся, когда агент чата заведёт исполнителя под задачу.
          </T>
        ) : null}
        {/* The chat panel always shows every card of the chat; "hide archived" is a board setting. */}
        {arch.length > 0 ? (
          <View>
            <GroupHeader label="Архив" count={arch.length} open={!!prefs.toggled["p|arch"]} archive onPress={() => toggle("p|arch")} p={p} />
            {prefs.toggled["p|arch"] ? sortCards(arch, order).map(card) : null}
          </View>
        ) : null}
      </Body>
      {menu ? (
        <Pressable
          accessibilityLabel="Закрыть меню"
          onPress={() => setMenu(null)}
          style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, zIndex: 20 }}
        />
      ) : null}
      {menu === "main" ? (
        <MenuBox p={p} style={{ top: sheet ? 30 : 40, right: sheet ? 0 : 10, minWidth: 270 }}>
          <MenuItem icon="SquareCheck" label="Кнопки приёмки" checked={prefs.buttons} onPress={() => update({ buttons: !prefs.buttons })} p={p} />
          <MenuItem icon="AlignLeft" label="Показать детали" checked={prefs.details} onPress={() => update({ details: !prefs.details })} p={p} />
          <MenuItem icon="UserRound" label="Показывать ответственного" checked={prefs.executor} onPress={() => update({ executor: !prefs.executor })} p={p} />
          <View style={{ height: 1, backgroundColor: p.menuLine, marginVertical: 5, marginHorizontal: 4 }} />
          <MenuItem
            icon="ArrowDownWideNarrow"
            label="Сортировка"
            value={PANEL_SORTS.find(([k]) => k === prefs.chatSort)?.[1]}
            onPress={() => setMenu("sort")}
            p={p}
          />
        </MenuBox>
      ) : null}
      {menu === "sort" ? (
        <MenuBox p={p} style={{ top: sheet ? 30 : 40, right: sheet ? 0 : 10, minWidth: 270 }}>
          <MenuItem icon="ChevronLeft" label="Сортировка" onPress={() => setMenu("main")} p={p} />
          <View style={{ height: 1, backgroundColor: p.menuLine, marginVertical: 5, marginHorizontal: 4 }} />
          {PANEL_SORTS.map(([k, n]) => (
            <MenuItem key={k} label={n} selected={prefs.chatSort === k} onPress={() => update({ chatSort: k })} p={p} />
          ))}
          <View style={{ height: 1, backgroundColor: p.menuLine, marginVertical: 5, marginHorizontal: 4 }} />
          <MenuItem label="По возрастанию" selected={prefs.chatOrder === "asc"} onPress={() => update({ chatOrder: "asc" })} p={p} />
          <MenuItem label="По убыванию" selected={prefs.chatOrder === "desc"} onPress={() => update({ chatOrder: "desc" })} p={p} />
        </MenuBox>
      ) : null}
    </View>
  );
}
