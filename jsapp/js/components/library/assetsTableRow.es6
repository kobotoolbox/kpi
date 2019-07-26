import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {t} from 'js/utils';
import {ASSETS_TABLE_CONTEXTS} from './assetsTable';

class AssetsTableRow extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    return (
      <bem.AssetsTableRow m='asset'>
        <bem.AssetsTableRow__link href='#'/>

        <bem.AssetsTableRow__buttons>
          buttons
        </bem.AssetsTableRow__buttons>

        <bem.AssetsTableRow__column m='icon'>
          <i className='k-icon k-icon-folder'/>
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='name'>
          name {this.props.asset.uid}
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='owner'>
          owner {this.props.asset.uid}
        </bem.AssetsTableRow__column>

        {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
          <bem.AssetsTableRow__column m='status'>
            status {this.props.asset.uid}
          </bem.AssetsTableRow__column>
        }

        {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
          <bem.AssetsTableRow__column m='collection'>
            collection {this.props.asset.uid}
          </bem.AssetsTableRow__column>
        }

        {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
          <bem.AssetsTableRow__column m='primary-sector'>
            primary-sector {this.props.asset.uid}
          </bem.AssetsTableRow__column>
        }

        {this.props.context === ASSETS_TABLE_CONTEXTS.get('default') &&
          <bem.AssetsTableRow__column m='country'>
            country {this.props.asset.uid}
          </bem.AssetsTableRow__column>
        }

        <bem.AssetsTableRow__column m='last-modified'>
          last-modified {this.props.asset.uid}
        </bem.AssetsTableRow__column>
      </bem.AssetsTableRow>
    );
  }
}

export default AssetsTableRow;
