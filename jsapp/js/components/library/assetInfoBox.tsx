import React from 'react';
import bem from 'js/bem';
import {actions} from 'js/actions';
import sessionStore from 'js/stores/session';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {
  notify,
  formatTime,
} from 'js/utils';
import './assetInfoBox.scss';
import type {AssetResponse, AccountResponse} from 'js/dataInterface';
import Button from 'js/components/common/button';

interface AssetInfoBoxProps {
  asset: AssetResponse;
}

interface AssetInfoBoxState {
  areDetailsVisible: boolean;
  ownerData: AccountResponse | {username: string; date_joined: string} | null;
}

/**
 * Displays some meta information about given asset.
 */
export default class AssetInfoBox extends React.Component<
  AssetInfoBoxProps,
  AssetInfoBoxState
> {
  private unlisteners: Function[] = [];

  constructor(props: AssetInfoBoxProps){
    super(props);
    this.state = {
      areDetailsVisible: false,
      ownerData: null,
    };
  }

  componentDidMount() {
    if (!assetUtils.isSelfOwned(this.props.asset)) {
      this.unlisteners.push(
        actions.misc.getUser.completed.listen(this.onGetUserCompleted.bind(this)),
        actions.misc.getUser.failed.listen(this.onGetUserFailed.bind(this))
      )
      actions.misc.getUser(this.props.asset.owner);
    } else {
      this.setState({ownerData: sessionStore.currentAccount});
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  toggleDetails() {
    this.setState({areDetailsVisible: !this.state.areDetailsVisible});
  }

  onGetUserCompleted(userData: AccountResponse) {
    this.setState({ownerData: userData});
  }

  onGetUserFailed() {
    notify(t('Failed to get owner data.'), 'error');
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    return (
      <bem.AssetInfoBox>
        <bem.AssetInfoBox__column>
          <bem.AssetInfoBox__cell>
            <label>{t('Date Created')}</label>
            {formatTime(this.props.asset.date_created)}
          </bem.AssetInfoBox__cell>

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Last Modified')}</label>
            {formatTime(this.props.asset.date_modified)}
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Owner')}</label>
            {assetUtils.getAssetOwnerDisplayName(this.props.asset.owner_label)}
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Description')}</label>
            <div dir='auto'>
              {this.props.asset.settings.description || '-'}
            </div>
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Tags')}</label>
            {this.props.asset.tag_string && this.props.asset.tag_string.split(',').join(', ') || '-'}
          </bem.AssetInfoBox__cell>
          }
        </bem.AssetInfoBox__column>

        <bem.AssetInfoBox__column>
          <bem.AssetInfoBox__cell>
            {this.props.asset.asset_type === ASSET_TYPES.collection.id &&
              <React.Fragment>
                <label>{t('Items')}</label>
                {this.props.asset.children.count || 0}
              </React.Fragment>
            }
            {this.props.asset.asset_type !== ASSET_TYPES.collection.id &&
              <React.Fragment>
                <label>{t('Questions')}</label>
                {this.props.asset.summary.row_count || 0}
              </React.Fragment>
            }
          </bem.AssetInfoBox__cell>

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Organization')}</label>
            {assetUtils.getOrganizationDisplayString(this.props.asset)}
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Sector')}</label>
            {assetUtils.getSectorDisplayString(this.props.asset)}
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Country')}</label>
            {assetUtils.getCountryDisplayString(this.props.asset)}
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Languages')}</label>
            {assetUtils.getLanguagesDisplayString(this.props.asset)}
          </bem.AssetInfoBox__cell>
          }
        </bem.AssetInfoBox__column>

        <bem.AssetInfoBox__column m='toggle'>
          <Button
            type='text'
            size='s'
            onClick={this.toggleDetails.bind(this)}
            startIcon={this.state.areDetailsVisible ? 'angle-up' : 'angle-down'}
            label={this.state.areDetailsVisible ? t('Hide full details') : t('Show full details')}
          />
        </bem.AssetInfoBox__column>
      </bem.AssetInfoBox>
    );
  }
}
