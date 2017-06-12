import React from 'react';
import Reflux from 'reflux';

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
    Reflux.ListenerMixin
  ],
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
  }});

export default FormsSearchableList;
