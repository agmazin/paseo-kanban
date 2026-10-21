import { useState, type ReactNode } from "react";
import { Image, Pressable, Text, View, type TextStyle } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { providerSvg } from "./web";
import { providerIcons } from "./icons";
import { shortDate, STATUS, type Card, type Col } from "../shared/model";

export type Theme = PluginWorkspacePanelProps["theme"];
const font = "-apple-system, BlinkMacSystemFont, SF Pro Text, Segoe UI, system-ui, sans-serif";

// Dark values are measured from the approved mockup; light themes use host tokens.
export function palette(theme: Theme) {
  const c = theme.colors;
  const dark = parseInt(c.surface0.slice(1, 3), 16) < 128;
  return {
    dark,
    bg: dark ? "#1b1b1b" : c.surface0,
    card: dark ? "#232323" : c.surface1,
    cardHover: dark ? "#272727" : c.surface2,
    cardLine: dark ? "#2d2d2d" : c.border,
    line: dark ? "#2a2a2a" : c.border,
    fg: c.foreground,
    fg2: dark ? "#a6a6a6" : c.foregroundMuted,
    fg3: dark ? "#6f6f6f" : c.foregroundMuted,
    group: dark ? "#d0d0d0" : c.foreground,
    own: dark ? "#c4c4c4" : c.foreground,
    ownLogo: dark ? "#c9c9c9" : c.foregroundMuted,
    exeLogo: dark ? "#8d8d8d" : c.foregroundMuted,
    corner: dark ? "#555555" : c.foregroundMuted,
    menu: dark ? "#232323" : c.surface1,
    menuLine: dark ? "#343434" : c.border,
    menuHover: dark ? "#2c2c2c" : c.surface2,
    button: dark ? "#262626" : c.surface2,
    selected: dark ? "#6d9df5" : c.accent,
    ok: dark ? "#2e6b4a" : c.statusSuccess,
    dots: {
      q: "#6b6b6b",
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
  onPress,
  p,
  testID,
}: {
  label: string;
  count: number;
  open: boolean;
  col?: Col | null;
  archive?: boolean;
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
      style={{ flexDirection: "row", alignItems: "center", gap: 6, paddingTop: 7, paddingBottom: 6, paddingHorizontal: 2 }}
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
