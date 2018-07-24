/*
 the 'searches' modules provides a combination of
 Reflux.actions and Reflux.stores which trigger and store
 searches in different contexts.
*/
import _ from 'underscore';
import Reflux from 'reflux';
import $ from 'jquery';

import stores from './stores';
import actions from './actions';
import {dataInterface} from './dataInterface';
import {assign} from './utils';
import assetParserUtils from './assetParserUtils';

var searchDataInterface = (function(){
  return {
    assets: function(data) {
      // raise limit temporarily to 200
      data.limit = 200;
      return $.ajax({
        url: `${dataInterface.rootUrl}/assets/`,
        dataType: 'json',
        data: data,
        method: 'GET'
      });
    }
  };
})();

const clearSearchState = {
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
}, clearSearchState);

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
  var latestSearchData;

  var searchStore = ctx.store = Reflux.createStore({
    init () {
      this.filterParams = {};
      this.state = {
        searchState: 'none',
      };

      this.listenTo(actions.resources.updateAsset.completed, this.onUpdateAsset);
      this.listenTo(actions.resources.deployAsset.completed, this.onDeployAsset);
      this.listenTo(actions.resources.deleteAsset.completed, this.onDeleteAsset);
    },
    onUpdateAsset(asset, uid, values) {
      const assetBefore = _.find(this.state.defaultQueryResultsList, (result) => {
        return result.uid === asset.uid;
      });
      if (assetBefore && assetBefore.name !== asset.name) {
        this.silentAssetNameUpdate(uid, asset.name);
      }
    },
    onDeployAsset(data, dialog_or_alert, redeployment, uid) {
      if (redeployment === false) {
        this.silentAssetMoveToDeployed(uid);
      }
    },
    onDeleteAsset(asset) {
      var filterOutDeletedAsset = ({listName}) => {
        if (this.state[listName] != undefined) {
          let uid = asset.uid;
          let listLength = this.state[listName].length;
          let l = this.state[listName].filter(function(result){
            return result.uid !== uid;
          });
          if (l.length !== listLength) {
            let o = {};
            o[listName] = l;
            this.update(o);
          }
        }
      };
      var filterOutDeletedAssetFromCategorizedList = () => {
        let list = this.state.defaultQueryCategorizedResultsLists;
        if (list) {
          var l = {};
          for (var category in list) {
            l[category] = list[category].filter(function(result){
              return result.uid !== asset.uid;
            });
          }
          let o = {};
          o.defaultQueryCategorizedResultsLists = l;
          this.update(o);
        }
      };
      filterOutDeletedAsset({listName: 'defaultQueryResultsList'});
      filterOutDeletedAssetFromCategorizedList();
      if (this.state.searchResultsList && this.state.searchResultsList.length > 0) {
        filterOutDeletedAsset({listName: 'searchResultsList'});
      }
    },
    silentAssetNameUpdate(uid, newName) {
      const updateObj = {};

      const defaultQueryResultsList = this.state.defaultQueryResultsList;
      if (defaultQueryResultsList) {
        for (const asset of defaultQueryResultsList) {
          if (asset.uid === uid) {asset.name = newName;}
        }
        updateObj.defaultQueryResultsList = defaultQueryResultsList;
      }

      const defaultQueryCategorizedResultsLists = this.state.defaultQueryCategorizedResultsLists;
      if (defaultQueryCategorizedResultsLists) {
        for (const asset of defaultQueryCategorizedResultsLists.Draft) {
          if (asset.uid === uid) {
            asset.name = newName;
          }
        }
        for (const asset of defaultQueryCategorizedResultsLists.Deployed) {
          if (asset.uid === uid) {
            asset.name = newName;
          }
        }
        updateObj.defaultQueryCategorizedResultsLists = defaultQueryCategorizedResultsLists;
      }

      this.update(updateObj);
    },
    silentAssetMoveToDeployed(uid) {
      let targetAsset;

      console.log('silentAssetMoveToDeployed', uid);

      const defaultQueryCategorizedResultsLists = this.state.defaultQueryCategorizedResultsLists;
      if (defaultQueryCategorizedResultsLists) {
        console.log('before', defaultQueryCategorizedResultsLists.Draft.length, defaultQueryCategorizedResultsLists.Deployed.length);

        for (let i = 0; i < defaultQueryCategorizedResultsLists.Draft; i++) {
          const asset = defaultQueryCategorizedResultsLists.Draft[i];
          if (asset.uid === uid) {
            // TODO LESZEK: fix here
            targetAsset = defaultQueryCategorizedResultsLists.Draft.splice(i, 1)[0];
          }
        }
        if (targetAsset) {
          defaultQueryCategorizedResultsLists.Deployed.unshift(targetAsset);
        }

        console.log('after', defaultQueryCategorizedResultsLists.Draft.length, defaultQueryCategorizedResultsLists.Deployed.length);

        this.update({
          defaultQueryCategorizedResultsLists: defaultQueryCategorizedResultsLists
        });
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
    var req = searchDataInterface.assets(qData)
      .done(function(data){
        search.completed(dataObject, data, {
          cacheAsDefaultSearch: _opts.cacheAsDefaultSearch,
        });
      })
      .fail(function(xhr){
        search.failed(xhr, dataObject);
      });

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
    searchDataInterface.assets(latestSearchData.params)
      .done(function(data){
        search.completed(latestSearchData.dataObject, data, {
          cacheAsDefaultSearch: false,
        });
      })
      .fail(function(xhr){
        search.failed(xhr, latestSearchData.dataObject);
      });
  });

  search.completed.listen(function(searchParams, data, _opts){
    data.results = data.results.map(assetParserUtils.parsed);
    data.results.forEach(stores.allAssets.registerAssetOrCollection);

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
        defaultQueryCategorizedResultsLists: {
          'Deployed': data.results.filter((asset) => {
            return asset.has_deployment && asset.deployment__active;
          }),
          'Draft': data.results.filter((asset) => {
            return !asset.has_deployment;
          }),
          'Archived': data.results.filter((asset) => {
            return asset.has_deployment && !asset.deployment__active;
          }),
          'Deleted': [], // not implemented yet
        }
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
        searchResultsCategorizedResultsLists: {
          'Deployed': data.results.filter((asset) => {
            return asset.has_deployment && asset.deployment__active;
          }),
          'Draft': data.results.filter((asset) => {
            return !asset.has_deployment;
          }),
          'Archived': data.results.filter((asset) => {
            return asset.has_deployment && !asset.deployment__active;
          }),
          'Deleted': [], // not implemented yet
        }
      };
    }
    searchStore.update(newState);
  });
  search.failed.listen(function(/*xhr, searchParams*/){
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
    }, clearSearchState));
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
    searchDefault: function () {
      searchStore.quietUpdate(assign({
        cleared: true,
        searchString: false,
      }, clearSearchState));

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
  searchCollectionChange (collectionUid) {
    this.quietUpdateStore({
      parentUid: collectionUid
    });
    this.searchValue();
  },
  searchChangeEvent (evt) {
    this.quietUpdateStore({
      searchString: evt.target.value,
    });
    this.debouncedSearch();
  },
  refreshSearch () {
    this.debouncedSearch();
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

module.exports = {
  getSearchContext: getSearchContext,
  common: commonMethods,
  isSearchContext: isSearchContext,
};
