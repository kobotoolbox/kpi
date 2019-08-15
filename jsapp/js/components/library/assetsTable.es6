import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {t} from 'js/utils';
import AssetsTableRow from './assetsTableRow';

export const ASSETS_TABLE_CONTEXTS = new Map([
  // default displays all available columns
  ['default', 'default'],
  // collection-content displays only a few columns
  ['collection-content', 'collection-content']
]);

/**
 * @typedef AssetsTableColumn
 * @prop {string} label
 * @prop {string} id
 * @prop {string} backendProp - path to property data (for ordering)
 * @prop {boolean} defaultIsOrderAsc
 */
export const ASSETS_TABLE_COLUMNS = new Map([
  [
    'collection', {
      label: t('Collection'),
      id: 'collection',
      backendProp: 'parent',
      defaultIsOrderAsc: true
    }
  ],
  [
    'country', {
      label: t('Country'),
      id: 'country',
      backendProp: 'settings.country',
      defaultIsOrderAsc: true
    }
  ],
  [
    'icon', {
      label: null,
      id: 'icon',
      backendProp: 'asset_type',
      defaultIsOrderAsc: true
    }
  ],
  [
    'last-modified', {
      label: t('Last Modified'),
      id: 'last-modified',
      backendProp: 'date_modified',
      defaultIsOrderAsc: false
    }
  ],
  [
    'name', {
      label: t('Name'),
      id: 'name',
      backendProp: 'name',
      defaultIsOrderAsc: true
    }
  ],
  [
    'owner', {
      label: t('Owner'),
      id: 'owner',
      backendProp: 'owner__username',
      defaultIsOrderAsc: true
    }
  ],
  [
    'primary-sector', {
      label: t('Primary Sector'),
      id: 'primary-sector',
      backendProp: 'settings.sector',
      defaultIsOrderAsc: true
    }
  ],
  [
    'status', {
      label: t('Status'),
      id: 'status',
      // TODO: How should this work? Currently status is being built by multiple pieces of data.
      backendProp: null,
      defaultIsOrderAsc: true
    }
  ]
]);

/**
 * @callback reorderCallback
 * @param {AssetsTableColumn} orderBy
 * @param {boolean} isOrderAsc
 */

/**
 * Displays a table of assets.
 *
 * @prop {string} [emptyMessage] - To replace the default empty message.
 * @prop {Array<object>} assets - List of assets to be displayed.
 * @prop {string} context - One of ASSETS_TABLE_CONTEXTS.
 * @prop {AssetsTableColumn} orderBy - Current order column, one of ASSETS_TABLE_COLUMNS.
 * @prop {boolean} isOrderAsc - Current order direction.
 * @prop {reorderCallback} onReorder - Called when the user clicks column header for reordering.
 */
export class AssetsTable extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  /**
   * This function is only a callback handler, as the asset reordering itself
   * should be handled by the component that is providing the assets list.
   * @param {string} columnId
   */
  reorder(columnId) {
    if (this.props.orderBy.id === columnId) {
      // clicking already selected column results in switching the order direction
      this.props.onReorder(this.props.orderBy, !this.props.isOrderAsc);
    } else {
      // change column and revert order direction to ascending
      const newColumn = ASSETS_TABLE_COLUMNS.get(columnId);
      this.props.onReorder(newColumn, newColumn.defaultIsOrderAsc);
    }
  }

  renderHeaderColumn(columnDef) {
    // empty icon to take up space in column
    let icon = (<i className='k-icon'/>);
    if (this.props.orderBy.id === columnDef.id) {
      if (this.props.isOrderAsc) {
        icon = (<i className='k-icon k-icon-up'/>);
      } else {
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

  renderFooter() {
    return (
      <bem.AssetsTableRow m='footer'>
        <bem.AssetsTableRow__column>
          <span>
            {t('##count## items available').replace('##count##', this.props.assets.length)}
          </span>
        </bem.AssetsTableRow__column>
      </bem.AssetsTableRow>
    );
  }

  render() {
    return (
      <bem.AssetsTable m={this.props.context}>
        <bem.AssetsTableRow m='header'>
          {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('icon'))}
          {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('name'))}
          {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('owner'))}
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('status'))
          }
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('collection'))
          }
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('primary-sector'))
          }
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('country'))
          }
          {this.renderHeaderColumn(ASSETS_TABLE_COLUMNS.get('last-modified'))}
        </bem.AssetsTableRow>

        {this.props.assets.length === 0 &&
          <bem.AssetsTableRow m='empty-message'>
            {this.props.emptyMessage || t('There are no assets to display.')}
          </bem.AssetsTableRow>
        }

        {this.props.assets.map((asset) => {
          return (
            <AssetsTableRow
              asset={asset}
              key={asset.uid}
              context={this.props.context}
            />
          );
        })}

        {this.renderFooter()}
      </bem.AssetsTable>
    );
  }
}
