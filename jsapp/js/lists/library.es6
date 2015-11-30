import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';
import SearchCollectionList from '../components/searchcollectionlist';
import {
  ListSearch,
  ListTagFilter,
  ListSearchSummary,
} from '../components/list';
import {
  t,
} from '../utils';


var LibrarySearchableList = React.createClass({
  mixins: [
    searches.common,
    mixins.droppable,
    Navigation,
    Reflux.ListenerMixin,
  ],
  statics: {
    willTransitionTo: function(transition, params, idk, callback) {

      var headerBreadcrumb = [
        {'label': t('Library'), 'href': '', }
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
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  getInitialState () {
    return {
      searchContext: searches.getSearchContext('library', {
        filterParams: {
          assetType: 'asset_type:question OR asset_type:block',
        },
        filterTags: 'asset_type:question OR asset_type:block',
      })
    };
  },
  render () {
    return (
      <ui.Panel>
        <bem.CollectionNav>
          <bem.CollectionNav__search>
            <ListSearch
                placeholder={t('search library')}
                searchContext={this.state.searchContext}
              />
            <ListTagFilter
                searchContext={this.state.searchContext}
              />
            <ListSearchSummary
                assetDescriptor={t('library item')}
                assetDescriptorPlural={t('library items')}
                searchContext={this.state.searchContext}
              />
          </bem.CollectionNav__search>

          <bem.CollectionNav__actions className="k-form-list-actions">
            <button id="demo-menu-top-right"
                    className="mdl-button mdl-js-button mdl-button--fab mdl-button--colored">
              <i className="material-icons">add</i>
            </button>

            <ul className="mdl-menu mdl-menu--top-right mdl-js-menu mdl-js-ripple-effect"
                htmlFor="demo-menu-top-right">
              <bem.CollectionNav__link m={['new', 'new-block']} className="mdl-menu__item"
                  href={this.makeHref('add-to-library')}>
                <i />
                {t('add to library')}
              </bem.CollectionNav__link>
              <Dropzone onDropFiles={this.dropFiles} className="mdl-menu__item"
                  params={{destination: false}} fileInput>
                <bem.CollectionNav__button m={['upload', 'upload-block']} className="mdl-menu__item">
                  <i className='fa fa-icon fa-cloud fa-fw' />
                  &nbsp;&nbsp;
                  {t('upload')}
                </bem.CollectionNav__button>
              </Dropzone>
            </ul>
          </bem.CollectionNav__actions>
        </bem.CollectionNav>
        <SearchCollectionList
            showDefault={true}
            searchContext={this.state.searchContext}
          />
      </ui.Panel>
      );
  },
});

export default LibrarySearchableList;
