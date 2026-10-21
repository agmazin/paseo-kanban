import { useEffect, useMemo } from "react";
import { usePaseo, useRpc } from "@getpaseo/plugin/client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import type { PaseoApi, PaseoAgent } from "@getpaseo/client";
import { readPrefs, savePrefs } from "../shared/contracts";
import { cardsOf, DEFAULT_PREFS, type Prefs } from "../shared/model";

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

export function useCards(hostId: string) {
  const paseo = usePaseo();
  const qc = useQueryClient();
  const key = ["kanban-agents", hostId];
  const query = useQuery({
    queryKey: key,
    queryFn: () => allAgents(paseo),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  // Agent events carry the snapshot: patch the cached list instead of refetching every agent.
  useEffect(() => {
    let alive = true;
    let release: (() => void) | undefined;
    paseo.agents
      .list({ filter: { includeArchived: true }, page: { limit: 1 }, subscribe: {} })
      .then((r) => {
        if (!alive) return r.subscription.release();
        r.subscription.subscribe({
          snapshot: () => void qc.invalidateQueries({ queryKey: key }),
          update: (message) => {
            if (message.type !== "agent_update") return;
            const update = message.payload;
            qc.setQueryData<PaseoAgent[]>(key, (old) => {
              if (!old) return old;
              if (update.kind !== "upsert") return old.filter((a) => a.id !== update.agentId);
              const i = old.findIndex((a) => a.id === update.agent.id);
              if (i < 0) return [...old, update.agent];
              const next = old.slice();
              next[i] = update.agent;
              return next;
            });
          },
        });
        release = () => r.subscription.release();
      })
      .catch(() => {});
    return () => {
      alive = false;
      release?.();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paseo, qc, hostId]);
  const cards = useMemo(() => cardsOf(query.data ?? []), [query.data]);
  return { cards, agents: query.data ?? [], loading: query.isLoading, error: query.error };
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
