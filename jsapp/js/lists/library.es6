import React from 'react';
import Reflux from 'reflux';

import searches from '../searches';
import mixins from '../mixins';
import stores from '../stores';
import bem from '../bem';
import ui from '../ui';
import {dataInterface} from '../dataInterface';
import SearchCollectionList from '../components/searchcollectionlist';
import {
  ListSearchSummary,
} from '../components/list';
import {t} from '../utils';

var LibrarySearchableList = React.createClass({
  mixins: [
    searches.common,
    mixins.droppable,
    Reflux.ListenerMixin
  ],
  queryCollections () {
    dataInterface.listCollections().then((collections)=>{
      this.setState({
        sidebarCollections: collections.results,
      });
    });
  },
  componentDidMount () {
    this.searchDefault();
    this.queryCollections();
  },
  /*
  dropAction ({file, event}) {
    actions.resources.createAsset({
      base64Encoded: event.target.result,
      name: file.name,
      lastModified: file.lastModified,
      contentType: file.type
    });
  },
  */
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
      <bem.Library>
        <SearchCollectionList
            showDefault={true}
            searchContext={this.state.searchContext}
          />

        <ListSearchSummary
            assetDescriptor={t('library item')}
            assetDescriptorPlural={t('library items')}
            searchContext={this.state.searchContext}
          />
      </bem.Library>
      );
  }
});

export default LibrarySearchableList;
