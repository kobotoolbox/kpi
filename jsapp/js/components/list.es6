import _ from 'underscore';
import React from 'react/addons';
import {Navigation} from 'react-router';
import Reflux from 'reflux';
import Select from 'react-select';

import ui from '../ui';
import bem from '../bem';
import actions from '../actions';
import {dataInterface} from '../dataInterface';
import searches from '../searches';
import stores from '../stores';
import AssetRow from './assetrow';
import {
  parsePermissions,
  t,
} from '../utils';

var ListSearch = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Navigation,
  ],
  getDefaultProps () {
    return {
      searchContext: 'default',
      placeholderText: t('Search...')
    };
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  searchStoreChanged (searchStoreState) {
    if (searchStoreState.cleared) {
      this.refs['formlist-search'].setValue('');
    }
    this.setState(searchStoreState);
  },
  render () {
    return (
          <bem.Search m={[this.state.searchState]} >
            <bem.Search__icon />
            <ui.SearchBox ref="formlist-search" placeholder={t(this.props.placeholderText)} onChange={this.searchChangeEvent} />
            <bem.Search__cancel m={{'active': this.state.searchState !== 'none'}} onClick={this.searchClear} />
          </bem.Search>
        );
  },
});

var ListTagFilter = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
  ],
  getDefaultProps () {
    return {
      searchContext: 'default',
      hidden: false,
    };
  },
  getInitialState () {
    return {
      availableTags: [],
      tagsLoaded: false,
    };
  },
  componentDidMount () {
    this.listenTo(stores.tags, this.tagsLoaded);
    this.listenTo(this.searchStore, this.searchStoreChanged);
    actions.resources.listTags(this.searchStore.filterTagQueryData());
  },
  searchStoreChanged (searchStoreState) {
    if (searchStoreState.cleared) {
      // re-render to remove tags if the search was cleared
      this.setState(searchStoreState);
    }
  },
  tagsLoaded (tags) {
    this.setState({
      tagsLoaded: true,
      availableTags: tags.map(function(tag){
        return {
          label: tag.name,
          value: tag.name.replace(/\s/g, '-'),
        };
      })
    });
  },
  getTagStringFromSearchStore () {
    if (!!this.searchStore.state.searchTags) {
      return this.searchStore.state.searchTags.map(function(tag){
        return tag.value;
      }).join(',');
    }
    return '';
  },
  onTagChange (tagString, tagList) {
    this.searchTagsChange(tagList);
  },
  render () {
    if (!this.state.tagsLoaded) {
      return (
        <bem.tagSelect>
          <i className="fa fa-search" />
          <Select
              name="tags"
              value=""
              disabled={true}
              multi={true}
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
            value={this.getTagStringFromSearchStore()}
          />
      </bem.tagSelect>
    );
  },
});

var ListCollectionFilter = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
  ],
  getDefaultProps () {
    return {
      searchContext: 'default',
    };
  },
  getInitialState () {
    return {
      availableCollections: [],
      collectionsLoaded: false,
    };
  },
  componentDidMount () {
    this.queryCollections();
  },
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
        })
      });

    });
  },
  onCollectionChange (collectionUid) {
    this.searchCollectionChange(collectionUid);
  },
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
          />
      </bem.collectionFilter>
    );
  },
});

var ListExpandToggle = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
  ],
  getInitialState () {
    return {
      assetNavExpanded: stores.pageState.state.assetNavExpanded
    };
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
  handleChange: function(/*event*/) {
    stores.pageState.setState({assetNavExpanded: !this.state.assetNavExpanded});
    this.setState({assetNavExpanded: !this.state.assetNavExpanded});
  },
  getDefaultProps () {
    return {
      searchContext: 'default',
      hidden: false,
    };
  },
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
          <label className='mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect' htmlFor='expandedToggleCheckbox'>
            <input type='checkbox' className='mdl-checkbox__input' id='expandedToggleCheckbox' checked={this.state.assetNavExpanded} onChange={this.handleChange} />
            <span className='mdl-checkbox__label'>{t('expand details')} {this.state.assetNavExpanded}</span>
          </label>
        </bem.LibNav__expandedToggle>
      </bem.LibNav__expanded>
      );
  },
});

var ListSearchSummary = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Navigation,
  ],
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchChanged);
  },
  searchChanged (state) {
    this.setState(state);
  },
  getDefaultProps () {
    return {
      assetDescriptor: 'item',
      assetDescriptorPlural: 'items',
    };
  },
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
  },
});

var ListSearchDebug = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Navigation,
  ],
  getDefaultProps () {
    return {
      searchContext: 'default',
    };
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
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
  },
});


export default {
  // List: List,
  ListSearch: ListSearch,
  ListSearchDebug: ListSearchDebug,
  ListSearchSummary: ListSearchSummary,
  ListTagFilter: ListTagFilter,
  ListCollectionFilter: ListCollectionFilter,
  ListExpandToggle: ListExpandToggle,
};
