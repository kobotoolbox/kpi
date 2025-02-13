import React from 'react';
import bem from 'js/bem';
import AssetActionButtons from './assetActionButtons';
import AssetName from 'js/components/common/assetName';
import {formatTime} from 'js/utils';
import type {AssetResponse} from 'js/dataInterface';
import {ASSET_TYPES} from 'js/constants';
import assetUtils from 'js/assetUtils';
import type {AssetsTableContextName} from './assetsTableConstants';
import {ASSETS_TABLE_CONTEXTS} from './assetsTableConstants';
import Icon from 'js/components/common/icon';

interface AssetsTableRowProps {
  asset: AssetResponse;
  context: AssetsTableContextName;
}

class AssetsTableRow extends React.Component<AssetsTableRowProps> {
  render() {
    let rowCount = null;
    if (
      this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
      this.props.asset.summary?.row_count
    ) {
      rowCount = this.props.asset.summary.row_count;
    } else if (
      this.props.asset.asset_type === ASSET_TYPES.collection.id &&
      this.props.asset.children
    ) {
      rowCount = this.props.asset.children.count;
    }

    return (
      <bem.AssetsTableRow m={['asset', `type-${this.props.asset.asset_type}`]}>
        <bem.AssetsTableRow__link href={`#/library/asset/${this.props.asset.uid}`}/>

        <bem.AssetsTableRow__buttons>
          <AssetActionButtons asset={this.props.asset}/>
        </bem.AssetsTableRow__buttons>

        <bem.AssetsTableRow__column m='icon-status'>
          <Icon name={assetUtils.getAssetIcon(this.props.asset)} size='l' />
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='name' dir='auto'>
          <AssetName asset={this.props.asset}/>

          {this.props.asset.settings && this.props.asset.tag_string && this.props.asset.tag_string.length > 0 &&
            <bem.AssetsTableRow__tags>
              {this.props.asset.tag_string.split(',').map((tag) =>
                ([' ', <bem.AssetsTableRow__tag key={tag}>{tag}</bem.AssetsTableRow__tag>])
              )}
            </bem.AssetsTableRow__tags>
          }
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='item-count'>
          {rowCount !== null &&
            <bem.AssetsTableRow__tag m='gray-circle'>{rowCount}</bem.AssetsTableRow__tag>
          }
        </bem.AssetsTableRow__column>

        <bem.AssetsTableRow__column m='owner'>
          {assetUtils.getAssetOwnerDisplayName(this.props.asset.owner_label)}
        </bem.AssetsTableRow__column>

        {this.props.context === ASSETS_TABLE_CONTEXTS.PUBLIC_COLLECTIONS &&
          <bem.AssetsTableRow__column m='subscribers-count'>
            {this.props.asset.subscribers_count}
          </bem.AssetsTableRow__column>
        }

        <bem.AssetsTableRow__column m='languages'>
          {assetUtils.getLanguagesDisplayString(this.props.asset)}
        </bem.AssetsTableRow__column>

        {this.props.context === ASSETS_TABLE_CONTEXTS.PUBLIC_COLLECTIONS &&
          <bem.AssetsTableRow__column m='primary-sector'>
            {assetUtils.getSectorDisplayString(this.props.asset)}
          </bem.AssetsTableRow__column>
        }

        <bem.AssetsTableRow__column m='date-modified'>
          {formatTime(this.props.asset.date_modified)}
        </bem.AssetsTableRow__column>
      </bem.AssetsTableRow>
    );
  }
}

export default AssetsTableRow;
