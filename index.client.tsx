import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Board, BoardScreen, ChatBoard, ChatBoardTab } from "./client/board";
import { KanbanSidebarItem } from "./client/sidebar";
import { OpenAgentScreen } from "./client/overlay";
import { observe } from "./client/observer";
export default function contribute(client: PluginClientContext) {
  client.addWorkspacePanel({
    id: "board",
    title: "Канбан",
    icon: "SquareKanban",
    context: "workspace",
    locations: ["workspace"],
    Component: Board,
  });
  client.addWorkspacePanel({
    id: "chat",
    title: "Канбан",
    icon: "SquareKanban",
    context: "workspace",
    locations: ["explorer"],
    Component: ChatBoard,
  });
  client.addWorkspacePanel({
    id: "chat-tab",
    title: "Канбан чата",
    icon: "SquareKanban",
    context: "agent",
    locations: ["workspace"],
    Component: ChatBoardTab,
  });
  client.addScreen({ id: "board", title: "Канбан", Component: BoardScreen });
  client.addScreen({ id: "open-agent", title: "Диалог исполнителя", Component: OpenAgentScreen });
  client.addSidebarHeaderItem({ id: "kanban", title: "Канбан", Component: KanbanSidebarItem });
  client.addCommandCenterItem({
    id: "open-board",
    title: "Канбан пространства",
    icon: "SquareKanban",
    keywords: ["kanban", "канбан", "задачи", "карточки"],
    context: "workspace",
    onSelect: ({ openPanel }) => openPanel("board"),
  });
  client.addCommandCenterItem({
    id: "open-chat",
    title: "Канбан чата",
    icon: "SquareKanban",
    keywords: ["kanban", "канбан", "карточки чата"],
    context: "workspace",
    onSelect: ({ openPanel }) => openPanel("chat", { location: "explorer" }),
  });
  return observe(client);
}
