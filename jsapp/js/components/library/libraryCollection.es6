import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import orderBy from 'lodash.orderby';
import bem from 'js/bem';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import {
  t,
  assign
} from 'js/utils';
import {getAssetDisplayName} from 'js/assetUtils';
import {ASSET_TYPES} from 'js/constants';
import AssetActionButtons from './assetActionButtons';
import AssetInfoBox from './assetInfoBox';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS,
  ASSETS_TABLE_COLUMNS
} from './assetsTable';
import {renderLoading} from 'js/components/modalForms/modalHelpers';

const defaultColumn = ASSETS_TABLE_COLUMNS.get('last-modified');

class LibraryCollection extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset: false,
      orderBy: defaultColumn,
      isOrderAsc: defaultColumn.defaultIsOrderAsc
    };
    autoBind(this);
  }

  componentWillReceiveProps(nextProps) {
    // trigger loading message when switching assets
    if (nextProps.params.uid !== this.props.params.uid) {
      this.setState({
        asset: false,
        // reset ordering when switching asset
        orderBy: defaultColumn,
        isOrderAsc: defaultColumn.defaultIsOrderAsc
      });
    }
  }

  componentDidMount() {
    this.listenTo(stores.asset, this.onAssetLoad);

    const uid = this.currentAssetID();
    if (uid) {
      actions.resources.loadAsset({id: uid});
    }
  }

  onAssetLoad(data) {
    const uid = this.currentAssetID();
    const asset = data[uid];
    if (asset) {
      this.setState({asset: asset});
    }
  }

  onAssetsTableReorder(orderBy, isOrderAsc) {
    this.setState({
      orderBy,
      isOrderAsc
    });
  }

  nameOrderFunction(asset) {
    const displayName = getAssetDisplayName(asset);
    if (displayName.empty) {
      // empty ones should be at the end
      return null;
    } else {
      return displayName.final.toLowerCase();
    }
  }

  defaultOrderFunction(asset) {
    return asset[this.state.orderBy.backendProp];
  }

  /**
   * Returns asset children ordered by orderBy and isOrderAsc properties
   * @return {Array}
   */
  getOrderedChildren() {
    let orderFn = this.defaultOrderFunction.bind(this);
    if (this.state.orderBy.id === ASSETS_TABLE_COLUMNS.get('name').id) {
      orderFn = this.nameOrderFunction.bind(this);
    }
    const orderDirection = this.state.isOrderAsc ? 'asc' : 'desc';

    return orderBy(
      this.state.asset.children.results,
      // first order property is the one user chooses
      // second order property is always asset name in ascending direction
      [orderFn, this.nameOrderFunction.bind(this)],
      [orderDirection, 'asc'],
    );
  }

  render() {
    if (this.state.asset === false) {
      return renderLoading();
    }

    const docTitle = this.state.asset.name || t('Untitled');

    // TODO this data should be in the BE response after collection is made
    // a type of asset OR AssetInfoBox should work differently for collections
    const fakeAsset = assign({
      asset_type: ASSET_TYPES.collection.id,
      summary: {
        row_count: 999
      },
      content: {
        translations: []
      },
      settings: {}
    }, this.state.asset);

    const orderedChildren = this.getOrderedChildren();

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

            <AssetInfoBox asset={fakeAsset}/>
          </bem.FormView__row>

          <bem.FormView__row>
            <bem.FormView__cell m={['columns', 'first']}>
              <bem.FormView__cell m='label'>
                {t('Collection Content')}
              </bem.FormView__cell>
            </bem.FormView__cell>

            <bem.FormView__cell m='box'>
              <AssetsTable
                assets={orderedChildren}
                orderBy={this.state.orderBy}
                isOrderAsc={this.state.isOrderAsc}
                onReorder={this.onAssetsTableReorder.bind(this)}
                context={ASSETS_TABLE_CONTEXTS.get('collection-content')}
              />
            </bem.FormView__cell>
          </bem.FormView__row>
        </bem.FormView>
      </DocumentTitle>
    );
  }
}

reactMixin(LibraryCollection.prototype, mixins.contextRouter);
reactMixin(LibraryCollection.prototype, Reflux.ListenerMixin);

LibraryCollection.contextTypes = {
  router: PropTypes.object
};

export default LibraryCollection;
