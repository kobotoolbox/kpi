import React from 'react';
import clonedeep from 'lodash.clonedeep';
import DocumentTitle from 'react-document-title';
import bem from 'js/bem';
import {actions} from 'js/actions';
import assetUtils from 'js/assetUtils';
import {ASSET_TYPES, ACCESS_TYPES} from 'js/constants';
import AssetActionButtons from 'js/components/assetsTable/assetActionButtons';
import AssetInfoBox from './assetInfoBox';
import AssetPublicButton from './assetPublicButton';
import AssetBreadcrumbs from './assetBreadcrumbs';
import AssetContentSummary from './assetContentSummary';
import CollectionAssetsTable from 'js/components/library/collectionAssetsTable';
import LoadingSpinner from 'js/components/common/loadingSpinner';
import {getRouteAssetUid} from 'js/router/routerUtils';
import type {AssetResponse} from 'js/dataInterface';

interface AssetRouteProps {
  params: {
    uid: string;
  }
}

interface AssetRouteState {
  asset: AssetResponse | undefined;
}

export default class AssetRoute extends React.Component<
  AssetRouteProps,
  AssetRouteState
> {
  private unlisteners: Function[] = [];

  constructor(props: AssetRouteProps) {
    super(props);

    this.state = {
      asset: undefined,
    };
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.library.moveToCollection.completed.listen(this.onAssetChanged.bind(this)),
      actions.library.subscribeToCollection.completed.listen(this.onSubscribeToCollectionCompleted.bind(this)),
      actions.library.unsubscribeFromCollection.completed.listen(this.onUnsubscribeFromCollectionCompleted.bind(this)),
      actions.resources.loadAsset.completed.listen(this.onAssetChanged.bind(this)),
      actions.resources.updateAsset.completed.listen(this.onAssetChanged.bind(this)),
      actions.resources.cloneAsset.completed.listen(this.onAssetChanged.bind(this)),
      actions.resources.createResource.completed.listen(this.onAssetChanged.bind(this)),
    );
    this.loadCurrentAsset();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  componentWillReceiveProps(nextProps: AssetRouteProps) {
    // trigger loading when switching assets
    if (nextProps.params.uid !== this.props.params.uid) {
      this.setState({asset: undefined});
      this.loadCurrentAsset();
    }
  }

  loadCurrentAsset() {
    const uid = getRouteAssetUid();
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }

  onSubscribeToCollectionCompleted() {
    this.onAssetAccessTypeChanged(true);
  }

  onUnsubscribeFromCollectionCompleted() {
    this.onAssetAccessTypeChanged(false);
  }

  /**
   * This updates the local asset object, avoiding the need to fetch whole thing
   * from Back End.
   */
  onAssetAccessTypeChanged(setSubscribed: boolean) {
    const newAsset = clonedeep(this.state.asset);
    if (newAsset) {
      if (setSubscribed && newAsset.access_types === null) {
        newAsset.access_types = [ACCESS_TYPES.subscribed];
      } else if (setSubscribed && newAsset.access_types !== null) {
        newAsset.access_types.push(ACCESS_TYPES.subscribed);
      } else if (!setSubscribed && newAsset.access_types !== null) {
        // Remove any 'subscribed' item from the array. There is a bug where
        // duplicated items are present in the array, so we need to make sure
        // all of them are removed.
        newAsset.access_types = newAsset.access_types.filter((item) => item !== ACCESS_TYPES.subscribed);

        // Cleanup if empty array is left
        if (newAsset.access_types.length === 0) {
          newAsset.access_types = null;
        }
      }

      this.setState({asset: newAsset});
    }
  }

  onAssetChanged(asset: AssetResponse) {
    if (asset.uid === getRouteAssetUid()) {
      this.setState({asset: asset});
    }
  }

  render() {
    if (!this.state.asset) {
      return (<LoadingSpinner/>);
    }

    const assetName = assetUtils.getAssetDisplayName(this.state.asset);
    const isUserSubscribed = this.state.asset.access_types && this.state.asset.access_types.includes(ACCESS_TYPES.subscribed);

    return (
      <DocumentTitle title={`${assetName.final} | KoboToolbox`}>
        <bem.FormView m='library-asset'>
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'columns-right', 'first']}>
              {isUserSubscribed &&
                <bem.FormView__cell m='subscribed-badge'>
                  <i className='k-icon k-icon-folder-subscribed' />
                  {t('Subscribed')}
                </bem.FormView__cell>
              }

              <AssetPublicButton asset={this.state.asset}/>

              <AssetActionButtons asset={this.state.asset}/>
            </bem.FormView__cell>

            <bem.FormView__cell m='first'>
              <AssetBreadcrumbs asset={this.state.asset}/>
            </bem.FormView__cell>

            <AssetInfoBox asset={this.state.asset}/>
          </bem.FormView__row>

          {this.state.asset.asset_type !== ASSET_TYPES.collection.id &&
            <bem.FormView__row>
              <bem.FormView__cell m={['columns', 'first']}>
                <bem.FormView__cell m='label'>
                  {t('Quick look')}
                </bem.FormView__cell>
              </bem.FormView__cell>

              <AssetContentSummary asset={this.state.asset}/>
            </bem.FormView__row>
          }

          {this.state.asset.asset_type === ASSET_TYPES.collection.id &&
            <bem.FormView__row>
              <bem.FormView__cell m={['box', 'bordered', 'assets-table-wrapper']}>
                <CollectionAssetsTable asset={this.state.asset}/>
              </bem.FormView__cell>
            </bem.FormView__row>
          }
        </bem.FormView>
      </DocumentTitle>
    );
  }
}
