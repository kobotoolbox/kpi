import React from 'react'

import cx from 'classnames'
import InfiniteScrollTrigger from '#/components/common/InfiniteScrollTrigger'
import LoadingSpinner from '#/components/common/loadingSpinner'
import type { AssetResponse, ProjectViewAsset } from '#/dataInterface'
import type { OrderDirection, ProjectFieldName } from '#/projects/projectViews/constants'
import styles from './projectsTable.module.scss'
import ProjectsTableHeader from './projectsTableHeader'
import ProjectsTableRow from './projectsTableRow'
import rowStyles from './projectsTableRow.module.scss'

export interface ProjectsTableOrder {
  fieldName?: ProjectFieldName
  direction?: OrderDirection
}

interface ProjectsTableProps {
  isLoading?: boolean
  /** To display contextual empty message when zero assets. */
  emptyMessage?: string
  assets: Array<AssetResponse | ProjectViewAsset>
  /** Renders the columns for highlighted fields in some fancy way. */
  highlightedFields: ProjectFieldName[]
  visibleFields: ProjectFieldName[]
  /** The fields that have ability to change the order of data. */
  orderableFields: ProjectFieldName[]
  order: ProjectsTableOrder
  /** Called when user selects a column for odering. */
  onChangeOrderRequested: (order: ProjectsTableOrder) => void
  onHideFieldRequested: (fieldName: ProjectFieldName) => void
  /** Used for infinite scroll. */
  onRequestLoadNextPage: () => void
  /** If there are more results to be loaded. */
  hasMorePages: boolean
  /** If the next page of results is being loaded right now. */
  isLoadingNextPage?: boolean
  /** If loading the next page of results failed, so that a retry can be offered. */
  hasNextPageError?: boolean
  /** A list of uids */
  selectedRows: string[]
  /** Called when user selects a row (by clicking its checkbox) */
  onRowsSelected: (uids: string[]) => void
  /**
   * Whether to tell the user they've reached the end of the list. Best kept `false` for lists short enough that the end
   * is obvious anyway.
   */
  showEndMessage?: boolean
}

/**
 * Displays a table of assets. Works with `survey` type.
 */
export default function ProjectsTable(props: ProjectsTableProps) {
  // We ensure name is always visible:
  const safeVisibleFields = Array.from(new Set(props.visibleFields).add('name'))

  const onRowSelectionChange = (rowUid: string, isSelected: boolean) => {
    const uidsSet = new Set(props.selectedRows)
    if (isSelected) {
      uidsSet.add(rowUid)
    } else {
      uidsSet.delete(rowUid)
    }
    props.onRowsSelected(Array.from(uidsSet))
  }

  return (
    // This element scrolls the list below. `InfiniteScrollTrigger` observes against the viewport, and this element's
    // `overflow` clips the trigger out of it until the user scrolls near the end - so no scroll parent wiring needed.
    <div className={styles.root} tabIndex={-1}>
      <ProjectsTableHeader
        highlightedFields={props.highlightedFields}
        visibleFields={safeVisibleFields}
        orderableFields={props.orderableFields}
        order={props.order}
        onChangeOrderRequested={props.onChangeOrderRequested}
        onHideFieldRequested={props.onHideFieldRequested}
      />

      <div className={styles.body}>
        {props.isLoading && <LoadingSpinner />}

        {!props.isLoading && props.assets.length === 0 && (
          <div className={cx(rowStyles.row, rowStyles.rowTypeMessage)}>
            {props.emptyMessage || t('There are no projects to display.')}
          </div>
        )}

        {props.assets.map((asset) => (
          <ProjectsTableRow
            asset={asset}
            highlightedFields={props.highlightedFields}
            visibleFields={safeVisibleFields}
            isSelected={props.selectedRows.includes(asset.uid)}
            onSelectRequested={(isSelected: boolean) => onRowSelectionChange(asset.uid, isSelected)}
            key={asset.uid}
          />
        ))}

        {/* While the main spinner is up there is nothing to scroll yet, so the trigger would only add a second spinner */}
        {!props.isLoading && (
          <InfiniteScrollTrigger
            hasNextPage={props.hasMorePages}
            isFetchingNextPage={Boolean(props.isLoadingNextPage)}
            isError={Boolean(props.hasNextPageError)}
            onRetry={props.onRequestLoadNextPage}
            onRequestFetchNextPage={props.onRequestLoadNextPage}
            showEndMessage={props.showEndMessage}
          />
        )}
      </div>
    </div>
  )
}
