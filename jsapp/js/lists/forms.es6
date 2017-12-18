import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
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
    this.searchDefault();
  }
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
  render () {
    return (
      <SearchCollectionList
          showDefault={true}
          searchContext={this.state.searchContext}
        />
      );
  }
};

FormsSearchableList.contextTypes = {
  router: PropTypes.object
};

reactMixin(FormsSearchableList.prototype, searches.common);
reactMixin(FormsSearchableList.prototype, mixins.droppable);
reactMixin(FormsSearchableList.prototype, Reflux.ListenerMixin);

export default FormsSearchableList;
