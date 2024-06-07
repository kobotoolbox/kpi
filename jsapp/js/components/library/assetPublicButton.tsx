import React from 'react';
import bem from 'js/bem';
import {actions} from 'js/actions';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {notify} from 'js/utils';
import type {AssetResponse} from 'js/dataInterface';

interface AssetPublicButtonProps {
  asset: AssetResponse;
}

interface AssetPublicButtonState {
  isPublicPending: boolean;
  isAwaitingFreshPermissions: boolean;
}

/**
 * Button for making asset (works only for `collection` type) public or non-public.
 */
export default class AssetPublicButton extends React.Component<
  AssetPublicButtonProps,
  AssetPublicButtonState
> {
  private unlisteners: Function[] = [];

  constructor(props: AssetPublicButtonProps) {
    super(props);
    this.state = {
      isPublicPending: false,
      isAwaitingFreshPermissions: false
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.permissions.setAssetPublic.completed.listen(this.onSetAssetPublicCompleted.bind(this)),
      actions.permissions.setAssetPublic.failed.listen(this.onSetAssetPublicFailed.bind(this))
    );
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  componentWillReceiveProps() {
    this.setState({isAwaitingFreshPermissions: false});
  }

  onSetAssetPublicCompleted(assetUid: string) {
    if (this.props.asset.uid === assetUid) {
      this.setState({
        isPublicPending: false,
        isAwaitingFreshPermissions: true,
      });
    }
  }

  onSetAssetPublicFailed(assetUid: string) {
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
            onClick={this.makePublic.bind(this)}
            disabled={this.isSetPublicButtonDisabled()}
          >
            <i className='k-icon k-icon-globe-alt'/>
            {t('Make public')}
          </bem.AssetActionButtons__button>
        }
        {isPublic &&
          <bem.AssetActionButtons__button
            m='off'
            onClick={this.makePrivate.bind(this)}
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
