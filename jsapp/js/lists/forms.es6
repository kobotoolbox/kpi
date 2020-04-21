import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import Reflux from 'reflux';

import {searches} from '../searches';
import mixins from '../mixins';
import SearchCollectionList from '../components/searchcollectionlist';

class FormsSearchableList extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      searchContext: searches.getSearchContext('forms', {
        filterParams: {
          assetType: 'asset_type:survey',
        },
        filterTags: 'asset_type:survey',
      })
    };
  }
  componentDidMount () {
    this.searchSemaphore();
  }
  render () {
    return (
      <SearchCollectionList
        showDefault
        searchContext={this.state.searchContext} />
      );
  }
}

FormsSearchableList.contextTypes = {
  router: PropTypes.object
};

reactMixin(FormsSearchableList.prototype, searches.common);
reactMixin(FormsSearchableList.prototype, mixins.droppable);
reactMixin(FormsSearchableList.prototype, Reflux.ListenerMixin);

export default FormsSearchableList;
