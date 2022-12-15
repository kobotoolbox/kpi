import React from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import ProjectsTableRow from './projectsTableRow';
import type {
  ProjectFieldName,
  OrderDirection,
} from 'js/projects/projectViews/constants';
import {PROJECT_FIELDS} from 'js/projects/projectViews/constants';
import ProjectsTableHeader from './projectsTableHeader';
import type {AssetResponse, ProjectViewAsset} from 'js/dataInterface';
import styles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';
import classNames from 'classnames';

const SCROLL_PARENT_ID = 'projects-table-is-using-infinite_scroll-succesfully';

export interface ProjectsTableOrder {
  fieldName: ProjectFieldName;
  direction: OrderDirection;
}

interface ProjectsTableProps {
  isLoading?: boolean;
  /** To display contextual empty message when zero assets. */
  emptyMessage?: string;
  assets: Array<AssetResponse | ProjectViewAsset>;
  /** Renders the columns for highlighted fields in some fancy way. */
  highlightedFields: ProjectFieldName[];
  visibleFields: ProjectFieldName[];
  order: ProjectsTableOrder;
  /** Called when user selects a column for odering. */
  onChangeOrderRequested: (order: ProjectsTableOrder) => void;
  /** Used for infinite scroll. */
  onRequestLoadNextPage: () => void;
  /** If there are more results to be loaded. */
  hasMorePages: boolean;
}

/**
 * Displays a table of assets.
 */
export default function ProjectsTable(props: ProjectsTableProps) {
  /**
   * Sends a request to change order. If same field was sent, it means we want
   * to change order. If different field, it means default order for that field.
   */
  const onChangeOrderRequested = (fieldName: ProjectFieldName) => {
    if (props.order.fieldName === fieldName) {
      // clicking already selected column results in switching the order direction
      let newVal: OrderDirection = 'ascending';
      if (props.order.direction === 'ascending') {
        newVal = 'descending';
      }
      props.onChangeOrderRequested({
        fieldName: props.order.fieldName,
        direction: newVal,
      });
    } else {
      // change column and revert order direction to default
      props.onChangeOrderRequested({
        fieldName: fieldName,
        direction: PROJECT_FIELDS[fieldName].defaultDirection || 'ascending',
      });
    }
  };

  return (
    // NOTE: react-infinite-scroller wants us to use refs, but there seems to
    // be some kind of a bug - either in their code or their typings. Thus we
    // are going to use OlDsChOoL `id` :shrug:.
    <div className={styles.root} id={SCROLL_PARENT_ID}>
      <ProjectsTableHeader
        highlightedFields={props.highlightedFields}
        visibleFields={props.visibleFields}
        order={props.order}
        onChangeOrderRequested={onChangeOrderRequested}
      />

      <div className={styles.body}>
        {props.isLoading && <LoadingSpinner />}

        {!props.isLoading && props.assets.length === 0 && (
          <div className={classNames(rowStyles.row, rowStyles.rowTypeMessage)}>
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
            props.isLoading ? <></> : <LoadingSpinner hideMessage key='0' />
          }
          useWindow={false}
          initialLoad={false}
        >
          {props.assets.map((asset) => (
            <ProjectsTableRow
              asset={asset}
              highlightedFields={props.highlightedFields}
              visibleFields={props.visibleFields}
              key={asset.uid}
            />
          ))}
        </InfiniteScroll>
      </div>
    </div>
  );
}
