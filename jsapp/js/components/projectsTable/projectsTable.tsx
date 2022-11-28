import React from 'react';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import ProjectsTableRow from './projectsTableRow';
import type {ProjectFieldName, OrderDirection} from 'js/components/projectsView/projectsViewConstants';
import {PROJECT_FIELDS} from 'js/components/projectsView/projectsViewConstants';
import ProjectsTableHeader from './projectsTableHeader';
import type {AssetResponse} from 'js/dataInterface';
import styles from './projectsTable.module.scss';
import rowStyles from './projectsTableRow.module.scss';
import classNames from 'classnames';

interface ProjectsTableProps {
 /** Displays a spinner */
 isLoading?: boolean;
 /** To display contextual empty message when zero assets. */
 emptyMessage?: string;
 /** List of assets to be displayed. */
 assets: AssetResponse[];
 /** Number of assets on all pages. */
 totalAssets: number;
 /** Seleceted order column id, one of ASSETS_TABLE_COLUMNS. */
 orderFieldName: ProjectFieldName;
 /** Seleceted order column value. */
 orderDirection: OrderDirection;
 /** Called when user selects a column for odering. */
 onChangeOrderRequested: (fieldName: string, direction: OrderDirection) => void;
 /** A list of uids */
 selectedRows: string[];
 /** Called when user selects a row (by clicking its checkbox) */
 onRowsSelected: (uids: string[]) => void;
 /**
  * For displaying pagination. If you omit any of these, pagination will simply
  * not be rendered. Good to use when you actually don't need it.
  */
 currentPage?: number;
 totalPages?: number;
 /** Called when user clicks page change. */
 onSwitchPage?: (pageNumber: number) => void;
}

/**
 * Displays a table of assets.
 */
export default class ProjectsTable extends React.Component<ProjectsTableProps> {
  switchPage(newPageNumber: number) {
    if (this.props.onSwitchPage) {
      this.props.onSwitchPage(newPageNumber);
    }
  }

  /**
   * This function is only a callback handler, as the asset reordering itself
   * should be handled by the component that is providing the assets list.
   */
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

  /**
   * Safe: returns nothing if pagination properties are not set.
   */
  renderPagination() {
    if (
      this.props.currentPage &&
      this.props.totalPages &&
      this.props.onSwitchPage
    ) {
      const naturalCurrentPage = this.props.currentPage + 1;
      return (
        <footer className={styles.pagination}>
          <button
            className={styles['pagination-button']}
            disabled={this.props.currentPage === 0}
            onClick={this.switchPage.bind(this, this.props.currentPage - 1)}
          >
            <i className='k-icon k-icon-angle-left'/>
            {t('Previous')}
          </button>

          <span className={styles['pagination-index']}>
            {/* we avoid displaying 1/0 as it doesn't make sense to humans */}
            {naturalCurrentPage}/{this.props.totalPages || 1}
          </span>

          <button
            className={styles['pagination-button']}
            disabled={naturalCurrentPage >= this.props.totalPages}
            onClick={this.switchPage.bind(this, this.props.currentPage + 1)}
          >
            {t('Next')}
            <i className='k-icon k-icon-angle-right'/>
          </button>
        </footer>
      );
    } else {
      return null;
    }
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

          {!this.props.isLoading && this.props.assets.map((asset) =>
            <ProjectsTableRow
              asset={asset}
              isSelected={this.props.selectedRows.includes(asset.uid)}
              onSelectRequested={(isSelected: boolean) =>
                this.onRowSelectionChange(asset.uid, isSelected)
              }
              key={asset.uid}
            />
          )}
        </div>

        <footer className={styles.footer}>
          {this.props.totalAssets !== null &&
            <span>
              {t('##count## items').replace('##count##', String(this.props.totalAssets))}
            </span>
          }

          {this.renderPagination()}
        </footer>
      </div>
    );
  }
}
