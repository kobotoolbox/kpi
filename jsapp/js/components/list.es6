import React from 'react/addons';
var Reflux = require('reflux');
var assign = require('react/lib/Object.assign');
var Select = require('react-select');

import {notify, formatTime, anonUsername, parsePermissions, log, t} from '../utils';
import ui from '../ui';
import bem from '../bem';
import actions from '../actions';
import searches from '../searches';
import stores from '../stores';
import mixins from '../mixins';
import dataInterface from '../dataInterface';
import {Navigation} from 'react-router';

var AssetRow = require('./assetrow');


var List = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Navigation,
  ],
  propTypes: {
    showDefault: React.PropTypes.bool,
  },
  getDefaultProps () {
    return {
      assetRowClass: AssetRow,
      searchContext: 'default',
    }
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
  renderAssetRow (resource) {
    var currentUsername = stores.session.currentAccount && stores.session.currentAccount.username;
    var perm = parsePermissions(resource.owner, resource.permissions)
    var isSelected = stores.selectedAsset.uid === resource.uid;
    return <this.props.assetRowClass key={resource.uid}
                      currentUsername={currentUsername}
                      perm={perm}
                      onActionButtonClick={this.onActionButtonClick}
                      isSelected={isSelected}
                      {...resource}
                        />
  },
  render () {
    var searchState = this.state.searchState,
        cancellable = this.state.searchState !== 'none',
        showDefault = this.props.showDefault,
        searchResultsList = this.state.searchResultsList || [],
        defaultSearchResults = this.state.defaultSearchResults,
        defaultSearchResultsList = this.state.defaultSearchResultsList || [],
        isLoading = this.state.searchState === 'loading',
        searchResultsListEmpty = searchResultsList && searchResultsList.length === 0,
        searchResultsSuccess = this.state.searchResultsSuccess,
        searchDebugQuery = this.state.searchDebugQuery,
        searchResultsCount = this.state.searchResultsCount;

    return (
        <bem.CollectionAssetList>
          {
            (searchState === 'none' && !showDefault) ?
              <bem.CollectionAssetList__message>
                {t('enter a search term above')}
              </bem.CollectionAssetList__message>
          : (()=>{
              if (isLoading) {
                return (
                  <bem.CollectionAssetList__message m={'loading'}>
                    {t('loading...')}
                  </bem.CollectionAssetList__message>
                );
              } else if (showDefault && searchState === 'none') {
                if (defaultSearchResultsList.length === 0) {
                  return (
                      <bem.CollectionAssetList__message>
                        {t('no assets were found')}
                      </bem.CollectionAssetList__message>
                    );
                }
                return defaultSearchResultsList.map(this.renderAssetRow);
              } else {
                if (searchResultsList.length === 0) {
                  return (
                      <bem.CollectionAssetList__message>
                        {t('no results were found matching your query')}
                      </bem.CollectionAssetList__message>
                    );

                }
                return searchResultsList.map(this.renderAssetRow);
              }
            })()
          }
        </bem.CollectionAssetList>
      );
  },
});

var ListSearch = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Navigation,
  ],
  getDefaultProps () {
    return {
      searchContext: 'default',
      placeholderText: 'search...'
    }
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
            <ui.SmallInputBox ref="formlist-search" placeholder={t(this.props.placeholderText)} onChange={this.searchChangeEvent} />
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
    }
  },
  getInitialState () {
    return {
      availableTags: [],
      tagsLoaded: false,
    }
  },
  componentDidMount () {
    this.listenTo(stores.tags, this.tagsLoaded);
    actions.resources.listTags(this.searchStore.filterTagQueryData());
  },
  tagsLoaded (tags) {
    this.setState({
      tagsLoaded: true,
      availableTags: tags.map(function(t){
        return {
          label: t.name,
          value: t.name.replace(/\s/g, '-'),
        }
      })
    });
  },
  onTagChange (tagString, tagList) {
    this.searchTagsChange(tagList);
  },
  render () {
    if (!this.state.tagsLoaded) {
      return (
          <Select
              name="tags"
              value=""
              disabled={true}
              multi={true}
              placeholder={t('tags are loading')}
            />
        );
    }
    return (
        <Select
            name="tags"
            multi={true}
            placeholder={t('select tags')}
            options={this.state.availableTags}
            onChange={this.onTagChange}
          />
      );
  },
})

var ListExpandToggle = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
  ],
  getInitialState () {
    return {
      assetNavExpanded: stores.pageState.state.assetNavExpanded
    }
  },
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchStoreChanged);
  },
  searchStoreChanged (searchStoreState) {
    this.setState(searchStoreState);
  },
  handleChange: function(event) {
    stores.pageState.setState({assetNavExpanded: !this.state.assetNavExpanded})
    this.setState({assetNavExpanded: !this.state.assetNavExpanded});
  },
  getDefaultProps () {
    return {
      searchContext: 'default',
    }
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
      <bem.LibNav__expanded>
        <bem.LibNav__count>
          {count} {t('assets found')}
        </bem.LibNav__count>
        <bem.LibNav__expandedToggle>
          <label className="mdl-checkbox mdl-js-checkbox mdl-js-ripple-effect" htmlFor="expandedToggleCheckbox" >
            <input type="checkbox" className="mdl-checkbox__input"  id="expandedToggleCheckbox" checked={this.state.assetNavExpanded} onChange={this.handleChange} />
            <span className="mdl-checkbox__label">{t('expand details')} {this.state.assetNavExpanded}</span>
          </label>
        </bem.LibNav__expandedToggle>
      </bem.LibNav__expanded>
      );
  },
})

var ListSearchSummary = React.createClass({
  mixins: [
    searches.common,
    Reflux.ListenerMixin,
    Navigation,
  ],
  componentDidMount () {
    this.listenTo(this.searchStore, this.searchChanged)
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
        modifier = 'loading'
      } else if (s.defaultQueryState === 'done') {
        var desc = s.defaultQueryCount === 1 ? this.props.assetDescriptor : this.props.assetDescriptorPlural;
        messages.push(t('## ___ available').replace('##', s.defaultQueryCount).replace('___', desc));
        modifier = 'done';
      }
    }

    return (
        <bem.Search__summary m={modifier}>
          {messages.map(function(message, i){
            return <span key={`prop-${i}`}>{message}</span>;
          })}
        </bem.Search__summary>
      )
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
    }
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
})


export default {
  List: List,
  ListSearch: ListSearch,
  ListSearchDebug: ListSearchDebug,
  ListSearchSummary: ListSearchSummary,
  ListTagFilter: ListTagFilter,
  ListExpandToggle: ListExpandToggle,
};
