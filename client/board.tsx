import { useEffect, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useRpc, useWorkspace, type PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { useQuery } from "@tanstack/react-query";
import { lastReply } from "../shared/contracts";
import {
  CHAT_ORDER,
  GROUPS,
  SORTS,
  STATUS,
  columns,
  parentOf,
  sortCards,
  subgroupField,
  subgroups,
  type Card,
  type Column,
  type Prefs,
} from "../shared/model";
import { useCards, usePrefs } from "./data";
import { CardView, Dot, GroupHeader, MenuBox, MenuItem, T, ToolButton, palette, type Palette } from "./ui";
import { fadeStyle, installScrollbarStyle, observeSelectedAgent } from "./web";

type Open = (card: Card) => void;

function DetailedCard(props: {
  card: Card;
  inChat: boolean;
  showStatus: boolean;
  details: boolean;
  hostId: string;
  onPress(): void;
  p: Palette;
}) {
  const read = useRpc(lastReply);
  const reply = useQuery({
    queryKey: ["kanban-reply", props.hostId, props.card.id, props.card.updated],
    queryFn: () => read({ agentId: props.card.id }),
    enabled: props.details,
    staleTime: 5 * 60_000,
  });
  return <CardView {...props} details={props.details ? reply.data?.text || null : null} />;
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
      details={prefs.details}
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
            const key = `${col.key}|${g.value}`;
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

export function Board({ workspaceId, theme, host, navigation }: PluginWorkspacePanelProps) {
  const p = palette(theme);
  const ws = useWorkspace(workspaceId, (w) => ({ name: w.name, title: w.title }));
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
          {ws?.title || ws?.name || "Канбан"}
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
export function ChatBoard({ workspaceId, theme, host, navigation }: PluginWorkspacePanelProps) {
  const p = palette(theme);
  const { cards, agents, loading } = useCards(host.id);
  const { prefs, update } = usePrefs(host.id);
  const toggle = useToggle(prefs, update);
  const [focused, setFocused] = useState<string | null>(null);
  useEffect(() => observeSelectedAgent(setFocused), []);
  const self = focused ? agents.find((a) => a.id === focused && a.workspaceId === workspaceId) : undefined;
  // No agent tab selected yet: the most recently active chat of this workspace that has cards.
  const fallback = useMemo(
    () =>
      cards
        .filter((c) => c.workspaceId === workspaceId && c.owner && !c.owner.archived)
        .sort((a, b) => b.updated.localeCompare(a.updated))[0]?.owner?.id ?? null,
    [cards, workspaceId],
  );
  const chatId = (self && (parentOf(self) || self.id)) || fallback;
  const chat = agents.find((a) => a.id === chatId);
  const mine = chatId ? cards.filter((c) => c.owner?.id === chatId) : [];
  const live = mine.filter((c) => !c.archived);
  const arch = mine.filter((c) => c.archived);
  const open: Open = (c) => navigation?.openAgent({ agentId: c.id });
  const card = (c: Card) => (
    <DetailedCard key={c.id} card={c} inChat showStatus={false} details={prefs.details} hostId={host.id} onPress={() => open(c)} p={p} />
  );
  return (
    <ScrollView testID="kanban-chat" style={{ flex: 1 }} contentContainerStyle={{ padding: 14 }}>
      <T color={p.fg3} size={12} style={{ paddingHorizontal: 2, paddingBottom: 4 }}>
        {chat ? `Чат ${chat.title || "без названия"}` : "Выберите вкладку чата"}
      </T>
      {CHAT_ORDER.map((col) => {
        const list = sortCards(
          live.filter((c) => c.col === col),
          prefs,
        );
        const key = `p|${col}`;
        const isOpen = !prefs.toggled[key];
        return (
          <View key={col}>
            <GroupHeader label={STATUS[col]} count={list.length} open={isOpen} col={col} onPress={() => toggle(key)} p={p} />
            {isOpen ? list.map(card) : null}
          </View>
        );
      })}
      {!loading && chat && mine.length === 0 ? (
        <T color={p.fg3} size={12} lines={3} style={{ paddingHorizontal: 2, paddingTop: 8 }}>
          Карточки появятся, когда агент чата заведёт исполнителя под задачу.
        </T>
      ) : null}
      {arch.length > 0 && !prefs.hideArch ? (
        <View>
          <GroupHeader label="Архив" count={arch.length} open={!!prefs.toggled["p|arch"]} archive onPress={() => toggle("p|arch")} p={p} />
          {prefs.toggled["p|arch"] ? sortCards(arch, prefs).map(card) : null}
        </View>
      ) : null}
    </ScrollView>
  );
}

