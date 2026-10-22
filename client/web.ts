import { createElement } from "react";
import { Platform } from "react-native";
import { providerPaths } from "./provider-paths";
// DOM is restricted to this module; every export is a no-op outside web.
declare const document: {
  head: { appendChild(node: unknown): void };
  getElementById(id: string): { remove(): void } | null;
  createElement(tag: string): { id: string; textContent: string };
};
declare const window: { location: { pathname: string }; innerWidth: number };

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

// Smooth fade for the empty column on web; native clients fall back to slices.
export function fadeStyle(tint: string, top: number) {
  if (Platform.OS !== "web") return null;
  return { backgroundImage: `linear-gradient(to bottom, rgba(${tint},${top}), rgba(${tint},0))` } as object;
}

interface HostNode {
  getAttribute(name: string): string | null;
  getClientRects(): { length: number };
  querySelector(selector: string): HostNode | null;
  querySelectorAll(selector: string): Iterable<HostNode>;
  click(): void;
}
const KANBAN_TAB = '[data-testid^="workspace-tab-plugin_"][data-testid*="paseo-kanban"]';
const TABS: Record<string, string> = {
  files: '[data-testid="workspace-tab-files"]',
  changes: '[data-testid="workspace-tab-changes_tree"]',
  kanban: KANBAN_TAB,
};
const MEMORY = "paseo-kanban.explorer-tab";
declare const localStorage: { getItem(key: string): string | null; setItem(key: string, value: string): void } | undefined;
const kindOf = (testId: string | null | undefined) =>
  !testId ? null : testId === "workspace-tab-files" ? "files" : testId === "workspace-tab-changes_tree" ? "changes" : testId.includes("paseo-kanban") ? "kanban" : null;

// Keeps "Канбан" beside Files and Changes and remembers the last explorer tab the user picked
// (Files, Changes or Kanban): another workspace opens its explorer on the same tab.
export function keepExplorerKanban(add: (workspaceId: string) => void) {
  if (Platform.OS !== "web" || typeof MutationObserver === "undefined") return () => {};
  const doc = document as unknown as HostNode & { body: unknown };
  const explorer = () => [...doc.querySelectorAll('[data-testid="workspace-explorer-sidebar"]')].find((n) => n.getClientRects().length > 0);
  const remembered = () => {
    try {
      return localStorage?.getItem(MEMORY) ?? null;
    } catch {
      return null;
    }
  };
  let seen = "";
  let settling = 0;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const select = (kind: string | null) => {
    const target = kind ? explorer()?.querySelector(TABS[kind] ?? "") : null;
    if (target && target.getAttribute("aria-selected") !== "true") target.click();
  };
  const read = () => {
    timer = undefined;
    const side = explorer();
    const parts = window.location.pathname.split("/");
    const key = side && parts.includes("workspace") ? parts[parts.indexOf("workspace") + 1] || "" : "";
    if (key && key === seen) {
      // Same workspace: whatever the user picks becomes the remembered tab.
      if (Date.now() < settling) return;
      const kind = kindOf(side?.querySelector('[data-testid^="workspace-tab-"][aria-selected="true"]')?.getAttribute("data-testid"));
      if (kind && kind !== remembered()) {
        try {
          localStorage?.setItem(MEMORY, kind);
        } catch {}
      }
      return;
    }
    seen = key;
    if (!side || !key) return;
    settling = Date.now() + 600;
    const previous = kindOf(side.querySelector('[data-testid^="workspace-tab-"][aria-selected="true"]')?.getAttribute("data-testid"));
    const wanted = remembered() ?? previous;
    if (!side.querySelector(KANBAN_TAB)) {
      add(key);
      setTimeout(() => select(wanted ?? previous), 80);
    } else select(wanted);
  };
  const observer = new MutationObserver(() => {
    if (!timer) timer = setTimeout(read, 150);
  });
  observer.observe(doc.body, { subtree: true, childList: true, attributes: true, attributeFilter: ["aria-selected"] });
  read();
  return () => {
    observer.disconnect();
    if (timer) clearTimeout(timer);
  };
}

// Phone-sized web window: behaves like the mobile app (no explorer tabs, no header buttons).
export function isCompactWeb() {
  return Platform.OS === "web" && typeof window !== "undefined" && window.innerWidth < 700;
}

// Running cards: a CSS rotation on desktop; phones keep the ring still (no per-frame work there).
const SPIN_ID = "paseo-kanban-spin";
export function spin(node: unknown) {
  if (Platform.OS !== "web" || typeof document === "undefined" || !node) return;
  if (!document.getElementById(SPIN_ID)) {
    const style = document.createElement("style");
    style.id = SPIN_ID;
    style.textContent = "@keyframes paseo-kanban-spin{to{transform:rotate(360deg)}}";
    document.head.appendChild(style);
  }
  (node as { style: { animation: string } }).style.animation = "paseo-kanban-spin 0.9s linear infinite";
}
