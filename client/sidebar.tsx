import type { PluginSidebarItemProps } from "@getpaseo/plugin/client";
import { SidebarRow } from "@getpaseo/plugin/client/ui";
import { lastBoardWorkspace } from "./focus";

// Left menu row: the workspace board as a screen, the place for it on phones (no header buttons there).
export function KanbanSidebarItem({ currentScreen, openScreen }: PluginSidebarItemProps) {
  return (
    <SidebarRow
      icon="SquareKanban"
      label="Канбан"
      active={currentScreen?.screenId === "board"}
      onPress={() => {
        const workspaceId = lastBoardWorkspace();
        openScreen({ screenId: "board", params: workspaceId ? { workspaceId } : {} });
      }}
    />
  );
}
