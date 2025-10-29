import type { Updater } from '@tanstack/react-query'
import { queryClient } from '#/query/queryClient'

/**
 * Beware that `getUsersListQueryKey(undefined)` (and alike) doesn't select all pages for list endpoint as expected!
 * Unfortunately, it will invalidate all specific users as well.
 *
 * It's because our API structure + Orval key generation rules are, in short, as follows:
 * - `['api', 'v2', 'users', pagination]` for lists, where `pagination` is an object e.g. `{limit: 10, offset: 0}`.
 * - `['api', 'v2', 'users', userId]` for specific items, where `userId` is a string.
 * - `['api', 'v2', 'users']` thus this will select both above.
 *
 * Workaround: to select all pages, filter for keys that end with non-string values.
 */
const filterListSnapshots = ([listSnapshotKey]: [readonly unknown[], unknown]) =>
  typeof listSnapshotKey[listSnapshotKey.length - 1] !== 'string'

/**
 * @see {@link filterListSnapshots}
 */
export const invalidateList = (queryKey: readonly unknown[]) => {
  const listSnapshots = queryClient.getQueriesData({ queryKey: queryKey }).filter(filterListSnapshots)
  for (const [snapshotKey] of listSnapshots) queryClient.invalidateQueries({ queryKey: snapshotKey })
}
/**
 * @see {@link filterListSnapshots}
 */
export const invalidateItems = (queryKey: readonly unknown[]) => {
  const itemSnapshots = queryClient
    .getQueriesData({ queryKey: queryKey })
    .filter((tuple) => !filterListSnapshots(tuple))
  for (const [itemKey] of itemSnapshots) queryClient.invalidateQueries({ queryKey: itemKey })
}
/**
 * Convenience helper for consistency alongside {@link invalidateItems} and {@link invalidateList}
 */
export const invalidateItem = (queryKey: readonly unknown[]) => {
  queryClient.invalidateQueries({ queryKey })
}

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
export const onErrorRestoreSnapshots = (_error: unknown, _variables: unknown, context?: CommonContext): void => {
  for (const [snapshotKey, snapshotData] of context?.snapshots ?? [])
    queryClient.setQueryData(snapshotKey, snapshotData)
}
/**
 * After an optimistic update (rolled back or not), invalidate and thus re-fetch data from server in background.
 * - If server response will match current cache, then not even a re-render will happen. Better be safe and confirm.
 * - If server response will NOT match current cache, then it will update cache and re-render accordingly.
 *
 * To be used together with {@link optimisticallyUpdateList} and {@link optimisticallyUpdateItem}.
 */
export const onSettledInvalidateSnapshots = (
  _data: unknown,
  _error: unknown,
  _variables: unknown,
  context?: CommonContext,
): void => {
  for (const [snapshotKey] of context?.snapshots ?? []) queryClient.invalidateQueries({ queryKey: snapshotKey })
}
/**
 * Optimistically apply `updater` to all pages of the `queryKey` list in cache.
 *
 * Handles selecting and iterating over pages of list (and not items, see more at {@link filterListSnapshots}),
 * and cancels in-flight queries that may race-condition to overwrite the optimistic update.
 *
 * Returns snapshots, to be consumed by {@link onErrorRestoreSnapshots} and {@link onSettledInvalidateSnapshots}.
 */
export const optimisticallyUpdateList = async <T>(
  queryKey: readonly unknown[],
  updater: Updater<NoInfer<T> | undefined, NoInfer<T> | undefined>,
) => {
  const listSnapshots = queryClient
    .getQueriesData<T>({
      queryKey,
      exact: false,
    })
    .filter(filterListSnapshots)
  for (const [listSnapshotKey] of listSnapshots) {
    await queryClient.cancelQueries({ queryKey: listSnapshotKey })
    queryClient.setQueryData<T>(listSnapshotKey, updater)
  }
  return listSnapshots
}
/**
 * Optimistically apply `updater` to `queryKey` item in cache, or removes the canche if `updater` is `null`.
 *
 * Also cancels in-flight queries that may race-condition to overwrite the optimistic update.
 *
 * Returns a snapshot, to be consumed by {@link onErrorRestoreSnapshots} and {@link onSettledInvalidateSnapshots}.
 */
export const optimisticallyUpdateItem = async <T>(
  queryKey: readonly unknown[],
  updater: Updater<NoInfer<T> | undefined, NoInfer<T> | undefined> | null,
) => {
  const itemSnapshot = queryClient.getQueryData<T>(queryKey)
  await queryClient.cancelQueries({ queryKey })
  if (updater) {
    queryClient.setQueryData<T>(queryKey, updater)
  } else {
    queryClient.removeQueries({ queryKey, exact: true })
  }
  return [queryKey, itemSnapshot] as const
}
