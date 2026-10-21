import { useSyncExternalStore } from "react";
// Client-side memory shared by the pills and the board tab: which chat the phone user came from.
const chats = new Map<string, string>();
const listeners = new Set<() => void>();
let lastWorkspace: string | null = null;
export function focusChat(workspaceId: string, chatId: string) {
  chats.set(workspaceId, chatId);
  lastWorkspace = workspaceId;
  listeners.forEach((l) => l());
}
export function rememberWorkspace(workspaceId: string) {
  lastWorkspace = workspaceId;
}
export function lastBoardWorkspace() {
  return lastWorkspace;
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
export function useFocusedChat(workspaceId: string) {
  return useSyncExternalStore(subscribe, () => chats.get(workspaceId) ?? null);
}
