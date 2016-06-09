import React from 'react/addons';
import Reflux from 'reflux';
import {Navigation} from 'react-router';
// import Dropzone from '../libs/dropzone';
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
          'label': t('Projects'),
        }
      ];
      stores.pageState.setHeaderBreadcrumb(headerBreadcrumb);

      stores.pageState.setAssetNavPresent(false);
      stores.pageState.setFormBuilderFocus(false);
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
      <SearchCollectionList
          showDefault={true}
          searchContext={this.state.searchContext}
        />
      );
  },
  componentDidUpdate() {
    mdl.upgradeDom();
  }});

export default FormsSearchableList;
