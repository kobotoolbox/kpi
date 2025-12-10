import { type Mutation, MutationCache, QueryClient } from '@tanstack/react-query'
import { onErrorDefaultHandler } from './onErrorDefaultHandler'

interface CommonContext {
  snapshots?: ReadonlyArray<readonly [ReadonlyArray<unknown>, unknown]>
}

/**
 * After an optimistic update roll it back if server responds with an error.
 *
 * Note that in rare case when client receives error despite the request suceeding (e.g. untimely loss of connection),
 * then it will be reconciled as part of {@link onSettledInvalidateSnapshots}.
 *
 * To be used together with {@link optimisticallyUpdateList} and {@link optimisticallyUpdateItem}.
 */
const onErrorRestoreSnapshots = (
  _error: unknown,
  _variables: unknown,
  context: unknown,
  _mutation: Mutation<unknown, unknown, unknown>,
): void => {
  for (const [snapshotKey, snapshotData] of (context as CommonContext)?.snapshots ?? [])
    queryClient.setQueryData(snapshotKey, snapshotData)
}

/**
 * After an optimistic update (rolled back or not), invalidate and thus re-fetch data from server in background.
 * - If server response will match current cache, then not even a re-render will happen. Better be safe and confirm.
 * - If server response will NOT match current cache, then it will update cache and re-render accordingly.
 *
 * To be used together with {@link optimisticallyUpdateList} and {@link optimisticallyUpdateItem}.
 */
const onSettledInvalidateSnapshots = (
  _data: unknown,
  _error: unknown,
  _variables: unknown,
  context: unknown,
  mutation: Mutation<unknown, unknown, unknown>,
): void => {
  // Invalidate only if there are no other duplicate mutations in process, otherwise with unlucky timing
  // re-fetch of current invalidation may overwrite next mutation's optimistic update with outdated value.
  // See more at https://tkdodo.eu/blog/concurrent-optimistic-updates-in-react-query.
  if (queryClient.isMutating({ mutationKey: mutation.options.mutationKey }) !== 1) return

  for (const [snapshotKey] of (context as CommonContext)?.snapshots ?? [])
    queryClient.invalidateQueries({ queryKey: snapshotKey })
}

// Some shared defaults and config can be set here!
// Docs: https://tanstack.com/query/v5/docs/reference/QueryClient#queryclient
// See: https://tanstack.com/query/v5/docs/framework/react/guides/important-defaults
export const queryClient = new QueryClient({
  // FYI: Global callbacks will run in addition to default callbacks before them.
  mutationCache: new MutationCache({
    onError: onErrorRestoreSnapshots,
    onSettled: onSettledInvalidateSnapshots,
  }),
  // FYI: Default callbacks will run in addition to global callbacks after them, and may be overriden inline.
  defaultOptions: {
    queries: {
      throwOnError: onErrorDefaultHandler,
    },
    mutations: {
      onError: onErrorDefaultHandler,
    },
  },
})
