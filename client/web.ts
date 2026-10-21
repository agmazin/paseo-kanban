import { createElement } from "react";
import { Platform } from "react-native";
import { providerPaths } from "./provider-paths";
// DOM is restricted to this module; every export is a no-op outside web.
declare const document: {
  head: { appendChild(node: unknown): void };
  getElementById(id: string): { remove(): void } | null;
  createElement(tag: string): { id: string; textContent: string };
};
declare const window: { location: { pathname: string } };

export function providerSvg(provider: string, size: number, color: string) {
  if (Platform.OS !== "web" || !providerPaths[provider]) return null;
  return createElement(
    "svg",
    {
      xmlns: "http://www.w3.org/2000/svg",
      viewBox: "0 0 24 24",
      width: size,
      height: size,
      fill: color,
      fillRule: provider === "codex" ? "evenodd" : undefined,
      "aria-hidden": true,
    },
    createElement("path", { d: providerPaths[provider] }),
  );
}

// TickTick-like scrollbars: the board's horizontal bar shows while the pointer is
// over the board, a column's vertical bar while it is over that column.
const STYLE_ID = "paseo-kanban-scrollbars";
const CSS = `
[data-testid="kanban-cols"],[data-testid="kanban-col-scroll"]{scrollbar-width:thin;scrollbar-color:transparent transparent}
[data-testid="kanban-board"]:hover [data-testid="kanban-cols"]{scrollbar-color:#454545 transparent}
[data-testid="kanban-col-scroll"]:hover{scrollbar-color:#454545 transparent}
`;
let users = 0;
export function installScrollbarStyle() {
  if (Platform.OS !== "web" || typeof document === "undefined") return () => {};
  users++;
  if (!document.getElementById(STYLE_ID)) {
    const node = document.createElement("style");
    node.id = STYLE_ID;
    node.textContent = CSS;
    document.head.appendChild(node);
  }
  return () => {
    if (--users === 0) document.getElementById(STYLE_ID)?.remove();
  };
}

// Opening the explorer panel by itself only when that workspace is on screen.
export function isWorkspaceRouteOpen(id: string) {
  if (Platform.OS !== "web" || typeof window === "undefined") return false;
  return window.location.pathname.split("/").includes(id);
}

declare const MutationObserver: new (fn: () => void) => {
  observe(node: unknown, options: unknown): void;
  disconnect(): void;
};
// Paseo 0.12 exposes the focused tab only through its accessible tab elements.
// Read-only: the explorer chat kanban follows the selected agent tab.
export function observeSelectedAgent(onChange: (id: string | null) => void) {
  if (Platform.OS !== "web" || typeof MutationObserver === "undefined") return () => {};
  const doc = document as unknown as {
    body: unknown;
    querySelectorAll(selector: string): Iterable<{ getAttribute(name: string): string | null; getClientRects(): { length: number } }>;
  };
  let last: string | null = null;
  const read = () => {
    const tab = [...doc.querySelectorAll('[data-testid^="workspace-tab-agent_"][aria-selected="true"]')].find(
      (node) => node.getClientRects().length > 0,
    );
    const id = tab?.getAttribute("data-testid")?.replace(/^workspace-tab-agent_/, "") ?? null;
    if (id && id !== last) {
      last = id;
      onChange(id);
    }
  };
  const observer = new MutationObserver(read);
  observer.observe(doc.body, { subtree: true, attributes: true, attributeFilter: ["aria-selected"], childList: true });
  read();
  return () => observer.disconnect();
}
