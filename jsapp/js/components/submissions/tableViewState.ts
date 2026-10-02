import type { ReactTableStateFilteredItem } from '#/components/submissions/table.types'

/**
 * How the data table was last left. The table keeps this in component state, which
 * goes with it when it unmounts - as it does when you open a submission record at
 * its own address - so the bits worth restoring are remembered out here.
 *
 * Sort order is absent on purpose: it is a table setting saved on the asset.
 *
 * Only covers the trip to a record and back - the table clears this when the user
 * leaves for anywhere else, so a project always opens unfiltered on page one.
 */
export interface TableViewState {
  pageSize: number
  filtered: ReactTableStateFilteredItem[]
  /** Zero-based, the way `react-table` counts pages. */
  page: number
}

/** Partial, because callers set only what they own. */
const _viewStates = new Map<string, Partial<TableViewState>>()

export function getTableViewState(assetUid: string): Partial<TableViewState> | undefined {
  return _viewStates.get(assetUid)
}

/** Merges into what is already remembered, rather than replacing it. */
export function setTableViewState(assetUid: string, viewState: Partial<TableViewState>): void {
  _viewStates.set(assetUid, { ..._viewStates.get(assetUid), ...viewState })
}

export function clearTableViewState(assetUid: string): void {
  _viewStates.delete(assetUid)
}
