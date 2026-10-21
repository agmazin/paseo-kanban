import { useState, type ReactNode } from "react";
import { Image, Pressable, Text, View, type TextStyle } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { providerSvg } from "./web";
import { providerIcons } from "./icons";
import { shortDate, STATUS, type Card, type Col } from "../shared/model";

export type Theme = PluginWorkspacePanelProps["theme"];
const font = "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, system-ui, sans-serif";

function blend(fg: string, bg: string, amount: number) {
  const hex = (c: string) => (/^#[\da-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  const a = hex(fg),
    b = hex(bg);
  return a && b
    ? `#${a.map((v, i) => Math.round(v * amount + b[i] * (1 - amount)).toString(16).padStart(2, "0")).join("")}`
    : fg;
}

// Every surface comes from the host theme: Paseo's dark grays are slightly green,
// neutral mockup grays read as dirty red next to native chrome.
export function palette(theme: Theme) {
  const c = theme.colors;
  const dark = parseInt(c.surface0.slice(1, 3), 16) < 128;
  const bg = c.surface0;
  const menu = c.surface2;
  return {
    dark,
    bg,
    card: c.surface1,
    cardHover: c.surface2,
    cardLine: blend(c.foreground, c.surface1, dark ? 0.045 : 0.08),
    line: c.border,
    fg: c.foreground,
    fg2: c.foregroundMuted,
    fg3: blend(c.foregroundMuted, bg, 0.62),
    group: blend(c.foreground, bg, 0.85),
    own: blend(c.foreground, bg, 0.78),
    ownLogo: blend(c.foreground, bg, 0.8),
    exeLogo: blend(c.foregroundMuted, bg, 0.75),
    corner: blend(c.foregroundMuted, bg, 0.4),
    menu,
    menuLine: blend(c.foreground, menu, 0.06),
    menuHover: blend(c.foreground, menu, 0.05),
    button: c.surface2,
    selected: c.foreground,
    askBg: dark ? "rgba(247,121,109,0.16)" : "rgba(241,46,47,0.10)",
    askFg: dark ? "#f4a59c" : "#c2412f",
    dots: {
      q: blend(c.foregroundMuted, bg, 0.45),
      run: dark ? "#5caaf6" : "#268ae0",
      need: dark ? "#f7796d" : "#f12e2f",
      acc: dark ? "#db932e" : "#b37824",
      done: dark ? "#35c264" : "#299f51",
    } as Record<Col, string>,
  };
}
export type Palette = ReturnType<typeof palette>;

export function T({
  children,
  color,
  size = 13.5,
  weight = "400",
  lines = 1,
  style,
}: {
  children: ReactNode;
  color: string;
  size?: number;
  weight?: TextStyle["fontWeight"];
  lines?: number;
  style?: TextStyle;
}) {
  return (
    <Text
      numberOfLines={lines}
      style={{ fontFamily: font, color, fontSize: size, lineHeight: Math.round(size * 1.35), fontWeight: weight, ...style }}
    >
      {children}
    </Text>
  );
}

export function Logo({ provider, size, color }: { provider: string; size: number; color: string }) {
  return (
    <View style={{ width: size, height: size, flexShrink: 0 }}>
      {providerSvg(provider, size, color) ??
        (providerIcons[provider] ? (
          <Image source={{ uri: providerIcons[provider] }} style={{ width: size, height: size, tintColor: color }} />
        ) : (
          <Icon name="Bot" size={size} color={color} />
        ))}
    </View>
  );
}

export function Dot({ col, p }: { col: Col; p: Palette }) {
  return <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: p.dots[col], flexShrink: 0 }} />;
}

export function Chevron({ open, p }: { open: boolean; p: Palette }) {
  return (
    <View style={{ width: 15, height: 15, transform: [{ rotate: open ? "90deg" : "0deg" }] }}>
      <Icon name="ChevronRight" size={15} color={p.fg3} />
    </View>
  );
}

export function GroupHeader({
  label,
  count,
  open,
  col,
  archive,
  dense,
  onPress,
  p,
  testID,
}: {
  label: string;
  count: number;
  open: boolean;
  col?: Col | null;
  archive?: boolean;
  dense?: boolean;
  onPress(): void;
  p: Palette;
  testID?: string;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={`${label}, ${count}, ${open ? "свернуть" : "развернуть"}`}
      onPress={onPress}
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: dense ? 4 : 7, paddingBottom: dense ? 4 : 6, paddingHorizontal: 2 }}
    >
      <Chevron open={open} p={p} />
      {col ? <Dot col={col} p={p} /> : null}
      <T color={archive ? p.fg3 : p.group} size={12.5} weight="600" style={{ flexShrink: 1 }}>
        {label}
      </T>
      <T color={p.fg3} size={12.5}>
        {count}
      </T>
    </Pressable>
  );
}

export function CardView({
  card,
  inChat,
  showStatus,
  details,
  onPress,
  p,
}: {
  card: Card;
  inChat: boolean;
  showStatus: boolean;
  details?: string | null;
  onPress(): void;
  p: Palette;
}) {
  const [hover, setHover] = useState(false);
  const faded = card.col === "done" || card.archived;
  return (
    <Pressable
      testID={`kanban-card-${card.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${card.title}. ${STATUS[card.col]}. Открыть диалог исполнителя`}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        backgroundColor: hover ? p.cardHover : p.card,
        borderWidth: 1,
        borderColor: p.cardLine,
        borderRadius: 9,
        paddingTop: 8,
        paddingBottom: 9,
        paddingHorizontal: 11,
        marginBottom: 6,
      }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3 }}>
        <T color={p.fg3} size={11.5}>
          {shortDate(card.updated)}
        </T>
        {showStatus ? (
          <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5 }}>
            <Dot col={card.col} p={p} />
            <T color={p.fg3} size={11.5}>
              {STATUS[card.col]}
            </T>
          </View>
        ) : null}
      </View>
      <T color={faded ? p.fg3 : p.fg} size={13.5} lines={4}>
        {card.title}
      </T>
      {card.asks ? (
        <View
          testID="kanban-ask-tag"
          style={{ alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: p.askBg }}
        >
          <T color={p.askFg} size={11.5} weight="500">
            Вопрос к тебе
          </T>
        </View>
      ) : null}
      {details ? (
        <T color={p.fg2} size={12} lines={4} style={{ marginTop: 5 }}>
          {details}
        </T>
      ) : null}
      {!inChat && card.owner ? (
        <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 7 }}>
          <Logo provider={card.owner.provider} size={14} color={p.ownLogo} />
          <T color={faded ? p.fg3 : p.own} size={12.5} weight="500" style={{ flexShrink: 1 }}>
            {card.owner.title}
          </T>
        </View>
      ) : null}
      <View style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
        <Icon name="CornerDownRight" size={13} color={p.corner} />
        <Logo provider={card.provider} size={12} color={p.exeLogo} />
        <T color={p.fg3} size={11.5} style={{ flexShrink: 1 }}>
          {card.executor}
        </T>
      </View>
    </Pressable>
  );
}

export function ToolButton({
  icon,
  label,
  active,
  onPress,
  p,
  testID,
}: {
  icon: string;
  label: string;
  active: boolean;
  onPress(): void;
  p: Palette;
  testID?: string;
}) {
  const [hover, setHover] = useState(false);
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        width: 30,
        height: 30,
        borderRadius: 8,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: active || hover ? p.button : "transparent",
      }}
    >
      <Icon name={icon} size={17} color={active || hover ? p.fg : p.fg2} />
    </Pressable>
  );
}

export function MenuItem({
  icon,
  label,
  value,
  checked,
  selected,
  highlighted,
  onPress,
  p,
}: {
  icon?: string;
  label: string;
  value?: string;
  checked?: boolean;
  selected?: boolean;
  highlighted?: boolean;
  onPress(): void;
  p: Palette;
}) {
  const [hover, setHover] = useState(false);
  const color = selected ? p.selected : p.fg;
  return (
    <Pressable
      accessibilityRole="menuitem"
      accessibilityLabel={value ? `${label}: ${value}` : label}
      accessibilityState={{ checked: checked || selected }}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flexDirection: "row",
        alignItems: "center",
        gap: 12,
        height: 38,
        paddingHorizontal: 10,
        borderRadius: 8,
        backgroundColor: hover || highlighted ? p.menuHover : "transparent",
      }}
    >
      {icon ? <Icon name={icon} size={17} color={p.fg2} /> : null}
      <T color={color} size={14}>
        {label}
      </T>
      {value ? (
        <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 4 }}>
          <T color={p.fg2} size={13}>
            {value}
          </T>
          <Icon name="ChevronRight" size={13} color={p.fg2} />
        </View>
      ) : null}
      {checked || selected ? (
        <View style={{ marginLeft: value ? 0 : "auto" }}>
          <Icon name="Check" size={16} color={p.selected} />
        </View>
      ) : null}
    </Pressable>
  );
}

export function MenuBox({ children, p, style }: { children: ReactNode; p: Palette; style: object }) {
  return (
    <View
      style={{
        position: "absolute",
        zIndex: 30,
        backgroundColor: p.menu,
        borderWidth: 1,
        borderColor: p.menuLine,
        borderRadius: 12,
        padding: 6,
        shadowColor: "#000",
        shadowOpacity: 0.55,
        shadowRadius: 20,
        shadowOffset: { width: 0, height: 16 },
        ...style,
      }}
    >
      {children}
    </View>
  );
}
