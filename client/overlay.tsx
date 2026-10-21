import { useEffect, useRef } from "react";
import { Dimensions, Pressable, View } from "react-native";
import type { PluginButtonContentProps, PluginClientContext, PluginScreenProps } from "@getpaseo/plugin/client";
import { ChatView } from "./board";
import { palette, T } from "./ui";

// Phone: the chat kanban opens over the chat; the "Чат с агентом" tab just closes the window.
export function overlayFor(client: PluginClientContext, workspaceId: string, chatId: string) {
  return function KanbanOverlay({ theme, host, close }: PluginButtonContentProps) {
    const p = palette(theme);
    const height = Math.round(Dimensions.get("window").height * 0.8);
    const tab = (label: string, active: boolean, onPress?: () => void) => (
      <Pressable
        accessibilityRole="tab"
        accessibilityLabel={label}
        accessibilityState={{ selected: active }}
        onPress={onPress}
        style={{ paddingHorizontal: 14, paddingVertical: 7, borderRadius: 999, backgroundColor: active ? p.button : "transparent" }}
      >
        <T color={active ? p.fg : p.fg2} size={14}>
          {label}
        </T>
      </Pressable>
    );
    return (
      <View testID="kanban-overlay" style={{ height, width: "100%" }}>
        <View style={{ flexDirection: "row", gap: 6, paddingHorizontal: 10, paddingTop: 4, paddingBottom: 6 }}>
          {tab("Чат с агентом", false, close)}
          {tab("Канбан", true)}
        </View>
        <ChatView
          workspaceId={workspaceId}
          theme={theme}
          host={host}
          fixedAgentId={chatId}
          onOpenCard={(card) => {
            close();
            client.openScreen({ screenId: "open-agent", params: { agentId: card.id, at: String(Date.now()) } });
          }}
        />
      </View>
    );
  };
}

// Pill popovers get no navigation; this screen hands the executor's dialog to Paseo's navigation once.
const handled = new Set<string>();
export function OpenAgentScreen({ params, navigation, theme }: PluginScreenProps) {
  const p = palette(theme);
  const done = useRef(false);
  const key = `${params.agentId}:${params.at}`;
  useEffect(() => {
    if (done.current || handled.has(key) || !params.agentId) return;
    done.current = true;
    handled.add(key);
    navigation?.openAgent({ agentId: params.agentId });
  }, [key, navigation, params.agentId]);
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: p.bg, gap: 12 }}>
      <Pressable accessibilityRole="button" onPress={() => navigation?.openAgent({ agentId: params.agentId })}>
        <T color={p.fg2} size={14}>
          Открыть диалог исполнителя
        </T>
      </Pressable>
    </View>
  );
}
