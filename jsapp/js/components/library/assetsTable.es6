import React from 'react';
import autoBind from 'react-autobind';
import {bem} from 'js/bem';
import {t} from 'js/utils';
import AssetsTableRow from './assetsTableRow';
import {renderLoading} from 'js/components/modalForms/modalHelpers';

/**
 * Displays a table of assets.
 *
 * @prop {string} context - One of ASSETS_TABLE_CONTEXTS.
 * @prop {boolean} [isLoading] - To display spinner.
 * @prop {Array<object>} assets - List of assets to be displayed.
 * @prop {number} totalAssets - Number of assets on all pages.
 * @prop {Array<object>} availableFilters - List of available filters values.
 * @prop {AssetsTableColumn} column - Seleceted column, one of ASSETS_TABLE_COLUMNS.
 * @prop {string} columnValue - Seleceted column value.
 * @prop {columnChangeCallback} onColumnChange - Called when user selects a column for odering or filtering.
 * @prop {number} [currentPage] - For displaying pagination.
 * @prop {number} [totalPages] - For displaying pagination.
 * @prop {switchPageCallback} [onSwitchPage] - Called when user clicks page change.
 */
export class AssetsTable extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  /**
   * @param {number} newPageNumber
   */
  switchPage(newPageNumber) {
    this.props.onSwitchPage(newPageNumber);
  }

  /**
   * This function is only a callback handler, as the asset reordering itself
   * should be handled by the component that is providing the assets list.
   * @param {string} columnId
   */
  reorder(columnId) {
    if (this.props.column.id === columnId) {
      // clicking already selected column results in switching the order direction
      let newVal;
      if (this.props.columnValue === ORDER_DIRECTIONS.get('ascending')) {
        newVal = ORDER_DIRECTIONS.get('descending');
      } else if (this.props.columnValue === ORDER_DIRECTIONS.get('descending')) {
        newVal = ORDER_DIRECTIONS.get('ascending');
      }
      this.props.onColumnChange(this.props.column, newVal);
    } else {
      // change column and revert order direction to ascending
      const newColumn = ASSETS_TABLE_COLUMNS.get(columnId);
      this.props.onColumnChange(newColumn, newColumn.defaultValue);
    }
  }

  /**
   * @param {AssetsTableColumn} columnDef - Given column definition.
   */
  renderHeaderColumn(columnDef) {
    // empty icon to take up space in column
    let icon = (<i className='k-icon'/>);
    if (this.props.column.id === columnDef.id) {
      if (this.props.columnValue === ORDER_DIRECTIONS.get('ascending')) {
        icon = (<i className='k-icon k-icon-up'/>);
      }
      if (this.props.columnValue === ORDER_DIRECTIONS.get('descending')) {
        icon = (<i className='k-icon k-icon-down'/>);
      }
    }
    return (
      <bem.AssetsTableRow__column
        m={columnDef.id}
        onClick={this.reorder.bind(this, columnDef.id)}
      >
        {columnDef.label}
        {icon}
      </bem.AssetsTableRow__column>
    );
  }

  /**
   * Safe: would return nothing if pagination properties are not set.
   */
  renderPagination() {
    const hasPagination = (
      typeof this.props.currentPage === 'number' &&
      typeof this.props.totalPages === 'number' &&
      typeof this.props.onSwitchPage === 'function'
    );
    const naturalCurrentPage = this.props.currentPage + 1;

    if (hasPagination) {
      return (
        <bem.AssetsTablePagination>
          <bem.AssetsTablePagination__button
            disabled={this.props.currentPage === 0}
            onClick={this.switchPage.bind(this, this.props.currentPage - 1)}
          >
            <i className='k-icon k-icon-prev'/>
            {t('Previous page')}
          </bem.AssetsTablePagination__button>

          <bem.AssetsTablePagination__index>
            {naturalCurrentPage}/{this.props.totalPages}
          </bem.AssetsTablePagination__index>

          <bem.AssetsTablePagination__button
            disabled={naturalCurrentPage === this.props.totalPages}
            onClick={this.switchPage.bind(this, this.props.currentPage + 1)}
          >
            {t('Next page')}
            <i className='k-icon k-icon-next'/>
          </bem.AssetsTablePagination__button>
        </bem.AssetsTablePagination>
      );
    } else {
      return null;
    }
  }

  renderFooter() {
    return (
      <bem.AssetsTable__footer>
        {this.props.totalAssets !== null &&
          <span>
            {t('##count## items available').replace('##count##', this.props.totalAssets)}
          </span>
        }

        {this.renderPagination()}
      </bem.AssetsTable__footer>
    );
  }

  render() {
    return (
      <bem.AssetsTable m={this.props.context}>
        <bem.AssetsTable__header>
          <bem.AssetsTableRow m='header'>
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('icon-status'))}
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('name'))}
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('owner'))}
            {this.props.context === ASSETS_TABLE_CONTEXTS.get('public-collections') &&
              this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('subscribers-count'))
            }
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('organization'))}
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('languages'))}
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('primary-sector'))}
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('country'))}
            {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('date-modified'))}
          </bem.AssetsTableRow>
        </bem.AssetsTable__header>

        <bem.AssetsTable__body>
          {this.props.isLoading &&
            renderLoading()
          }

          {!this.props.isLoading && this.props.assets.length === 0 &&
            <bem.AssetsTableRow m='empty-message'>
              {t('There are no assets to display.')}
            </bem.AssetsTableRow>
          }

          {!this.props.isLoading && this.props.assets.map((asset) => {
            return (
              <AssetsTableRow
                asset={asset}
                key={asset.uid}
                context={this.props.context}
              />
            );
          })}
        </bem.AssetsTable__body>

        {this.renderFooter()}
      </bem.AssetsTable>
    );
  }
}

export const ASSETS_TABLE_CONTEXTS = new Map();
new Set([
  'my-library',
  'collection-content',
  'public-collections'
]).forEach((name) => {ASSETS_TABLE_CONTEXTS.set(name, name);});

export const ORDER_DIRECTIONS = new Map();
new Set([
  'ascending',
  'descending'
]).forEach((name) => {ORDER_DIRECTIONS.set(name, name);});

/**
 * @typedef AssetsTableColumn
 * @prop {string} label
 * @prop {string} id
 * @prop {string} [filterBy] - a backend filter property
 * @prop {string} [orderBy] - a backend order property
 * @prop {boolean} [defaultValue]
 */
export const ASSETS_TABLE_COLUMNS = new Map([
  [
    'icon-status', {
      label: null,
      id: 'icon-status',
      orderBy: 'asset_type',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'date-modified', {
      label: t('Last Modified'),
      id: 'date-modified',
      orderBy: 'date_modified',
      defaultValue: ORDER_DIRECTIONS.get('descending')
    }
  ],
  [
    'name', {
      label: t('Name'),
      id: 'name',
      orderBy: 'name',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'owner', {
      label: t('Owner'),
      id: 'owner',
      orderBy: 'owner__username',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'subscribers-count', {
      label: t('Subscribers'),
      id: 'subscribers-count',
      orderBy: 'subscribers_count',
      defaultValue: ORDER_DIRECTIONS.get('ascending')
    }
  ],
  [
    'languages', {
      label: t('Languages'),
      id: 'languages',
      filterBy: 'summary__languages'
    }
  ],
  [
    'organization', {
      label: t('Organization'),
      id: 'organization',
      filterBy: 'settings__organization'
    }
  ],
  [
    'primary-sector', {
      label: t('Primary Sector'),
      id: 'primary-sector',
      filterBy: 'settings__sector_label'
    }
  ],
  [
    'country', {
      label: t('Country'),
      id: 'country',
      filterBy: 'settings__country__label'
    }
  ],
]);

/**
 * @callback columnChangeCallback
 * @param {AssetsTableColumn} column
 * @param {string} columnValue
 */

/**
 * @callback switchPageCallback
 * @param {string} pageNumber
 */
