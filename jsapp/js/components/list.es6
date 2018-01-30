import _ from 'underscore';
import React from 'react';
import reactMixin from 'react-mixin';
import autoBind from 'react-autobind';
import Reflux from 'reflux';
import Select from 'react-select';

import ui from '../ui';
import bem from '../bem';
import actions from '../actions';
import {dataInterface} from '../dataInterface';
import searches from '../searches';
import stores from '../stores';
import {t} from '../utils';

class ListSearch extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    if (searchStoreState.cleared) {
      this.refs['formlist-search'].setValue('');
    }
    this.setState(searchStoreState);
  }
  render () {
    return (
          <bem.Search m={[this.state.searchState]} >
            <bem.Search__icon />
            <ui.SearchBox ref="formlist-search" placeholder={t(this.props.placeholderText)} onChange={this.searchChangeEvent} />
            <bem.Search__cancel m={{'active': this.state.searchState !== 'none'}} onClick={this.searchClear} />
          </bem.Search>
        );
  }
};

ListSearch.defaultProps = {
  searchContext: 'default',
  placeholderText: t('Search...')
};

reactMixin(ListSearch.prototype, searches.common);
reactMixin(ListSearch.prototype, Reflux.ListenerMixin);

class ListTagFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      availableTags: [],
      tagsLoaded: false,
    };
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(stores.tags, this.tagsLoaded);
    this.listenTo(this.searchStore, this.searchStoreChanged);
    actions.resources.listTags(this.searchStore.filterTagQueryData());
  }
  searchStoreChanged (searchStoreState) {
    if (searchStoreState.cleared) {
      // re-render to remove tags if the search was cleared
      this.setState(searchStoreState);
    } else {
      if (searchStoreState.searchTags) {
        var tags = searchStoreState.searchTags.map(function(tag){
          return tag.value;
        }).join(',');
        this.setState({
          selectedTag: tags
        });
      }
    }

  }
  tagsLoaded (tags) {
    this.setState({
      tagsLoaded: true,
      availableTags: tags.map(function(tag){
        return {
          label: tag.name,
          value: tag.name.replace(/\s/g, '-'),
        };
      }),
      selectedTag: ''
    });
  }
  onTagChange (tagString) {
    this.searchTagsChange(tagString);
  }
  render () {
    if (!this.state.tagsLoaded) {
      return (
        <bem.tagSelect>
          <i className="fa fa-search" />
          <Select
              name="tags"
              value=""
              disabled={true}
              multi={false}
              placeholder={t('Tags are loading...')}
              className={this.props.hidden ? 'hidden' : null}
            />
        </bem.tagSelect>
        );
    }
    return (
      <bem.tagSelect>
        <i className="fa fa-search" />
        <Select
            name="tags"
            multi={true}
            placeholder={t('Search Tags')}
            noResultsText={t('No results found')}
            options={this.state.availableTags}
            onChange={this.onTagChange}
            className={this.props.hidden ? 'hidden' : null}
            value={this.state.selectedTag}
          />
      </bem.tagSelect>
    );
  }
};

ListTagFilter.defaultProps = {
  searchContext: 'default',
  hidden: false,
};

reactMixin(ListTagFilter.prototype, searches.common);
reactMixin(ListTagFilter.prototype, Reflux.ListenerMixin);

class ListCollectionFilter extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      availableCollections: [],
      collectionsLoaded: false,
    };
    autoBind(this);
  }
  componentDidMount () {
    this.queryCollections();
  }
  queryCollections () {
    dataInterface.listCollections().then((collections)=>{
      var availableCollections = collections.results.filter((value) => {
        return value.access_type !== 'public';
      });

      this.setState({
        collectionsLoaded: true,
        availableCollections: availableCollections.map(function(collection){
          return {
            label: collection.name,
            value: collection.uid,
          };
        }),
        selectedCollection: ''
      });

    });
  }
  onCollectionChange (collectionUid) {
    if (collectionUid) {
      this.searchCollectionChange(collectionUid.value);
      this.setState({
        selectedCollection: collectionUid.value
      });
    } else {
      this.searchClear();
      this.setState({
        selectedCollection: ''
      });
    }
  }
  render () {
    if (!this.state.collectionsLoaded) {
      return (
        <bem.collectionFilter>
          {t('Collections are loading...')}
        </bem.collectionFilter>
        );
    }
    return (
      <bem.collectionFilter>
        <label>
          {t('Filter by')}
        </label>
        <Select
            name="collections"
            placeholder={t('Select Collection Name')}
            options={this.state.availableCollections}
            onChange={this.onCollectionChange}
            value={this.state.selectedCollection}
          />
      </bem.collectionFilter>
    );
  }
};

ListCollectionFilter.defaultProps = {
  searchContext: 'default',
};

reactMixin(ListCollectionFilter.prototype, searches.common);
reactMixin(ListCollectionFilter.prototype, Reflux.ListenerMixin);

class ListExpandToggle extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      assetNavExpanded: stores.pageState.state.assetNavExpanded
    };
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  }
  handleChange (/*event*/) {
    stores.pageState.setState({assetNavExpanded: !this.state.assetNavExpanded});
    this.setState({assetNavExpanded: !this.state.assetNavExpanded});
  }
  render () {
    var count,
        isSearch = this.state.searchResultsDisplayed;

    if (isSearch) {
      count = this.state.searchResultsCount;
    } else {
      count = this.state.defaultQueryCount;
    }

    return (
      <bem.LibNav__expanded className={{hidden: this.props.hidden}}>
        <bem.LibNav__count>
          {count} {t('assets found')}
        </bem.LibNav__count>
        <bem.LibNav__expandedToggle>
          <input type='checkbox' className='mdl-checkbox__input' id='expandedToggleCheckbox' checked={this.state.assetNavExpanded} onChange={this.handleChange} />
          <label htmlFor='expandedToggleCheckbox'>
            {t('expand details')}
          </label>
        </bem.LibNav__expandedToggle>
      </bem.LibNav__expanded>
      );
  }
};

ListExpandToggle.defaultProps = {
  searchContext: 'default',
  hidden: false,
};

reactMixin(ListExpandToggle.prototype, searches.common);
reactMixin(ListExpandToggle.prototype, Reflux.ListenerMixin);

class ListSearchSummary extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchChanged);
  }
  searchChanged (state) {
    this.setState(state);
  }
  render () {
    var messages = [], modifier,
        s = this.state;
    if (s.searchFor && s.searchFor.tags && s.searchFor.tags.length > 0) {
      var tagString = _.pluck(s.searchFor.tags, 'label').join(', ');
    }
    if (s.searchState === 'loading') {
      if (s.searchFor) {
        if (s.searchFor.string) {
          messages.push(t('searching for "___"').replace('___', s.searchFor.string));
        }
        if (tagString) {
          messages.push(t('tagged with [___]').replace('___', tagString));
        }
      }
      modifier = 'loading';
    } else if (s.searchResultsDisplayed) {
      if (s.searchFor) {
        if (s.searchFor.string) {
          messages.push(t('searched for "___"').replace('___', s.searchFor.string));
        }
        if (tagString) {
          messages.push(t('tagged with [___]').replace('___', tagString));
        }
      }
      messages.push(t('found ## results').replace('##', s.searchResultsCount));
      modifier = 'done';
    } else {
      if (s.defaultQueryState === 'loading') {
        modifier = 'loading';
      } else if (s.defaultQueryState === 'done') {
        var desc = s.defaultQueryCount === 1 ? this.props.assetDescriptor : this.props.assetDescriptorPlural;
        messages.push(t('## ___ available').replace('##', s.defaultQueryCount).replace('___', desc));
        modifier = 'done';
      }
    }

    return (
        <bem.Search__summary m={modifier}>
          {messages.map(function(message, i){
            return <div key={`prop-${i}`}>{message}</div>;
          })}
        </bem.Search__summary>
      );
  }
};

ListSearchSummary.defaultProps = {
  assetDescriptor: 'item',
  assetDescriptorPlural: 'items',
};

reactMixin(ListSearchSummary.prototype, searches.common);
reactMixin(ListSearchSummary.prototype, Reflux.ListenerMixin);

class ListSearchDebug extends React.Component {
  constructor(props) {
    super(props);
    this.state = {};
    autoBind(this);
  }
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  }
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  }
  render () {
    var searchResultsSuccess = this.state.searchResultsSuccess,
        searchDebugQuery = this.state.searchDebugQuery;

    return (
            <bem.CollectionNav__searchcriteria>
              <bem.CollectionNav__searchcriterion m={{
                success: searchResultsSuccess
                  }}>
                {t('success')}
                {this.state.searchResultsSuccess ? t('yes') : t('no')}
              </bem.CollectionNav__searchcriterion>
              <bem.CollectionNav__searchcriterion>
                {t('count')}
                {this.state.searchResultsCount}
              </bem.CollectionNav__searchcriterion>
              { searchDebugQuery ?
                <bem.CollectionNav__searchcriterion m={'code'}>
                  {searchDebugQuery}
                </bem.CollectionNav__searchcriterion>
              : null}
            </bem.CollectionNav__searchcriteria>
        );
  }
};

ListSearchDebug.defaultProps = {
  searchContext: 'default',
};

reactMixin(ListSearchDebug.prototype, searches.common);
reactMixin(ListSearchDebug.prototype, Reflux.ListenerMixin);

export default {
  // List: List,
  ListSearch: ListSearch,
  ListSearchDebug: ListSearchDebug,
  ListSearchSummary: ListSearchSummary,
  ListTagFilter: ListTagFilter,
  ListCollectionFilter: ListCollectionFilter,
  ListExpandToggle: ListExpandToggle,
};
