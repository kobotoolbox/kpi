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
 orderFieldName: ProjectFieldName;
 orderDirection: OrderDirection;
 /** Called when user selects a column for odering. */
 onChangeOrderRequested: (fieldName: string, direction: OrderDirection) => void;
 /** A list of uids */
 selectedRows: string[];
 /** Called when user selects a row (by clicking its checkbox) */
 onRowsSelected: (uids: string[]) => void;
 /** Used for infinite scroll. */
 onRequestLoadNextPage: () => void;
 /** If there are more results to be loaded. */
 hasMorePages: boolean;
}

/**
 * Displays a table of assets.
 */
export default class ProjectsTable extends React.Component<ProjectsTableProps> {
  /**
   * Sends a request to change order. If same field was sent, it means we want
   * to change order. If different field, it means default order for that field.
   */
  onChangeOrderRequested(fieldName: ProjectFieldName) {
    if (this.props.orderFieldName === fieldName) {
      // clicking already selected column results in switching the order direction
      let newVal: OrderDirection = 'ascending';
      if (this.props.orderDirection === 'ascending') {
        newVal = 'descending';
      }
      this.props.onChangeOrderRequested(this.props.orderFieldName, newVal);
    } else {
      // change column and revert order direction to default
      this.props.onChangeOrderRequested(fieldName, PROJECT_FIELDS[fieldName].orderDefaultValue || 'ascending');
    }
  }

  onRowSelectionChange(rowUid: string, isSelected: boolean) {
    const uidsSet = new Set(this.props.selectedRows);
    if (isSelected) {
      uidsSet.add(rowUid);
    } else {
      uidsSet.delete(rowUid);
    }
    this.props.onRowsSelected(Array.from(uidsSet));
  }

  render() {
    return (
      <div className={styles.root}>
        <ProjectsTableHeader
          orderFieldName={this.props.orderFieldName}
          orderDirection={this.props.orderDirection}
          onChangeOrderRequested={this.onChangeOrderRequested.bind(this)}
        />

        <div className={styles.body}>
          {this.props.isLoading &&
            <LoadingSpinner/>
          }

          {!this.props.isLoading && this.props.assets.length === 0 &&
            <div className={classNames(rowStyles.row, rowStyles['row-message'])}>
              {this.props.emptyMessage || t('There are no assets to display.')}
            </div>
          }

          <InfiniteScroll
            pageStart={0}
            loadMore={this.props.onRequestLoadNextPage.bind(this)}
            hasMore={this.props.hasMorePages}
            loader={<LoadingSpinner hideMessage key='loadingspinner'/>}
            useWindow={false}
          >
            {this.props.assets.map((asset) =>
              <ProjectsTableRow
                asset={asset}
                isSelected={this.props.selectedRows.includes(asset.uid)}
                onSelectRequested={(isSelected: boolean) =>
                  this.onRowSelectionChange(asset.uid, isSelected)
                }
                key={asset.uid}
              />
            )}
          </InfiniteScroll>
        </div>
      </div>
    );
  }
}
