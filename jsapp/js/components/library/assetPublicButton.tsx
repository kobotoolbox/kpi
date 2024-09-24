import React from 'react';
import bem from 'js/bem';
import {actions} from 'js/actions';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import {notify} from 'js/utils';
import Button from 'js/components/common/button';
import type {AssetResponse} from 'js/dataInterface';

interface AssetPublicButtonProps {
  asset: AssetResponse;
}

interface AssetPublicButtonState {
  isPublicPending: boolean;
  /**
   * After asset public state is changed, we wait for the asset to be loaded
   * again, so that we know from the permissions `assetUtils.isAssetPublic`.
   */
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
        // Public state of asset changed, now we await fresh permissions
        isAwaitingFreshPermissions: true,
      });

      // We need to get fresh asset here, so that new permissions would be
      // available for the button code. We rely on the fact that new asset
      // would be passed through `props` and `componentWillReceiveProps` will
      // unlock the button again.
      //
      // TODO: this flow should be improved, but it might require some more
      // thought, as the asset data flow in the whole app should be redone
      // (after very thorough planning). Unfortunately many places in the app
      // have this problem.
      actions.resources.loadAsset({id: this.props.asset.uid}, true);
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

  render() {
    if (!this.props.asset) {
      return null;
    }

    const isPublicable = this.props.asset.asset_type === ASSET_TYPES.collection.id;
    const isPublic = isPublicable && assetUtils.isAssetPublic(this.props.asset.permissions);
    const isSelfOwned = assetUtils.isSelfOwned(this.props.asset);
    const isButtonPending = this.state.isPublicPending || this.state.isAwaitingFreshPermissions;

    if (!isPublicable || !isSelfOwned) {
      return null;
    }

    // NOTE: this button is purposely made available for collections that are
    // not ready yet (i.e. the required metadata of the collection is empty),
    // as we display an error notification that teaches users what to do.
    if (!isPublic) {
      return (
        <Button
          type='secondary'
          size='m'
          startIcon='globe-alt'
          label={t('Make public')}
          onClick={this.makePublic.bind(this)}
          isPending={isButtonPending}
        />
      );
    } else {
      return (
        <Button
          type='secondary-danger'
          size='m'
          startIcon='close'
          label={t('Make private')}
          onClick={this.makePrivate.bind(this)}
          isPending={isButtonPending}
        />
      );
    }
  }
}
