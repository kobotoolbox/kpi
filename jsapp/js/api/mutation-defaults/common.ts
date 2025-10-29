import { queryClient } from '#/query/queryClient'

interface CommonContext {
  snapshots?: ReadonlyArray<readonly [ReadonlyArray<unknown>, unknown]>
}
export const onErrorRestoreSnapshots = (_error: unknown, _variables: unknown, context?: CommonContext): void => {
  for (const [snapshotKey, snapshot] of context?.snapshots ?? []) queryClient.setQueryData(snapshotKey, snapshot)
}
export const onSettledInvalidateSnapshots = (
  _data: unknown,
  _error: unknown,
  _variables: unknown,
  context?: CommonContext,
): void => {
  for (const [snapshotKey] of context?.snapshots ?? []) queryClient.invalidateQueries({ queryKey: snapshotKey })
}

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
export const filterListSnapshots = ([listSnapshotKey]: [readonly unknown[], unknown]) =>
  typeof listSnapshotKey[listSnapshotKey.length - 1] !== 'string'

/**
 * @see {@link filterListSnapshots}
 */
export const invalidateList = (queryKey: readonly unknown[]) => {
  const listSnapshots = queryClient
    .getQueriesData({ queryKey: queryKey })
    .filter(filterListSnapshots)
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


