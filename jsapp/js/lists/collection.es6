import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';

import {dataInterface} from '../dataInterface'
import searches from '../searches';
import actions from '../actions';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';

import AssetRow from '../components/assetrow';
import {List, ListSearch, ListSearchDebug, ListTagFilter, ListSearchSummary} from '../components/list';
import {notify, getAnonymousUserPermission, formatTime, anonUsername, parsePermissions, log, t} from '../utils';


var CollectionList = React.createClass({
  mixins: [
    mixins.collectionList,
    mixins.droppable,
    mixins.clickAssets,
    Navigation,
    Reflux.ListenerMixin,
    Reflux.connect(stores.selectedAsset),
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {
      var headerBreadcrumb = [
        {
          'label': t('Collections'), 
          'href': '/collections', 
        }
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);
      stores.pageState.setAssetNavPresent(false);
      callback();
    }
  },
  componentDidMount () {
    this.listCollections();
  },
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  createCollection () {
    dataInterface.createCollection({
      name: prompt('collection name?')
    }).done((data)=>{
      this.redirect(`/collections/${data.uid}/`);
    })
  },
  render () {
    return (
      <ui.Panel>
        <bem.CollectionNav>
          <bem.CollectionNav__search>
            {/*
            <ListSearchSummary
                assetDescriptor={t('collection')}
                assetDescriptorPlural={t('collections')}
                searchContext={this.state.searchContext}
              />
            */}
          </bem.CollectionNav__search>

          <bem.CollectionNav__actions className="k-form-list-actions">
            <button id="demo-menu-top-right"
                    className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored">
              <i className="material-icons">add</i>
            </button>

            <ul className="mdl-menu mdl-menu--top-right mdl-js-menu mdl-js-ripple-effect"
                htmlFor="demo-menu-top-right">
                <bem.CollectionNav__button m={['new', 'new-collection']} className="mdl-menu__item"
                    onClick={this.createCollection.bind(this)}>
                  <i />
                  {t('new collection')}
                </bem.CollectionNav__button>
              <li className="mdl-menu__item">
                <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
                  <bem.CollectionNav__button m={['upload', 'upload-block']}>
                    <i className='fa fa-icon fa-cloud fa-fw' />
                    &nbsp;&nbsp;
                    {t('upload')}
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
    var perm = parsePermissions(resource.owner, resource.permissions)
    var isSelected = this.state.selectedAssetUid === resource.uid;
    return <AssetRow key={resource.uid}
                      currentUsername={currentUsername}
                      perm={perm}
                      onActionButtonClick={this.onActionButtonClick}
                      isSelected={isSelected}
                      {...resource}
                        />
  },
  renderCollectionList () {
    var s = this.state,
        p = this.props;
    if (s.collectionSearchState === 'loading') {
      return (
        <bem.CollectionAssetList>
          <bem.CollectionAssetList__message m={'loading'}>
            {t('loading...')}
          </bem.CollectionAssetList__message>
        </bem.CollectionAssetList>
      );
    } else if (s.collectionSearchState === 'done') {
      return (
        <bem.CollectionAssetList>
          {s.collectionList.map(this.renderAssetRow)}
        </bem.CollectionAssetList>
      );
    }
  },
});

export default CollectionList;
