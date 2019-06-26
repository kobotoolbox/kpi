import React from 'react';
import PropTypes from 'prop-types';
import autoBind from 'react-autobind';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';
import DocumentTitle from 'react-document-title';
import {Link} from 'react-router';
import ui from 'js/ui';
import bem from 'js/bem';
import mixins from 'js/mixins';
import stores from 'js/stores';
import actions from 'js/actions';
import {t} from 'js/utils';
import {
  ASSET_TYPES,
  MODAL_TYPES
} from 'js/constants';
import AssetInfoBox from './assetInfoBox';

class LibraryAsset extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      asset: false
    };
    autoBind(this);
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

  showSharingModal (evt) {
    evt.preventDefault();
    stores.pageState.showModal({
      type: MODAL_TYPES.SHARING,
      assetid: this.state.asset.uid
    });
  }

  renderLoading() {
    return (
      <ui.Panel>
        <bem.Loading>
          <bem.Loading__inner>
            <i />
            {t('loading...')}
          </bem.Loading__inner>
        </bem.Loading>
      </ui.Panel>
    );
  }

  renderActionButtons() {
    return (
      <bem.FormView__cell>
        <Link
          to={`/library/asset/${this.state.asset.uid}/edit`}
          className='form-view__link form-view__link--edit'
          data-tip={t('edit')}
        >
          <i className='k-icon-edit' />
        </Link>

        <bem.FormView__link
          m='preview'
          onClick={this.showSharingModal}
          className='right-tooltip'
          data-tip={t('Share this ##type##').replace('##type##', ASSET_TYPES[this.state.asset.asset_type].label)}
        >
          <i className='k-icon-share' />
        </bem.FormView__link>
      </bem.FormView__cell>
    );
  }

  render () {
    if (this.state.asset === false) {
      return this.renderLoading();
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

              {this.renderActionButtons()}
            </bem.FormView__cell>

            <AssetInfoBox
              asset={this.state.asset}
            />
          </bem.FormView__row>
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
