import React from 'react';
import PropTypes from 'prop-types';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Select from 'react-select';
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

class LibrarySearchableList extends React.Component {
  constructor(props) {
    super(props);

    this.TYPE_FILTER = {
      ALL: 'asset_type:question OR asset_type:block OR asset_type:template',
      BY_QUESTION: 'asset_type:question',
      BY_BLOCK: 'asset_type:block',
      BY_TEMPLATE: 'asset_type:template'
    }
    this.TYPE_FILTER_DEFAULT = this.TYPE_FILTER.ALL;

    this.state = {
      typeFilterVal: this.TYPE_FILTER_DEFAULT,
      searchContext: searches.getSearchContext('library', {
        filterParams: {assetType: this.TYPE_FILTER_DEFAULT},
        filterTags: this.TYPE_FILTER_DEFAULT,
      })
    };
    autoBind(this);
  }
  queryCollections () {
    dataInterface.listCollections().then((collections)=>{
      this.setState({
        sidebarCollections: collections.results,
      });
    });
  }
  componentDidMount () {
    this.searchDefault();
    this.queryCollections();
  }
  onTypeFilterChange(evt) {
    this.setState({
      typeFilterVal: evt,
      searchContext: searches.getSearchContext('library', {
        filterParams: {assetType: evt.value},
        filterTags: evt.value,
      })
    });
    this.searchDefault();
  }
  render () {
    const typeFilterOptions = [
      {value: this.TYPE_FILTER.ALL, label: t('Show All')},
      {value: this.TYPE_FILTER.BY_QUESTION, label: t('Question')},
      {value: this.TYPE_FILTER.BY_BLOCK, label: t('Block')},
      {value: this.TYPE_FILTER.BY_TEMPLATE, label: t('Template')}
    ];
    return (
      <bem.Library>
        <bem.Library__typeFilter>
          {t('Filter by type:')}
          &nbsp;
          <Select
            className='kobo-select'
            classNamePrefix='kobo-select'
            value={this.state.typeFilterVal}
            isClearable={false}
            isSearchable={false}
            options={typeFilterOptions}
            onChange={this.onTypeFilterChange}
          />
        </bem.Library__typeFilter>

        <SearchCollectionList
          showDefault
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
};

LibrarySearchableList.contextTypes = {
  router: PropTypes.object
};

reactMixin(LibrarySearchableList.prototype, searches.common);
reactMixin(LibrarySearchableList.prototype, mixins.droppable);
reactMixin(LibrarySearchableList.prototype, Reflux.ListenerMixin);

export default LibrarySearchableList;
