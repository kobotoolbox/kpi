import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
import Dropzone from '../libs/dropzone';
import mdl from '../libs/rest_framework/material';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';
import SearchCollectionList from '../components/searchcollectionlist';

import {
  ListSearchSummary,
} from '../components/list';
import {
  t,
} from '../utils';


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
  /*
  dropAction ({file, event}) {
    actions.resources.createImport({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  */
  getInitialState () {
    return {
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      })
    };
  },
  render () {
    return (
      <ui.Panel>
        <bem.CollectionNav>

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
        <div className="mdl-layout-spacer"></div>
        <ListSearchSummary
            assetDescriptor={t('form')}
            assetDescriptorPlural={t('forms')}
            searchContext={this.state.searchContext}
          />
      </ui.Panel>
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }});

export default FormsSearchableList;
