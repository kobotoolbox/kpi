// Libraries
import React from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import cx from 'classnames';

// Partial components
import LoadingSpinner from 'js/components/common/loadingSpinner';
import ProjectsTableRow from './projectsTableRow';
import ProjectsTableHeader from './projectsTableHeader';

// Constants and types
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import type {
  ProjectFieldName,
  OrderDirection,
} from 'js/projects/projectViews/constants';

// Styles
import styles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';

const SCROLL_PARENT_ID = 'projects-table-is-using-infinite_scroll-successfully';

export interface ProjectsTableOrder {
  fieldName?: ProjectFieldName;
  direction?: OrderDirection;
}

interface ProjectsTableProps {
  isLoading?: boolean;
  /** To display contextual empty message when zero assets. */
  emptyMessage?: string;
  assets: Array<AssetResponse | ProjectViewAsset>;
  /** Renders the columns for highlighted fields in some fancy way. */
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  /** The fields that have ability to change the order of data. */
  orderableFields: ProjectFieldName[];
  order: ProjectsTableOrder;
  /** Called when user selects a column for odering. */
  onChangeOrderRequested: (order: ProjectsTableOrder) => void;
  onHideFieldRequested: (fieldName: ProjectFieldName) => void;
  /** Used for infinite scroll. */
  onRequestLoadNextPage: () => void;
  /** If there are more results to be loaded. */
  hasMorePages: boolean;
  /** A list of uids */
  selectedRows: string[];
  /** Called when user selects a row (by clicking its checkbox) */
  onRowsSelected: (uids: string[]) => void;
}

/**
 * Displays a table of assets. Works with `survey` type.
 */
export default function ProjectsTable(props: ProjectsTableProps) {
  // We ensure name is always visible:
  const safeVisibleFields = Array.from(
    new Set(props.visibleFields).add('name')
  );

  const onRowSelectionChange = (rowUid: string, isSelected: boolean) => {
    const uidsSet = new Set(props.selectedRows);
    if (isSelected) {
      uidsSet.add(rowUid);
    } else {
      uidsSet.delete(rowUid);
    }
    props.onRowsSelected(Array.from(uidsSet));
  };

  return (
    // NOTE: react-infinite-scroller wants us to use refs, but there seems to
    // be some kind of a bug - either in their code or their typings. Thus we
    // are going to use OlDsChOoL `id` :shrug:.
    <div className={styles.root} id={SCROLL_PARENT_ID} tabIndex={-1}>
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

        <InfiniteScroll
          getScrollParent={() => document.getElementById(SCROLL_PARENT_ID)}
          pageStart={0}
          loadMore={props.onRequestLoadNextPage}
          hasMore={props.hasMorePages}
          loader={
            // We want to hide the plugin spinner when we already display
            // the main one - this ensures no double spinners
            props.isLoading ? <></> : <LoadingSpinner message={false} key='0' />
          }
          useWindow={false}
          initialLoad={false}
        >
          {props.assets.map((asset) => (
            <ProjectsTableRow
              asset={asset}
              highlightedFields={props.highlightedFields}
              visibleFields={safeVisibleFields}
              isSelected={props.selectedRows.includes(asset.uid)}
              onSelectRequested={(isSelected: boolean) =>
                onRowSelectionChange(asset.uid, isSelected)
              }
              key={asset.uid}
            />
          ))}
        </InfiniteScroll>
      </div>
    </div>
  );
}
