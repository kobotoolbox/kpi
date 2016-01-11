import _ from 'underscore';
import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import mdl from '../libs/rest_framework/material';
import Dropzone from '../libs/dropzone';

import {dataInterface} from '../dataInterface';
import actions from '../actions';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';
import AssetRow from '../components/assetrow';
import {
  parsePermissions,
  t,
} from '../utils';

var extendCollectionToStateMixin = {
  componentDidMount () {
    this.listenTo(stores.collectionAssets, this.collectionLoaded);
    var params = this.props.params,
        uid;
    if (params) {
      uid = params.uid;
    }
    if (params && (uid) && uid[0] === 'c') {
      actions.resources.readCollection({uid: uid});
      this.setState({
        collectionLoading: 1,
      });
    }
  },
  collectionLoaded (coll, uid) {
    if (uid === this.props.params.uid) {
      this.setState({
        collection: coll,
        collectionLoading: 0,
      });
    }
  },
  getInitialState () {
    return {
      collection: {
        url: false,
      },
      collectionLoading: -1,
      collectionUrl: `/collections/${this.props.params.uid}/`
    };
  },
};

var CollectionLanding = React.createClass({
  mixins: [
    extendCollectionToStateMixin,
    // mixins.collectionList,
    mixins.droppable,
    mixins.clickAssets,
    Navigation,
    Reflux.ListenerMixin,
    Reflux.connect(stores.selectedAsset),
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      stores.pageState.setHeaderBreadcrumb([
        {'label': t('Collections'), 'to': 'collections'},
        {'label': t('Collection'), 'to': 'collection-page', 'params': {
          uid: params.uid
        }}
      ]);
      stores.pageState.setAssetNavPresent(false);
      callback();
    }
  },
  /*
  dropAction ({file, event}) {
    actions.resources.createImport({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      parent: this.state.collectionUrl,
      contentType: file.type
    });
  },
  */
  componentDidMount () {
    this.sendCollectionNameChange = _.debounce(this._sendCollectionNameChange, 2500);
    mdl.upgradeDom();
  },
  createCollection () {
    dataInterface.createCollection({
      name: customPrompt('collection name?'),
      parent: this.state.collectionUrl,
    }).done((data) => {
      this.redirect(`/collections/${data.uid}/`);
    });
  },
  _sendCollectionNameChange (name) {
    // this method is debounced
    var req = dataInterface.patchCollection(this.props.params.uid, {
      name: name
    }).done((coll) => {
      this.setState({
        collectionNamingRequest: false,
        collectionNameSaving: false,
        collection: coll,
      });
    });
    this.setState({
      collectionNamingRequest: req,
      collectionNameSaving: true,
      collectionNaming: name,
    });
  },
  changeCollectionName (evt) {
    var name = evt.target.value;
    if (this.state.collectionNamingRequest) {
      this.state.collectionNamingRequest.abort();
    }
    this.setState({
      collectionNaming: name,
      collectionNameSaving: true,
    });
    this.sendCollectionNameChange(name);
  },
  render () {
    var s = this.state,
        collectionName = s.collectionNameSaving ? s.collectionNaming : s.collection.name,
        collectionIdentifier = s.collection.name;

    if (s.collectionLoading) {
      return (
          <ui.Panel>
            {t('collection loading...')}
          </ui.Panel>
        );
    } else if (!s.collection.url) {
      return (
          <ui.Panel>
            {t('collection not loaded')}
          </ui.Panel>
        );
    }
    return (
      <ui.Panel>
        <bem.CollectionHeader__item m={'name'}>
          <bem.CollectionHeader__iconwrap><i /></bem.CollectionHeader__iconwrap>
          <div className="mdl-textfield mdl-js-textfield">
            <bem.CollectionHeader__input
              m={{
                  saving: s.collectionNameSaving
                }}
              value={collectionName}
              onChange={this.changeCollectionName}
              placeholder={t('collection name')}
              />
          </div>
        </bem.CollectionHeader__item>
        <bem.CollectionNav className="ui-panel__cell">
          <bem.CollectionNav__actions>
            <button id="demo-menu-top-right"
                    className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored">
              <i className="material-icons">add</i>
            </button>

            <ul className="mdl-menu mdl-menu--top-right mdl-js-menu mdl-js-ripple-effect"
                htmlFor="demo-menu-top-right">
                <bem.CollectionNav__button m={['new', 'new-collection']} className="mdl-menu__item"
                    onClick={this.createCollection}>
                  <i />
                  {t('new collection inside "___"').replace('___', collectionIdentifier)}
                </bem.CollectionNav__button>
              <li>
                <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
                  <bem.CollectionNav__button m={['upload', 'upload-block']} className="mdl-menu__item">
                    <i className='fa fa-icon fa-cloud fa-fw' />
                    {t('upload into "___"').replace('___', collectionIdentifier)}
                  </bem.CollectionNav__button>
                </Dropzone>
              </li>
            </ul>
          </bem.CollectionNav__actions>
        </bem.CollectionNav>
        {this.renderCollectionList()}
      </ui.Panel>
      );
  },
  renderAssetRow (resource) {
    var currentUsername = stores.session.currentAccount && stores.session.currentAccount.username;
    var perm = parsePermissions(resource.owner, resource.permissions);
    var isSelected = this.state.selectedAssetUid === resource.uid;
    return (
          <AssetRow key={resource.uid}
                      currentUsername={currentUsername}
                      perm={perm}
                      onActionButtonClick={this.onActionButtonClick}
                      isSelected={isSelected}
                      {...resource}
                        />
      );
  },
  renderCollectionList () {
    var s = this.state;
    if (s.collectionLoading) {
      return (
        <bem.CollectionAssetList>
          <bem.CollectionAssetList__message m={'loading'}>
            {t('loading...')}
          </bem.CollectionAssetList__message>
        </bem.CollectionAssetList>
      );
    } else if (s.collection.url) {
      if (s.collection.children.count === 0) {
        return (
          <bem.CollectionAssetList>
            <bem.CollectionAssetList__message m={'loading'}>
              {t('no assets to display')}
            </bem.CollectionAssetList__message>
          </bem.CollectionAssetList>
        );
      }
      return (
        <bem.CollectionAssetList>
          {s.collection.children.results.map(this.renderAssetRow)}
        </bem.CollectionAssetList>
      );
    }
  },
});

export default CollectionLanding;
