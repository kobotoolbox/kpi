import type { ReactTableStateFilteredItem } from '#/components/submissions/table.types'

/**
 * How the data table was last left: what was filtered out, and how many rows
 * were being shown at a time.
 *
 * These live in `react-table`'s own component state, so they would otherwise be
 * lost the moment the table unmounts - and it does unmount, e.g. when opening
 * a submission record at its own address. Sort order is not here, because it is
 * a saved table setting kept on the asset.
 *
 * The page number is not here either: `react-table` (v6) resets to the first
 * page whenever the filters change, including on mount, so it cannot be seeded
 * without asking for a second page of data. Coming back to a filtered table
 * therefore starts at its first page.
 *
 * Kept in memory only, and only for the current tab: coming back to a project
 * later, or through a link someone sent, starts unfiltered.
 */
export interface TableViewState {
  pageSize: number
  filtered: ReactTableStateFilteredItem[]
}

const _viewStates = new Map<string, TableViewState>()

export function getTableViewState(assetUid: string): TableViewState | undefined {
  return _viewStates.get(assetUid)
}

export function setTableViewState(assetUid: string, viewState: TableViewState): void {
  _viewStates.set(assetUid, viewState)
}
