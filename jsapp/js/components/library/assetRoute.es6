import _ from 'underscore';
import clonedeep from 'lodash.clonedeep';
import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import DocumentTitle from 'react-document-title';
import {bem} from 'js/bem';
import mixins from 'js/mixins';
import {actions} from 'js/actions';
import {ASSET_TYPES, ACCESS_TYPES} from 'js/constants';
import AssetActionButtons from './assetActionButtons';
import AssetInfoBox from './assetInfoBox';
import AssetContentSummary from './assetContentSummary';
import CollectionAssetsTable from './collectionAssetsTable';
import {renderLoading} from 'js/components/modalForms/modalHelpers';
import { dataInterface } from '../../dataInterface.es6';

class AssetRoute extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset: false,
      isUserSubscribed: false
    };
    this.unlisteners = [];
    autoBind(this);
  }

  componentDidMount() {
    this.unlisteners.push(
      actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted),
      actions.library.subscribeToCollection.completed.listen(this.onSubscribeToCollectionCompleted),
      actions.library.unsubscribeFromCollection.completed.listen(this.onUnsubscribeFromCollectionCompleted),
      actions.resources.loadAsset.completed.listen(this.onAssetChanged),
      actions.resources.updateAsset.completed.listen(this.onAssetChanged),
      actions.resources.cloneAsset.completed.listen(this.onAssetChanged),
      actions.resources.createResource.completed.listen(this.onAssetChanged),
    );
    this.loadCurrentAsset();
  }

  componentWillUnmount() {
    this.unlisteners.forEach((clb) => {clb();});
  }

  componentWillReceiveProps(nextProps) {
    // trigger loading when switching assets
    if (nextProps.params.uid !== this.props.params.uid) {
      this.setState({asset: false});
      this.loadCurrentAsset();
    }
  }

  loadCurrentAsset() {
    const uid = this.currentAssetID();
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }

  onSubscribeToCollectionCompleted() {
    this.setState({isUserSubscribed: true});
  }

  onUnsubscribeFromCollectionCompleted() {
    this.setState({isUserSubscribed: false});
  }

  onMoveToCollectionCompleted(asset) {
    if (asset.parent === null) {
      this.onAssetRemoved(asset.uid);
    } else {
      this.onAssetChanged(asset);
    }
  }

  onAssetChanged(asset) {
    if (asset.uid === this.currentAssetID()) {
      this.setState({
        asset: asset,
        isUserSubscribed: asset.access_types && asset.access_types.includes(ACCESS_TYPES.subscribed)
      });
    }
  }

  goBack() {
    hashHistory.goBack();
  }

  render() {
    if (this.state.asset === false) {
      return renderLoading();
    }

    const docTitle = this.state.asset.name || t('Untitled');

    return (
      <DocumentTitle title={`${docTitle} | KoboToolbox`}>
        <bem.FormView m='form'>
          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m={['stretch', 'back-button']}>
                <bem.FormView__iconButton onClick={this.goBack}>
                  <i className='k-icon k-icon-prev' />
                  {t('Back')}
                </bem.FormView__iconButton>
              </bem.FormView__cell>

              {this.state.isUserSubscribed &&
                <bem.FormView__cell m='subscribed-badge'>
                  <i className='k-icon k-icon-check-circle' />
                  {t('Subscribed')}
                </bem.FormView__cell>
              }

              <AssetActionButtons asset={this.state.asset}/>
            </bem.FormView__cell>

            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {t('Details')}
              </bem.FormView__cell>
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
              <bem.FormView__cell m={['columns', 'first']}>
                <bem.FormView__cell m='label'>
                  {t('Collection Content')}
                </bem.FormView__cell>
              </bem.FormView__cell>

              <bem.FormView__cell m='box'>
                <CollectionAssetsTable asset={this.state.asset}/>
              </bem.FormView__cell>
            </bem.FormView__row>
          }
        </bem.FormView>
      </DocumentTitle>
    );
  }
}

reactMixin(AssetRoute.prototype, mixins.contextRouter);
reactMixin(AssetRoute.prototype, Reflux.ListenerMixin);

AssetRoute.contextTypes = {
  router: PropTypes.object
};

export default AssetRoute;
