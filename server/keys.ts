import type { PaseoApi } from "@getpaseo/client";
import { planKeys, type KeyChange, type KeysState, type WorkspaceLike } from "../shared/keys";
import type { AgentLike } from "../shared/model";

export interface KeysDeps {
  list(paseo: PaseoApi): Promise<{ agents: AgentLike[]; workspaces: WorkspaceLike[] }>;
  write(change: KeyChange): Promise<void>;
  load(): KeysState;
  // Called before any write, so a number is never handed out twice.
  save(state: KeysState): Promise<void>;
  log?(text: string): void;
}

// One reconcile at a time; a request during a run schedules one more run after it.
export function keysReconciler(deps: KeysDeps) {
  let running: Promise<void> | null = null;
  let again = false;
  let latest: PaseoApi | null = null;
  const once = async (paseo: PaseoApi) => {
    const { agents, workspaces } = await deps.list(paseo);
    const { state, changes } = planKeys(agents, workspaces, deps.load());
    await deps.save(state);
    let failed = 0;
    for (const change of changes) {
      try {
        await deps.write(change);
      } catch {
        failed++;
      }
    }
    if (changes.length) deps.log?.(`Канбан: номера - изменений ${changes.length}, ошибок ${failed}`);
  };
  const run = (paseo: PaseoApi): Promise<void> => {
    latest = paseo;
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      do {
        again = false;
        try {
          await once(latest!);
        } catch (e) {
          deps.log?.(`Канбан: номера не сверены - ${(e as Error).message}`);
        }
      } while (again);
      running = null;
    })();
    return running;
  };
  return { run, idle: () => running ?? Promise.resolve(), paseo: () => latest };
}
