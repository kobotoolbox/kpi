import _ from 'underscore';
import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import {bem} from 'js/bem';
import mixins from 'js/mixins';
import {actions} from 'js/actions';
import {t} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';
import AssetActionButtons from './assetActionButtons';
import AssetInfoBox from './assetInfoBox';
import AssetContentSummary from './assetContentSummary';
import CollectionAssetsTable from './collectionAssetsTable';
import {renderLoading} from 'js/components/modalForms/modalHelpers';

class LibraryAsset extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset: false
    };
    autoBind(this);
  }

  componentDidMount() {
    actions.library.moveToCollection.completed.listen(this.onMoveToCollectionCompleted);
    actions.resources.loadAsset.completed.listen(this.onAssetChanged);
    actions.resources.updateAsset.completed.listen(this.onAssetChanged);
    actions.resources.cloneAsset.completed.listen(this.onAssetChanged);
    actions.resources.createResource.completed.listen(this.onAssetChanged);
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted);

    this.loadCurrentAsset();
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

  onMoveToCollectionCompleted(asset) {
    if (asset.parent === null) {
      this.onAssetRemoved(asset.uid);
    } else {
      this.onAssetChanged(asset);
    }
  }

  onDeleteAssetCompleted({uid}) {
    this.onAssetRemoved(uid);
  }

  onAssetRemoved(assetUid) {
    if (
      this.state.asset &&
      this.state.asset.asset_type === ASSET_TYPES.collection.id &&
      this.state.asset.children.results.length !== 0
    ) {
      let newChildren;
      const index = _.findIndex(this.state.asset.children.results, {uid: assetUid});
      if (index !== -1) {
        newChildren = Array.from(this.state.asset.children.results);
        newChildren.splice(index, 1);
      }

      if (newChildren) {
        const updatedAsset = this.state.asset;
        updatedAsset.children.results = newChildren;
        this.setState({asset: updatedAsset});
      }
    }
  }

  onAssetChanged(asset) {
    if (asset.uid === this.currentAssetID()) {
      this.setState({asset: asset});
    } else if (
      this.state.asset &&
      this.state.asset.asset_type === ASSET_TYPES.collection.id &&
      asset.parent === this.state.asset.url
    ) {
      const updatedAsset = this.state.asset;
      const newChildren = Array.from(updatedAsset.children.results);
      const index = _.findIndex(updatedAsset.children.results, {uid: asset.uid});
      if (index === -1) {
        newChildren[index] = asset;
      } else {
        newChildren.push(asset);
      }
      updatedAsset.children.results = newChildren;
      this.setState({asset: updatedAsset});
    }
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
              <bem.FormView__cell m='label'>
                {t('Details')}
              </bem.FormView__cell>

              <AssetActionButtons asset={this.state.asset}/>
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

reactMixin(LibraryAsset.prototype, mixins.contextRouter);
reactMixin(LibraryAsset.prototype, Reflux.ListenerMixin);

LibraryAsset.contextTypes = {
  router: PropTypes.object
};

export default LibraryAsset;
