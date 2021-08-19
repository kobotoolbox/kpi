import React from 'react';
import autoBind from 'react-autobind';
import bem from 'js/bem';
import {actions} from 'js/actions';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {
  notify
} from 'js/utils';

/**
 * @prop asset
 */
class AssetPublicButton extends React.Component {
  constructor(props){
    super(props);
    this.state = {
      isPublicPending: false,
      isAwaitingFreshPermissions: false
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.permissions.setAssetPublic.completed.listen(this.onSetAssetPublicCompleted);
    actions.permissions.setAssetPublic.failed.listen(this.onSetAssetPublicFailed);
  }

  componentWillReceiveProps() {
    this.setState({isAwaitingFreshPermissions: false});
  }

  onSetAssetPublicCompleted(assetUid) {
    if (this.props.asset.uid === assetUid) {
      this.setState({
        isPublicPending: false,
        isAwaitingFreshPermissions: true,
      });
    }
  }

  onSetAssetPublicFailed(assetUid) {
    if (this.props.asset.uid === assetUid) {
      this.setState({isPublicPending: false});
      notify(t('Failed to change asset public status.'), 'error');
    }
  }

  makePublic() {
    const publicReadyErrors = assetUtils.isAssetPublicReady(this.props.asset);

    if (publicReadyErrors.length === 0) {
      this.setState({isPublicPending: true});
      actions.permissions.setAssetPublic(this.props.asset, true);
    } else {
      publicReadyErrors.forEach((err) => {notify(err, 'error');});
    }
  }

  makePrivate() {
    this.setState({isPublicPending: true});
    actions.permissions.setAssetPublic(this.props.asset, false);
  }

  isSetPublicButtonDisabled() {
    return this.state.isPublicPending || this.state.isAwaitingFreshPermissions;
  }

  render() {
    if (!this.props.asset) {
      return null;
    }

    const isPublicable = this.props.asset.asset_type === ASSET_TYPES.collection.id;
    const isPublic = isPublicable && assetUtils.isAssetPublic(this.props.asset.permissions);
    const isSelfOwned = assetUtils.isSelfOwned(this.props.asset);

    if (!isPublicable || !isSelfOwned) {
      return null;
    }

    return (
      <React.Fragment>
        {/* NOTE: this button is purposely available for not ready
        collections as a means to teach users (via error notifications). */}
        {!isPublic &&
          <bem.AssetActionButtons__button
            m='on'
            onClick={this.makePublic}
            disabled={this.isSetPublicButtonDisabled()}
          >
            <i className='k-icon k-icon-globe-alt'/>
            {t('Make public')}
          </bem.AssetActionButtons__button>
        }
        {isPublic &&
          <bem.AssetActionButtons__button
            m='off'
            onClick={this.makePrivate}
            disabled={this.isSetPublicButtonDisabled()}
          >
            <i className='k-icon k-icon-close'/>
            {t('Make private')}
          </bem.AssetActionButtons__button>
        }
      </React.Fragment>
    );
  }
}

export default AssetPublicButton;
