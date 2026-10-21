import { useEffect, useRef } from "react";
import { Dimensions, Pressable, View } from "react-native";
import type { PluginButtonContentProps, PluginClientContext, PluginScreenProps } from "@getpaseo/plugin/client";
import { ChatView } from "./board";
import { palette, T } from "./ui";

// Phone: the chat kanban opens as a sheet over the chat; swiping it down returns to the chat.
export function overlayFor(client: PluginClientContext, workspaceId: string, chatId: string) {
  return function KanbanOverlay({ theme, host, close }: PluginButtonContentProps) {
    // One fixed height whatever the number of cards (Alexander, 22.10.2026).
    const height = Math.round(Dimensions.get("window").height * 0.8);
    return (
      <View testID="kanban-overlay" style={{ height, width: "100%" }}>
        <ChatView
          workspaceId={workspaceId}
          theme={theme}
          host={host}
          fixedAgentId={chatId}
          sheet
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
