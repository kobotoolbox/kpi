import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import bem from 'js/bem';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import {
  t,
  assign
} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';
import AssetActionButtons from './assetActionButtons';
import AssetInfoBox from './assetInfoBox';
import {
  AssetsTable,
  ASSETS_TABLE_CONTEXTS
} from './assetsTable';
import {renderLoading} from 'js/components/modalForms/modalHelpers';

class LibraryCollection extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset: false
    };
    autoBind(this);
  }

  componentWillReceiveProps(nextProps) {
    // trigger loading message when switching assets
    if (nextProps.params.uid !== this.props.params.uid) {
      this.setState({asset: false});
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

    const fakeAssetsList = [
      {
        uid: 1,
        asset_type: ASSET_TYPES.block.id,
        name: 'How to train a dragon',
        tags: [],
        questionCount: 7,
        date_modified: new Date()
      },
      {
        uid: 2,
        asset_type: ASSET_TYPES.template.id,
        name: 'Current steps in autodestructing your home planet',
        tags: ['ecology'],
        questionCount: 0,
        date_modified: new Date()
      },
      {
        uid: 3,
        asset_type: ASSET_TYPES.template.id,
        name: 'Test form',
        tags: ['final-version'],
        questionCount: 45,
        date_modified: new Date()
      },
      {
        uid: 4,
        asset_type: ASSET_TYPES.template.id,
        name: 'Few questions on how to be a good human being towards other earthlings and thus saving the Gaia from sudden death',
        tags: ['ecology', 'earthlings', 'final version'],
        questionCount: 288,
        date_modified: new Date()
      },
      {
        uid: 5,
        asset_type: ASSET_TYPES.question.id,
        name: 'A simple question',
        tags: [],
        questionCount: 1,
        date_modified: new Date()
      }
    ];

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
                assets={fakeAssetsList}
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
