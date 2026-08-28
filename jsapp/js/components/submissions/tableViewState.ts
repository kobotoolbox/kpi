import type { ReactTableStateFilteredItem } from '#/components/submissions/table.types'
import type { TableFilterQuery } from '#/components/submissions/tableUtils'

/**
 * How the data table was last left. This lives in component state, so it is lost
 * whenever the table unmounts - which it does when you open a submission record
 * at its own address.
 *
 * Two things are deliberately absent. Sort order, because it is a saved table
 * setting kept on the asset. And the page number, because `react-table` (v6)
 * resets to the first page whenever the filters change, including on mount, so it
 * cannot be seeded without asking for a second page of data - coming back to a
 * filtered table starts at its first page.
 *
 * In memory and per-tab only: returning to a project later, or through a link
 * someone sent, starts unfiltered.
 */
export interface TableViewState {
  pageSize: number
  filtered: ReactTableStateFilteredItem[]
  /**
   * The same filters as a Back end query. Kept ready-made because the submission
   * route needs it to step between records the way the table lists them, and it
   * has no `react-table` instance of its own to build it from.
   */
  filterQuery: TableFilterQuery['queryObj'] | undefined
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
