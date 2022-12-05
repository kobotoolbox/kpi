import React from 'react';
import InfiniteScroll from 'react-infinite-scroller';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import ProjectsTableRow from './projectsTableRow';
import type {ProjectFieldName, OrderDirection} from 'js/projects/projectsView/projectsViewConstants';
import {PROJECT_FIELDS} from 'js/projects/projectsView/projectsViewConstants';
import ProjectsTableHeader from './projectsTableHeader';
import type {AssetResponse} from 'js/dataInterface';
import styles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';
import classNames from 'classnames';

interface ProjectsTableProps {
 isLoading?: boolean;
 /** To display contextual empty message when zero assets. */
 emptyMessage?: string;
 assets: AssetResponse[];
 /** Renders the columns for highlighted fields in some fancy way. */
 highlightedFields: ProjectFieldName[];
 orderFieldName: ProjectFieldName;
 orderDirection: OrderDirection;
 /** Called when user selects a column for odering. */
 onChangeOrderRequested: (fieldName: string, direction: OrderDirection) => void;
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
    if (props.orderFieldName === fieldName) {
      // clicking already selected column results in switching the order direction
      let newVal: OrderDirection = 'ascending';
      if (props.orderDirection === 'ascending') {
        newVal = 'descending';
      }
      props.onChangeOrderRequested(props.orderFieldName, newVal);
    } else {
      // change column and revert order direction to default
      props.onChangeOrderRequested(fieldName, PROJECT_FIELDS[fieldName].orderDefaultValue || 'ascending');
    }
  }

  return (
    <div className={styles.root}>
      <ProjectsTableHeader
        highlightedFields={props.highlightedFields}
        orderFieldName={props.orderFieldName}
        orderDirection={props.orderDirection}
        onChangeOrderRequested={onChangeOrderRequested}
      />

      <div className={styles.body}>
        {props.isLoading &&
          <LoadingSpinner/>
        }

        {!props.isLoading && props.assets.length === 0 &&
          <div className={classNames(rowStyles.row, rowStyles['row-message'])}>
            {props.emptyMessage || t('There are no assets to display.')}
          </div>
        }

        <InfiniteScroll
          pageStart={0}
          loadMore={props.onRequestLoadNextPage}
          hasMore={props.hasMorePages}
          loader={<LoadingSpinner hideMessage key='loadingspinner'/>}
          useWindow={false}
        >
          {props.assets.map((asset) =>
            <ProjectsTableRow
              asset={asset}
              highlightedFields={props.highlightedFields}
              key={asset.uid}
            />
          )}
        </InfiniteScroll>
      </div>
    </div>
  );
}
