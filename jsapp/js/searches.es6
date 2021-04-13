/**
 * This module provides a combination of Reflux actions and stores that trigger
 * and keep searches data in different contexts. Most of the times it should be
 * your de facto way of getting a lists of assets, as to use global search
 * context everywhere.
 */

import _ from 'underscore';
import Reflux from 'reflux';
import SparkMD5 from 'spark-md5';

import {stores} from './stores';
import {actions} from './actions';
import {dataInterface} from './dataInterface';
import {assign} from 'utils';
import {parsed} from './assetParserUtils';

const emptySearchState = {
  searchState: 'none',
  searchResults: false,
  searchResultsList: [],
  searchFilterParams: {},
  searchResultsDisplayed: false,
  searchResultsFor: false,
  searchResultsSuccess: null,
  searchDebugQuery: false,
  searchResultsCount: 0,
  parentUid: false,
  parentName: false,
  allPublic: false,
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
}, emptySearchState);

function SearchContext(opts={}) {
  var ctx = this;
  var debounceTime = opts.debounceTime || 500;
  var jqxhrs = {};

  var search = Reflux.createAction({
    children: [
      'completed',
      'failed',
      'cancel',
      'refresh',
    ]
  });

  let latestSearchData;

  const searchStore = ctx.store = Reflux.createStore({
    init () {
      this.filterParams = {};
      this.state = {
        searchState: 'none',
      };

      this.listenTo(actions.resources.updateAsset.completed, this.setAsset);
      this.listenTo(actions.resources.deployAsset.completed, this.setAsset);
      this.listenTo(actions.resources.createResource.completed, this.setAsset);
      this.listenTo(actions.resources.cloneAsset.completed, this.setAsset);
      this.listenTo(actions.resources.setDeploymentActive.completed, this.setAsset);
      this.listenTo(actions.resources.deleteAsset.completed, this.removeAsset);
      this.listenTo(actions.permissions.removeAssetPermission.completed, this.removeAsset);
    },
    // add/update asset in all search store lists
    setAsset(asset) {
      // only update things if given asset matches the current context types
      if (this.state.defaultQueryFilterParams?.assetType.includes(asset.asset_type)) {
        this.setAssetInList(asset, 'defaultQueryResultsList');
        this.setAssetInList(asset, 'searchResultsList');
        this.rebuildCategorizedList(
          this.state.defaultQueryResultsList,
          'defaultQueryCategorizedResultsLists'
        );
        this.rebuildCategorizedList(
          this.state.searchResultsList,
          'searchResultsCategorizedResultsLists'
        );
      }
    },
    setAssetInList(asset, listName) {
      const list = this.state[listName];
      if (list && list.length !== 0) {
        const updateObj = {};
        let isNewAsset = true;
        for (let i = 0; i < list.length; i++) {
          if (list[i].uid === asset.uid) {
            list[i] = asset;
            isNewAsset = false;
            break;
          }
        }
        if (isNewAsset) {
          // we add asset on top, because it's update event (freshly modified)
          list.unshift(asset);
        }
        updateObj[listName] = list;
        this.update(updateObj);
      }
    },
    rebuildCategorizedList(sourceResults, listName) {
      const catList = this.state[listName];
      const defaultResults = this.state.defaultQueryResultsList;
      if (catList && sourceResults && sourceResults.length !== 0) {
        const updateObj = {};
        updateObj[listName] = splitResultsToCategorized(sourceResults);
        this.update(updateObj);
      }
    },
    // remove asset from all search store lists
    removeAsset(assetOrUid, isNonOwner) {
      let asset;
      if (typeof assetOrUid === 'object') {
        asset = assetOrUid;
      } else {
        asset = stores.selectedAsset.asset || stores.allAssets.byUid[assetOrUid];
      }
      // non-owner self permission removal only gives an assetUid string, not
      // an object; for consistency we make it an object here
      // only runs if `isNonOwner` is true, so no need to add `assetType` to
      // fake object
      if (!asset) {
       asset = {uid: assetOrUid};
      }

      // only update things if given asset matches the current context types or
      // a non-owner removed their own permissions
      if (
        isNonOwner ||
        this.state.defaultQueryFilterParams?.assetType.includes(asset.assetType)
      ) {
        this.removeAssetFromList(asset.uid, 'defaultQueryResultsList');
        this.removeAssetFromList(asset.uid, 'searchResultsList');
        this.rebuildCategorizedList(
          this.state.defaultQueryResultsList,
          'defaultQueryCategorizedResultsLists'
        );
        this.rebuildCategorizedList(
          this.state.searchResultsList,
          'searchResultsCategorizedResultsLists'
        );
      }
    },
    removeAssetFromList(assetUid, listName) {
      let list = this.state[listName];
      if (list && list.length !== 0) {
        const updateObj = {};
        list = list.filter((asset) => {
          return asset.uid !== assetUid;
        });
        updateObj[listName] = list;
        this.update(updateObj);
      }
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
    filterTagQueryData () {
      if (this.filterTags) {
        return {
          q: this.filterTags,
        };
      }
    },
    removeItem (key) {
      delete this.state[key];
    },
    toDataObject () {
      var params = {};
      if (this.state.searchTags) {
        params.tags = this.state.searchTags;
      }
      if (this.state.searchString) {
        params.string = this.state.searchString;
      }
      if (this.state.parentUid) {
        params.parentUid = `parent__uid:${this.state.parentUid}`;
      }
      if (this.state.parentName) {
        params.parentName = this.state.parentName;
      }
      if (this.state.allPublic === true) {
        params.allPublic = true;
      }
      return assign({}, this.filterParams, params);
    },
    toQueryData (dataObject) {
      var searchParams = dataObject || this.toDataObject(),
          // _searchParamsClone = assign({}, searchParams),
          paramGroups = [],
          queryData = {};

      if ('tags' in searchParams) {
        if (searchParams.tags && searchParams.tags.length > 0) {
          paramGroups.push(
              searchParams.tags.map(function(t){
                return `tag:"${t.value}"`;
              }).join(' AND ')
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
      if ('allPublic' in searchParams) {
        queryData.all_public = searchParams.allPublic;
        delete searchParams.allPublic;
      }
      if ('parentName' in searchParams) {
        delete searchParams.parentName;
      }
      paramGroups = paramGroups.concat(_.values(searchParams));
      if (paramGroups.length > 1) {
        queryData.q = paramGroups.map(function(s){
          return `(${s})`;
        }).join(' AND ');
      } else if (paramGroups.length === 1) {
        queryData.q = paramGroups[0];
      }
      return queryData;
    },
  });

  const splitResultsToCategorized = function (results) {
    return {
      Deployed: results.filter((asset) => {
        return asset.has_deployment && asset.deployment__active;
      }),
      Draft: results.filter((asset) => {
        return !asset.has_deployment;
      }),
      Archived: results.filter((asset) => {
        return asset.has_deployment && !asset.deployment__active;
      })
    }
  };

  const assetsHash = function (assets) {
    if (assets.length < 1) return false;

    let assetVersionIds = assets.map((asset) => {
      return asset.version_id;
    });
    // Sort alphabetically, same as backend sort
    assetVersionIds.sort();

    return SparkMD5.hash(assetVersionIds.join(''));
  }

  search.listen(function(_opts={}){
    /*
    search will query whatever values are in the store
    and will pass the values back to the store to be reflected
    in the components' states.
    */
    var dataObject = searchStore.toDataObject();
    var _dataObjectClone = assign({}, dataObject);
    var qData = searchStore.toQueryData(dataObject);
    var isSearch = !_opts.cacheAsDefaultSearch;

    // we can clean this up later, but right now, if the search query is empty
    // it cancels the search
    /*
    if (((d)=>{
      if (_opts.cacheAsDefaultSearch) {
        return false;
      }

      var hasTags = d.tags && d.tags.length && d.tags.length > 0;
      var hasString = d.string && d.string.length && d.string.length > 0;
      return !hasTags && !hasString;
    })(_dataObjectClone)) {
      return search.cancel();
    }
    */
    if (isSearch) {
      // cancel existing searches
      if (jqxhrs.search) {
        jqxhrs.search.searchAborted = true;
        jqxhrs.search.abort();
        jqxhrs.search = false;
      }
    }
    latestSearchData = {params: qData, dataObject: dataObject};
    var req = actions.search.assets(qData, {
      onComplete: function(searchData, response) {
        search.completed(dataObject, response, {
          cacheAsDefaultSearch: _opts.cacheAsDefaultSearch,
        });
      },
      onFailed: function(searchData, response) {
        search.failed(response, dataObject);
      }
    })

    jqxhrs[ isSearch ? 'search' : 'default' ] = req;

    if (isSearch) {
      searchStore.update({
        searchState: 'loading',
        searchFor: _dataObjectClone,
      });
    } else {
      searchStore.update({
        defaultQueryState: 'loading',
        defaultQueryFor: _dataObjectClone,
      });
    }
  });
  search.refresh.listen(function(){
    actions.search.assets(latestSearchData.params, {
      onComplete: function(searchData, response) {
        search.completed(latestSearchData.dataObject, response, {
          cacheAsDefaultSearch: false,
        });
      },
      onFailed: function(searchData, response) {
        search.failed(response, latestSearchData.dataObject);
      }
    });
  });

  search.completed.listen(function(searchParams, data, _opts){
    data.results = data.results.map(parsed);
    data.results.forEach(stores.allAssets.registerAsset);

    var count = data.count;

    var newState;

    if (_opts.cacheAsDefaultSearch) {
      newState = {
        defaultQueryState: 'done',
        defaultQueryFor: searchParams,
        defaultQueryDebug: searchParams.__builtQueryString,
        defaultQueryFilterParams: searchStore.filterParams,
        defaultQueryResults: data,
        defaultQueryResultsList: data.results,
        defaultQueryCount: count,
        defaultQueryCategorizedResultsLists: splitResultsToCategorized(data.results)
      };
    } else {
      newState = {
        searchState: 'done',
        searchResultsFor: searchParams,
        searchDebugQuery: searchParams.__builtQueryString,
        searchBaseFilterParams: searchStore.filterParams,
        searchResults: data,
        // toQueryData() deletes searchParams.tags
        //searchTags: searchParams.tags,
        searchResultsList: data.results,
        searchResultsCount: count,

        // when to show search results (as opposed to default query)
        searchResultsDisplayed: true,
        searchResultsSuccess: count > 0,
        searchResultsCategorizedResultsLists: splitResultsToCategorized(data.results)
      };
    }
    searchStore.update(newState);
  });
  search.failed.listen(function(/*searchData, response*/){
    // if (xhr.searchAborted) {
    //   log('search was canceled because a new search came up')
    // }
    // searchStore.update({
    //   searchState: 'failed',
    // })
  });
  search.cancel.listen(function(){
    if (jqxhrs.search) {
      jqxhrs.search.abort();
    }
    searchStore.update(assign({
      cleared: true
    }, emptySearchState));
  });
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
    searchSemaphore: function () {
      // when searchStore exists, display current result set and compare hashes in background,
      // if hashes don't match, relaunch search (otherwise, current result set is same as BE)

      if (searchStore.state.defaultQueryResultsList === undefined) {
        this.searchDefault();
      } else {
        searchStore.update({defaultQueryState: 'done'});

        dataInterface.assetsHash()
          .done((data) => {
            if (data.hash && data.hash !== assetsHash(searchStore.state.defaultQueryResultsList)) {
              // if hashes don't match launch new search request
              this.searchDefault();
            }
          })
          .fail(() => {
            this.searchDefault();
          });
      }
    },
    searchDefault: function () {
      searchStore.quietUpdate(assign({
        cleared: true,
        searchString: false,
      }, emptySearchState));

      search({
        cacheAsDefaultSearch: true
      });
    },
    getSearchActions: function(){
      return {
        search: search,
      };
    },
  };
}

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
  searchCollectionChange (assetUid) {
    this.quietUpdateStore({
      parentUid: assetUid
    });
    this.searchValue();
  },
  searchChangeEvent (evt) {
    let searchString = evt.target.value.trim();
    // don't trigger search on identical strings (e.g. multiple spaces)
    if (this.searchStore.state.searchString !== searchString) {
      this.quietUpdateStore({
        searchString: searchString,
      });
      this.debouncedSearch();
    }
  },
  searchClear () {
    this.searchStore.removeItem('searchString');
    this.searchStore.removeItem('searchTags');
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
  if (opts.filterTags) {
    contexts[name].store.filterTags = opts.filterTags;
  }
  return contexts[name];
}

export const searches = {
  getSearchContext: getSearchContext,
  common: commonMethods,
  isSearchContext: isSearchContext,
};
