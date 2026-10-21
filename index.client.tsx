import type { PluginClientContext } from "@getpaseo/plugin/client";
import { Board, ChatBoard } from "./client/board";
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
    context: "agent",
    locations: ["explorer"],
    Component: ChatBoard,
  });
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
    context: "agent",
    onSelect: ({ openPanel }) => openPanel("chat", { location: "explorer" }),
  });
  return observe(client);
}
