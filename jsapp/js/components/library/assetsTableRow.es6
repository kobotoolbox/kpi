import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import AssetActionButtons from './assetActionButtons';
import {AssetName} from 'js/ui';
import {formatTime} from 'js/utils';
import {
  getAssetIcon,
  getAssetOwnerDisplayName
} from 'js/assetUtils';
import {ASSETS_TABLE_CONTEXTS} from './assetsTable';

class AssetsTableRow extends React.Component {
  constructor(props){
    super(props);
    autoBind(this);
  }

  render() {
    let iconClassName = '';
    if (this.props.asset) {
      iconClassName = getAssetIcon(this.props.asset);
    }

    console.debug('assetsTableRow', this.props.asset);

    return (
      <bem.AssetsTableRow m='asset'>
        <bem.AssetsTableRow__link href={`#/library/asset/${this.props.asset.uid}`}/>

        <bem.AssetsTableRow__buttons>
          <AssetActionButtons asset={this.props.asset}/>
        </bem.AssetsTableRow__buttons>

        <bem.AssetsTableRow__column m='icon'>
          {this.props.asset.questionCount &&
            <i className={`k-icon ${iconClassName}`} data-counter={this.props.asset.questionCount}/>
          }
          {!this.props.asset.questionCount &&
            <i className={`k-icon ${iconClassName}`}/>
          }
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='name'>
          <AssetName {...this.props.asset}/>

          {this.props.asset.settings && this.props.asset.settings.tags && this.props.asset.settings.tags.length > 0 &&
            <bem.AssetsTableRow__tags>
              {this.props.asset.settings.tags.map((tag) => {
                return ([' ', <bem.AssetsTableRow__tag key={tag}>{tag}</bem.AssetsTableRow__tag>]);
              })}
            </bem.AssetsTableRow__tags>
          }
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='owner'>
          {getAssetOwnerDisplayName(this.props.asset.owner__username)}
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
          {formatTime(this.props.asset.date_modified)}
        </bem.AssetsTableRow__column>
      </bem.AssetsTableRow>
    );
  }
}

export default AssetsTableRow;
