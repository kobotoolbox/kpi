/*
 the 'searches' modules provides a combination of
 Reflux.actions and Reflux.stores which trigger and store
 searches in different contexts.
*/

import _ from 'underscore';
import Reflux from 'reflux';
import {notify, log, t} from './utils';

var $ = require('jquery');
var assign = require('react/lib/Object.assign');
var assetParserUtils = require('./assetParserUtils');

var searchDataInterface = (function(){
  return {
    assets: function(data) {
      return $.ajax({
        url: '/assets/',
        dataType: 'json',
        data: data,
        method: 'GET'
      })
    }
  }
})();

const clearSearchState = {
  searchState: 'none',
  searchResults: false,
  searchResultsList: [],
  searchFilterParams: {},
  searchResultsDisplayed: false,
  searchResultsFor: false,
  searchResultsSuccess: null,
  searchDebugQuery: false
};
const initialState = assign({
  cleared: false,

  defaultQueryState: 'none',
  defaultQueryFor: '',
  defaultQueryDebug: '',
  defaultQueryFilterParams: {},
  defaultQueryResults: '',
  defaultQueryResultsList: [],
  defaultQueryCount: 0,
}, clearSearchState);

function SearchContext(opts={}) {
  var ctx = this;
  var debounceTime = opts.debounceTime || 500;

  var search = Reflux.createAction({
    children: [
      "completed",
      "failed",
      "cancel"
    ]
  });

  var searchStore = ctx.store = Reflux.createStore({
    init () {
      this.filterParams = {};
      this.state = {
        searchState: 'none'
      };
    },
    update (items) {
      if (!items.cleared) {
        items.cleared = false;
      }
      assign(this.state, items);
      this.trigger(this.state);
    }
  });

  this.setFilterParams = function(p) {
    searchStore.filterParams = p;
  }

  search.listen(function(params={}, opts={}){
    /*
    search receives a params object with keys and values which get
    combined with the context defaults and turned into a proper request
    in this method and searchDataInterface.
    */
    var searchParams = assign({}, searchStore.filterParams, params);
    var tags = searchParams.tags || [];
    var parent = searchParams.parent;
    var cacheAsDefaultSearch = opts.cacheAsDefaultSearch;
    if (tags) {
      delete searchParams.tags;
    }
    if (parent) {
      delete searchParams.parent;
    }

    var searchQuery = _.values(searchParams);
    if (searchQuery.length > 1) {
      searchQuery = searchQuery.map(function(s){return `(${s})`}).join(' AND ');
    } else {
      searchQuery = searchQuery[0];
    }
    if (cacheAsDefaultSearch) {
      searchStore.update({
        defaultQueryState: 'loading',
        defaultQueryStr: params.string,
        defaultQueryTags: tags,
        defaultQueryParams: params,
      })
    } else {
      searchStore.update({
        searchState: 'loading',
        searchStr: params.string,
        searchTags: tags,
        searchParams: params,
      })
    }
    var searchDataObj = {
      q: searchQuery
    };
    if (parent) {
      searchDataObj.parent = parent;
    }
    searchParams.__builtQueryString = $.param(searchDataObj);
    searchDataInterface.assets(searchDataObj)
      .done(function(data){
        search.completed(searchParams, data, {
          cacheAsDefaultSearch: cacheAsDefaultSearch,
          tags: tags
        });
      })
      .fail(function(xhr){
        search.failed(xhr, searchParams);
      });
  });
  search.completed.listen(function(rawSearchParams, data, opts){
    data.results = data.results.map(assetParserUtils.parsed);

    var count = data.count,
        isEmpty = count === 0,
        tags = opts.tags;

    var searchParams = assign({}, searchStore.filterParams, rawSearchParams);

    var newState;

    if (opts.cacheAsDefaultSearch) {
      newState = {
        defaultQueryState: 'done',
        defaultQueryFor: searchParams,
        defaultQueryDebug: searchParams.__builtQueryString,
        defaultQueryFilterParams: searchStore.filterParams,
        defaultQueryResults: data,
        defaultQueryResultsList: data.results,
        defaultQueryCount: count,
      };
    } else {
      newState = {
        searchState: 'done',
        searchResultsFor: searchParams,
        searchDebugQuery: searchParams.__builtQueryString,
        searchBaseFilterParams: searchStore.filterParams,
        searchResults: data,
        searchTags: tags,
        searchResultsList: data.results,
        searchResultsCount: count,
      };

      // when to show search results (as opposed to default query)
      newState.searchResultsDisplayed = (function(){
        return true;
      })();
      newState.searchResultsSuccess = (function(){
        return count > 0;
      })();
    }
    searchStore.update(newState);
  });
  search.failed.listen(function(xhr, searchParams){
    searchStore.update({
      searchResultsSuccess: false,
      searchResultsDisplayed: true,
      searchState: 'none',
      searchResultsFor: searchParams,
      searchDebugQuery: `error on query: ${searchParams.__builtQueryString}`,
      searchErrorMessage: 'error on query',
      searchResults: { results: [] },
      searchResultsList: [],
      searchResultsCount: 0,
    });
  });
  search.cancel.listen(function(){
    searchStore.update(assign({
      cleared: true
    }, clearSearchState));
  })
  this.mixin = {
    searchValue: ( debounceTime ? _.debounce(search, debounceTime) : search ),
    searchStore: searchStore,
    searchDefault: function () {
      search({}, {
        cacheAsDefaultSearch: true
      });
    },
    getSearchActions: function(){
      return {
        search: search,
      }
    },
  };
};

var commonMethods = {
  getInitialState () {
    return initialState;
  },
  componentDidMount () {
    this.extendSearchContext();
  },
  extendSearchContext () {
    var ctx,
        passedCtx = this.props.searchContext || this.state.searchContext;
    if (passedCtx instanceof SearchContext) {
      ctx = passedCtx;
    } else {
      ctx = getSearchContext(passedCtx);
    }
    assign(this, ctx.mixin);
  },
  searchChangeEvent (evt) {
    var val = evt.target.value;
    if (val) {
      this.searchValue({
        string: val
      });
    } else {
      this.getSearchActions().search.cancel();
    }
  },
  searchClear () {
    this.getSearchActions().search.cancel();
  }
};

function isSearchContext (ctx) {
  return (ctx instanceof SearchContext);
}

var contexts = {};

function getSearchContext(name, opts={}) {
  if (!contexts[name]) {
    contexts[name] = new SearchContext();
  }
  if (opts.filterParams) {
    contexts[name].store.filterParams = opts.filterParams;
  }
  if (opts.showDefault) {
    contexts[name].store.showDefault = opts.showDefault;
  }
  return contexts[name];
}

module.exports = {
  getSearchContext: getSearchContext,
  common: commonMethods,
  isSearchContext: isSearchContext,
}