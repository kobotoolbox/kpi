import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import bem from 'js/bem';
import {actions} from 'js/actions';
import {stores} from 'js/stores';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {
  notify,
  formatTime,
} from 'utils';
import './assetInfoBox.scss';

/**
 * @prop asset
 */
class AssetInfoBox extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      areDetailsVisible: false,
      ownerData: null,
    };
    autoBind(this);
  }

  componentDidMount() {
    if (!assetUtils.isSelfOwned(this.props.asset)) {
      this.listenTo(actions.misc.getUser.completed, this.onGetUserCompleted);
      this.listenTo(actions.misc.getUser.failed, this.onGetUserFailed);
      actions.misc.getUser(this.props.asset.owner);
    } else {
      this.setState({ownerData: stores.session.currentAccount});
    }
  }

  toggleDetails() {
    this.setState({areDetailsVisible: !this.state.areDetailsVisible});
  }

  onGetUserCompleted(userData) {
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
            {assetUtils.getAssetOwnerDisplayName(this.props.asset.owner__username)}
          </bem.AssetInfoBox__cell>
          }

          {this.state.areDetailsVisible &&
          <bem.AssetInfoBox__cell>
            <label>{t('Description')}</label>
            {this.props.asset.settings.description || '-'}
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
            {assetUtils.getCountryDisplayString(this.props.asset, true)}
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
          <bem.AssetInfoBox__toggle onClick={this.toggleDetails}>
            {this.state.areDetailsVisible ? <i className='k-icon k-icon-up'/> : <i className='k-icon k-icon-down'/>}
            {this.state.areDetailsVisible ? t('Hide full details') : t('Show full details')}
          </bem.AssetInfoBox__toggle>
        </bem.AssetInfoBox__column>
      </bem.AssetInfoBox>
    );
  }
}

reactMixin(AssetInfoBox.prototype, Reflux.ListenerMixin);

export default AssetInfoBox;
