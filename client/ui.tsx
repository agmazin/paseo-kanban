import { useEffect, useRef, useState, type ReactNode } from "react";
import { Image, Pressable, Text, View, type TextStyle } from "react-native";
import { Icon } from "@getpaseo/plugin/client/react-native";
import type { PluginWorkspacePanelProps } from "@getpaseo/plugin/client";
import { providerSvg, spin } from "./web";
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
    ok: c.accent,
    okFg: c.accentForeground,
    danger: c.statusDanger,
    // "Принято, доделываем": a calm accent tint from the theme.
    acceptedBg: blend(c.accent, c.surface1, dark ? 0.16 : 0.12),
    acceptedFg: blend(c.accent, c.foreground, dark ? 0.55 : 0.75),
    dots: {
      q: blend(c.foregroundMuted, bg, 0.45),
      run: dark ? "#5caaf6" : "#268ae0",
      need: dark ? "#db932e" : "#b37824",
      acc: dark ? "#a78bfa" : "#7c5cd6",
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

// Running: a blue ring that turns on desktop. Needs an answer: an orange "!".
export function Spinner({ p, size = 14 }: { p: Palette; size?: number }) {
  const ref = useRef<View>(null);
  useEffect(() => spin(ref.current), []);
  return (
    <View
      ref={ref}
      testID="kanban-spinner"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: 2,
        borderColor: `${p.dots.run}38`,
        borderTopColor: p.dots.run,
        flexShrink: 0,
      }}
    />
  );
}

export function Bang({ p, size = 15 }: { p: Palette; size?: number }) {
  return (
    <View
      testID="kanban-bang"
      style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: p.dots.need, alignItems: "center", justifyContent: "center", flexShrink: 0 }}
    >
      <Text style={{ fontFamily: font, color: p.dark ? "#1a1408" : "#ffffff", fontSize: size * 0.72, lineHeight: size, fontWeight: "800" }}>!</Text>
    </View>
  );
}

export function StatusMark({ col, p }: { col: Col; p: Palette }) {
  if (col === "run") return <Spinner p={p} />;
  if (col === "need") return <Bang p={p} />;
  return <Dot col={col} p={p} />;
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
  executor = true,
  actions,
  onPress,
  p,
}: {
  card: Card;
  inChat: boolean;
  showStatus: boolean;
  details?: string | null;
  executor?: boolean;
  // Rendered under the card body, outside its press target (buttons, text input).
  actions?: ReactNode;
  onPress(): void;
  p: Palette;
}) {
  const [hover, setHover] = useState(false);
  const faded = card.col === "done" || card.archived;
  const live = !card.archived && (card.col === "run" || card.col === "need");
  return (
    <View
      style={{
        backgroundColor: hover ? p.cardHover : p.card,
        borderWidth: 1,
        borderColor: p.cardLine,
        borderRadius: 9,
        marginBottom: 6,
      }}
    >
    <Pressable
      testID={`kanban-card-${card.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${card.key ? `${card.key} ` : ""}${card.title}. ${STATUS[card.col]}. Открыть диалог исполнителя`}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{ paddingTop: 8, paddingBottom: actions ? 0 : 9, paddingHorizontal: 11 }}
    >
      <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 3, minHeight: 16 }}>
        <T color={p.fg3} size={11.5}>
          {shortDate(card.updated)}
        </T>
        {showStatus ? (
          <View style={{ marginLeft: "auto", flexDirection: "row", alignItems: "center", gap: 5 }}>
            {card.archived ? <Dot col={card.col} p={p} /> : <StatusMark col={card.col} p={p} />}
            <T color={p.fg3} size={11.5}>
              {STATUS[card.col]}
            </T>
          </View>
        ) : live ? (
          <View style={{ marginLeft: "auto" }}>
            <StatusMark col={card.col} p={p} />
          </View>
        ) : null}
      </View>
      {card.key ? (
        <T color={p.fg3} size={11.5} style={{ marginBottom: 2 }}>
          {card.key}
        </T>
      ) : null}
      <T color={faded ? p.fg3 : p.fg} size={13.5} lines={4}>
        {card.title}
      </T>
      {card.accepted && !card.archived ? (
        <View
          testID="kanban-accepted-tag"
          style={{ alignSelf: "flex-start", marginTop: 6, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 6, backgroundColor: p.acceptedBg }}
        >
          <T color={p.acceptedFg} size={11.5} weight="500">
            Принято, доделываем
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
      {executor ? (
        <View testID="kanban-executor" style={{ flexDirection: "row", alignItems: "center", gap: 5, marginTop: 4 }}>
          <Icon name="CornerDownRight" size={13} color={p.corner} />
          <Logo provider={card.provider} size={12} color={p.exeLogo} />
          <T color={p.fg3} size={11.5} style={{ flexShrink: 1 }}>
            {card.executor}
          </T>
        </View>
      ) : null}
    </Pressable>
      {actions ? <View style={{ paddingHorizontal: 11, paddingTop: 9, paddingBottom: 9 }}>{actions}</View> : null}
    </View>
  );
}

export function Button({
  label,
  icon,
  primary,
  disabled,
  onPress,
  p,
  testID,
}: {
  label: string;
  icon?: string;
  primary?: boolean;
  disabled?: boolean;
  onPress(): void;
  p: Palette;
  testID?: string;
}) {
  const [hover, setHover] = useState(false);
  const bg = primary ? p.ok : hover ? p.cardHover : p.button;
  const fg = primary ? p.okFg : p.fg;
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      onHoverIn={() => setHover(true)}
      onHoverOut={() => setHover(false)}
      style={{
        flex: 1,
        height: 28,
        borderRadius: 7,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: bg,
        opacity: disabled ? 0.55 : primary && hover ? 0.9 : 1,
      }}
    >
      {icon ? <Icon name={icon} size={14} color={fg} /> : null}
      <T color={fg} size={12.5} weight="500">
        {label}
      </T>
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
