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
  var jqxhrs = {};

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
      this.quietUpdate(items);
      this.triggerState();
    },
    triggerState () {
      this.trigger(this.state);
    },
    quietUpdate (items) {
      if (!items.cleared) {
        items.cleared = false;
      }
      assign(this.state, items);
    },
    removeItem (key) {
      delete this.state[key];
    },
    toDataObject () {
      var params = assign({}, this.filterParams, {
        tags: this.state.searchTags,
        string: this.state.searchString,
      });
      return params;
    },
    toQueryData (dataObject) {
      var searchParams = dataObject || this.toDataObject(),
          _searchParamsClone = assign({}, searchParams),
          paramGroups = [],
          queryData = {},
          qString;

      if ('tags' in searchParams) {
        if (searchParams.tags && searchParams.tags.length > 0) {
          paramGroups.push(
              searchParams.tags.map(function(t){
                return `tag:${t.value}`
              }).join(' OR ')
            );
        }
        delete searchParams.tags;
      }
      if ('string' in searchParams) {
        if (searchParams.string && searchParams.string.length > 0) {
          paramGroups.push(
              searchParams.string
            );
        }
        delete searchParams.string;
      }
      if ('parent' in searchParams) {
        if (searchParams.parent && searchParams.parent.length > 0) {
          queryData.parent = searchParams.parent;
        }
        delete searchParams.parent;
      }
      paramGroups = paramGroups.concat(_.values(searchParams));

      if (paramGroups.length > 1) {
        queryData.q = paramGroups.map(function(s){return `(${s})`}).join(' AND ');
      } else if (paramGroups.length === 1) {
        queryData.q = paramGroups[0];
      }
      return queryData;
    },
  });

  search.listen(function(opts={}){
    /*
    search will query whatever values are in the store
    and will pass the values back to the store to be reflected
    in the components' states.
    */
    var dataObject = searchStore.toDataObject();
    var _dataObjectClone = assign({}, dataObject)
    var qData = searchStore.toQueryData(dataObject);

    var isSearch = !opts.cacheAsDefaultSearch;

    if (isSearch) {
      // cancel existing searches
      if (jqxhrs.search) {
        jqxhrs.search.abort();
        jqxhrs.search = false;
      }
    }
    var req = searchDataInterface.assets(qData)
      .done(function(data){
        search.completed(dataObject, data, {
          cacheAsDefaultSearch: opts.cacheAsDefaultSearch,
        });
      })
      .fail(function(xhr){
        search.failed(xhr, dataObject);
      });

    jqxhrs[ isSearch ? 'search' : 'default' ] = req;

    log('searchFor ', _dataObjectClone);
    if (isSearch) {
      searchStore.update({
        searchState: 'loading',
        searchFor: _dataObjectClone,
      })
    } else {
      searchStore.update({
        defaultQueryState: 'loading',
        defaultQueryFor: _dataObjectClone,
      })
    }
  });

  search.completed.listen(function(searchParams, data, opts){
    data.results = data.results.map(assetParserUtils.parsed);

    var count = data.count,
        isEmpty = count === 0;

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
        searchTags: searchParams.tags,
        searchResultsList: data.results,
        searchResultsCount: count,

        // when to show search results (as opposed to default query)
        searchResultsDisplayed: true,
        searchResultsSuccess: count > 0,
      };
    }
    searchStore.update(newState);
  });
  search.failed.listen(function(xhr, searchParams){
    searchStore.update({
      searchState: 'failed',
    })
    log('failed');
    // searchStore.update({
    //   searchResultsSuccess: false,
    //   searchResultsDisplayed: true,
    //   searchState: 'none',
    //   searchResultsFor: searchParams,
    //   searchDebugQuery: `error on query: ${searchParams.__builtQueryString}`,
    //   searchErrorMessage: 'error on query',
    //   searchResults: { results: [] },
    //   searchResultsList: [],
    //   searchResultsCount: 0,
    // });
  });
  search.cancel.listen(function(){
    if (jqxhrs.search) {
      jqxhrs.search.abort();
    }
    searchStore.update(assign({
      cleared: true
    }, clearSearchState));
  })
  this.mixin = {
    debouncedSearch: ( debounceTime ? _.debounce(search, debounceTime) : search ),
    searchValue: search,
    updateStore (vals) {
      searchStore.update(vals);
    },
    quietUpdateStore (vals) {
      searchStore.quietUpdate(vals);
    },
    searchStore: searchStore,
    searchDefault: function () {
      search({
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
  searchTagsChange (tags) {
    this.quietUpdateStore({
      searchTags: tags
    });
    this.searchValue();
  },
  searchChangeEvent (evt) {
    var val = evt.target.value;
    if (val) {
      this.quietUpdateStore({
        searchString: val,
      });
      this.debouncedSearch();
    } else {
      this.clearSearchStringAndCancel();
    }
  },
  clearSearchStringAndCancel () {
    this.searchStore.removeItem('searchString');
    this.getSearchActions().search.cancel();
  },
  searchClear () {
    this.getSearchActions().search.cancel();
  },
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