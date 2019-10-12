import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import searches from 'js/searches';
import mixins from 'js/mixins';
import bem from 'js/bem';
import SearchCollectionList from 'js/components/searchcollectionlist';
import {
  ListSearchSummary,
} from 'js/components/list';
import {t} from 'js/utils';

class LibraryAssetsList extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      searchContext: searches.getSearchContext('library')
    };

    autoBind(this);
  }

  componentDidMount() {
    this.searchDefault();
  }

  render() {
    return (
      <bem.Library>
        <SearchCollectionList
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
}

LibraryAssetsList.contextTypes = {
  router: PropTypes.object
};

reactMixin(LibraryAssetsList.prototype, searches.common);
reactMixin(LibraryAssetsList.prototype, mixins.droppable);
reactMixin(LibraryAssetsList.prototype, Reflux.ListenerMixin);

export default LibraryAssetsList;
