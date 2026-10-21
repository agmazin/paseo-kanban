// Last workspace whose board was on screen: the left menu "Канбан" opens it first.
let lastWorkspace: string | null = null;
export function rememberWorkspace(workspaceId: string) {
  lastWorkspace = workspaceId;
}
export function lastBoardWorkspace() {
  return lastWorkspace;
}
