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
  click: {
    collection: {
      sharing: function(uid, evt){
        this.transitionTo('collection-sharing', {assetid: uid});
      },
      view: function(uid, evt){
        this.transitionTo('collection-page', {uid: uid})
      },
      delete: function(uid, evt){
        window.confirm(t('Warning! You are about to delete this collection with all its questions and blocks. Are you sure you want to continue?')) &&
            actions.resources.deleteCollection({uid: uid});
      },
    },
    asset: {
      new: function(uid, evt){
        log('transitionTo new-form')
        this.transitionTo('new-form')
      },
      view: function(uid, evt){
        this.transitionTo('form-landing', {assetid: uid})
      },
      clone: function(uid, evt){
        actions.resources.cloneAsset({uid: uid})
      },
      download: function(uid, evt){
        this.transitionTo('form-download', {assetid: uid})
      },
      delete: function(uid, evt){
        window.confirm(t('You are about to permanently delete this form. Are you sure you want to continue?')) && 
          actions.resources.deleteAsset({uid: uid});
      },
      deploy: function(uid, evt){
        var asset_url = stores.selectedAsset.asset.url;
        // var form_id_string = prompt('form_id_string');
        actions.resources.deployAsset(asset_url);
      },
    }
  },
  onActionButtonClick (evt) {
    var data = evt.actionIcon ? evt.actionIcon.dataset : evt.currentTarget.dataset;
    var assetType = data.assetType,
        action = data.action,
        disabled = data.disabled == "true",
        uid = this.state.list && stores.selectedAsset.uid,
        result;
    var click = this.click || mixins.collection.click;

    if (action === 'new') {
      result = this.click.asset.new.call(this);
    } else if (this.click[assetType] && this.click[assetType][action]) {
      result = this.click[assetType][action].call(this, uid, evt);
    }
    if (result !== false) {
      evt.preventDefault();
    }
  },
  searchChange (evt) {
    var val = evt.target.value;
    if (val) {
      this.searchValue({
        string: val
      });
    } else {
      this.getSearchActions().search.cancel();
    }
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
    this.listenTo(stores.tags, this.tagsLoaded)
    actions.resources.listTags();
  },
  tagsLoaded (tags) {
    this.setState({
      tagsLoaded: true,
      availableTags: tags.map(function(t){
        return {
          label: t.name,
          value: t.name,
        }
      })
    });
  },
  onTagChange (tagString, tagList) {
    var tagString = tagList.map(function(t){
      return `tag:${t.value}`
    }).join(' OR ');
    if (tagList.length === 0) {
      delete this.searchStore.filterParams.tagString;
    } else {
      this.searchStore.filterParams.tagString = tagString;
    }
    this.getSearchActions().search();
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
  render () {
    var messages = [], modifier,
        s = this.state;
    if (s.searchResultsDisplayed) {
      if (s.searchState === 'loading') {
        messages.push(t('searching'))
        modifier = 'loading';
      } else if (s.searchState === 'done') {
        if (s.searchStr) {
          messages.push(t('searched for "___"').replace('___', s.searchStr));
        }
        log('ss' , s);
        messages.push(t('found ## results').replace('##', s.searchResultsCount));
        modifier = 'done';
      }
    } else {
      if (s.defaultQueryState === 'loading') {
        messages.push(t('loading'))
        modifier = 'loading'
      } else if (s.defaultQueryState === 'done') {
        messages.push(t('listing ## items').replace('##', s.defaultQueryCount));
        modifier = 'done'
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
};
