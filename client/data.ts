import { useEffect } from "react";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaseoApi, PaseoAgent } from "@getpaseo/client";
import { readCards, readPrefs, savePrefs } from "../shared/contracts";
import { DEFAULT_PREFS, type Prefs } from "../shared/model";

export async function allAgents(paseo: PaseoApi, includeArchived = true) {
  let cursor: string | undefined;
  const all: PaseoAgent[] = [];
  do {
    const result = await paseo.agents.list({
      filter: { includeArchived },
      page: { limit: 200, cursor },
    });
    all.push(...result.entries.map((e) => e.agent));
    cursor = result.pageInfo.nextCursor ?? undefined;
  } while (cursor);
  return all;
}

// Listens to the events of the plugin's single agent subscription (opened by the observer);
// a subscription per panel would make the daemon send every event once more.
export function onAgentEvents(paseo: PaseoApi, fn: () => void, delay = 800) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const off = paseo.agents.subscribe(() => {
    if (!timer) timer = setTimeout(() => ((timer = undefined), fn()), delay);
  });
  return () => {
    off();
    if (timer) clearTimeout(timer);
  };
}

export function useCards(hostId: string) {
  const paseo = usePaseo();
  const qc = useQueryClient();
  const read = useRpc(readCards);
  const key = ["kanban-cards", hostId];
  // Built on the daemon machine: a few KB instead of every agent snapshot with the archive.
  const query = useQuery({
    queryKey: key,
    queryFn: () => read({ archived: true }),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => onAgentEvents(paseo, () => void qc.invalidateQueries({ queryKey: key })), [paseo, qc, hostId]);
  return { cards: query.data?.cards ?? [], chats: query.data?.chats ?? [], loading: query.isLoading, error: query.error };
}

export function usePrefs(hostId: string) {
  const qc = useQueryClient();
  const read = useRpc(readPrefs);
  const save = useRpc(savePrefs);
  const key = ["kanban-prefs", hostId];
  const query = useQuery({ queryKey: key, queryFn: () => read({}), staleTime: 60_000 });
  const mutation = useMutation({
    mutationFn: (patch: Partial<Prefs>) => save(patch),
    onMutate: (patch) => {
      const previous = qc.getQueryData<Prefs>(key);
      qc.setQueryData<Prefs>(key, { ...DEFAULT_PREFS, ...previous, ...patch });
      return { previous };
    },
    onError: (_e, _p, ctx) => {
      if (ctx?.previous) qc.setQueryData(key, ctx.previous);
    },
    onSuccess: (next) => qc.setQueryData(key, next),
  });
  const prefs: Prefs = { ...DEFAULT_PREFS, ...query.data };
  return { prefs, update: (patch: Partial<Prefs>) => mutation.mutate(patch) };
}
