import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {t} from 'js/utils';
import AssetsTableRow from './assetsTableRow';

export const ASSETS_TABLE_COLUMNS = new Map([
  ['collection', {label: t('Collection'), id: 'collection'}],
  ['country', {label: t('Country'), id: 'country'}],
  ['icon', {label: null, id: 'icon'}],
  ['last-modified', {label: t('Last Modified'), id: 'last-modified'}],
  ['name', {label: t('Name'), id: 'name'}],
  ['owner', {label: t('Owner'), id: 'owner'}],
  ['primary-sector', {label: t('Primary Sector'), id: 'primary-sector'}],
  ['status', {label: t('Status'), id: 'status'}]
]);

export class AssetsTable extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  renderHeader() {
    return (
      <bem.AssetsTableRow m='header'>
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('icon').id) &&
          <bem.AssetsTableRow__column m='icon'>
            {ASSETS_TABLE_COLUMNS.get('icon').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('name').id) &&
          <bem.AssetsTableRow__column m='name'>
            {ASSETS_TABLE_COLUMNS.get('name').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('owner').id) &&
          <bem.AssetsTableRow__column m='owner'>
            {ASSETS_TABLE_COLUMNS.get('owner').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('status').id) &&
          <bem.AssetsTableRow__column m='status'>
            {ASSETS_TABLE_COLUMNS.get('status').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('collection').id) &&
          <bem.AssetsTableRow__column m='collection'>
            {ASSETS_TABLE_COLUMNS.get('collection').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('primary-sector').id) &&
          <bem.AssetsTableRow__column m='primary-sector'>
            {ASSETS_TABLE_COLUMNS.get('primary-sector').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('country').id) &&
          <bem.AssetsTableRow__column m='country'>
            {ASSETS_TABLE_COLUMNS.get('country').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
        {this.props.columns.includes(ASSETS_TABLE_COLUMNS.get('last-modified').id) &&
          <bem.AssetsTableRow__column m='last-modified'>
            {ASSETS_TABLE_COLUMNS.get('last-modified').label}
            <i className='k-icon k-icon-down'/>
          </bem.AssetsTableRow__column>
        }
      </bem.AssetsTableRow>
    );
  }

  renderFooter() {
    return (
      <bem.AssetsTableRow m='footer'>
        <bem.AssetsTableRow__column>
          footer
        </bem.AssetsTableRow__column>
      </bem.AssetsTableRow>
    );
  }

  render() {
    return (
      <bem.AssetsTable>
        {this.renderHeader()}

        {this.props.assets.length === 0 &&
          <bem.AssetsTableRow m='empty-message'>
            {this.props.emptyMessage || t('There are no assets to display.')}
          </bem.AssetsTableRow>
        }

        {this.props.assets.map((asset) => {
          return (
            <AssetsTableRow
              asset={asset}
              columns={this.props.columns}
            />
          );
        })}

        {this.renderFooter()}
      </bem.AssetsTable>
    );
  }
}
