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

const COLUMNS = new Map([
  ['collection', {label: t('Collection'), id: 'collection'}],
  ['country', {label: t('Country'), id: 'country'}],
  ['icon', {label: null, id: 'icon'}],
  ['last-modified', {label: t('Last Modified'), id: 'last-modified'}],
  ['name', {label: t('Name'), id: 'name'}],
  ['owner', {label: t('Owner'), id: 'owner'}],
  ['primary-sector', {label: t('Primary Sector'), id: 'primary-sector'}],
  ['status', {label: t('Status'), id: 'status'}]
]);

/**
 * Displays a table of assets.
 *
 * @prop {string} [emptyMessage]
 * @prop {Array<object>} assets - list of assets to be displayed.
 * @prop {string} context - one of ASSETS_TABLE_CONTEXTS.
 */
export class AssetsTable extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      orderBy: COLUMNS.get('name').id,
      isOrderAsc: true
    };
    autoBind(this);
  }

  reorder(columnId) {
    if (this.state.orderBy === columnId) {
      // clicking already selected column results in switching the order direction
      this.setState({isOrderAsc: !this.state.isOrderAsc});
    } else {
      this.setState({
        orderBy: columnId,
        isOrderAsc: true
      });
    }
  }

  renderHeaderColumn(columnDef) {
    // empty icon to take up space in column
    let icon = (<i className='k-icon'/>);
    if (this.state.orderBy === columnDef.id) {
      if (this.state.isOrderAsc) {
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
          {this.renderHeaderColumn(COLUMNS.get('icon'))}
          {this.renderHeaderColumn(COLUMNS.get('name'))}
          {this.renderHeaderColumn(COLUMNS.get('owner'))}
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(COLUMNS.get('status'))
          }
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(COLUMNS.get('collection'))
          }
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(COLUMNS.get('primary-sector'))
          }
          {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
            this.renderHeaderColumn(COLUMNS.get('country'))
          }
          {this.renderHeaderColumn(COLUMNS.get('last-modified'))}
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
