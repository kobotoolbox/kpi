import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';

var mdl = require('../libs/rest_framework/material');

import SearchCollectionList from '../components/searchcollectionlist';

import {List, ListSearch, ListSearchDebug, ListTagFilter, ListSearchSummary} from '../components/list';
import {notify, getAnonymousUserPermission, formatTime, anonUsername, parsePermissions, log, t} from '../utils';


var FormsSearchableList = React.createClass({
  mixins: [
    searches.common,
    mixins.droppable,
    Navigation,
    Reflux.ListenerMixin,
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {

      var headerBreadcrumb = [
        {
          'label': t('Forms'), 
          // 'href': 'forms', 
        }
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);

      stores.pageState.setAssetNavPresent(false);
      callback();
    }
  },
  componentDidMount () {
    this.searchDefault();
  },
  dropAction ({file, event}) {
    actions.resources.createImport({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  getInitialState () {
    return {
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      })
    }
  },
  render () {
    return (
      <ui.Panel>
        <bem.CollectionNav>
          <bem.CollectionNav__search>
            <ListSearch
                placeholder={t('search forms')}
                searchContext={this.state.searchContext}
              />
            <ListTagFilter
                searchContext={this.state.searchContext}
              />
            <ListSearchSummary
                assetDescriptor={t('form')}
                assetDescriptorPlural={t('forms')}
                searchContext={this.state.searchContext}
              />
          </bem.CollectionNav__search>

          <bem.CollectionNav__actions className="k-form-list-actions">
            <button id="demo-menu-top-right"
                    className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored">
              <i className="material-icons">add</i>
            </button>

            <div className="mdl-menu mdl-menu--top-right mdl-js-menu mdl-js-ripple-effect"
                htmlFor="demo-menu-top-right">
              <bem.CollectionNav__link className="mdl-menu__item" m={['new', 'new-block']}
                  href={this.makeHref('new-form')}>
                <i />
                {t('new form')}
              </bem.CollectionNav__link>
              <Dropzone onDropFiles={this.dropFiles} params={{destination: false}} fileInput>
                <bem.CollectionNav__button m={['upload', 'upload-block']} className="mdl-menu__item">
                  <i className='fa fa-icon fa-cloud fa-fw' />
                  {t('upload')}
                </bem.CollectionNav__button>
              </Dropzone>
            </div>
          </bem.CollectionNav__actions>
        </bem.CollectionNav>
        <SearchCollectionList
            showDefault={true}
            searchContext={this.state.searchContext}
          />
      </ui.Panel>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }});

export default FormsSearchableList;
