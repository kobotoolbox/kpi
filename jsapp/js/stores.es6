'use strict';

import {log, t, parsePermissions} from './utils';

import {dataInterface} from './dataInterface';

var actions = require('./actions');
var Reflux = require('reflux');
var Immutable = require('immutable');
var assign = require('react/lib/Object.assign');

function changes(orig_obj, new_obj) {
  var out = {},
      any = false;
  Object.keys(new_obj).forEach(function(key) {
    if (orig_obj[key] !== new_obj[key]) {
      out[key] = new_obj[key];
      any = true;
    }
  });
  if (!any) {
    return false;
  }
  return out;
}
var stores = {};

var assetLibraryStore = Reflux.createStore({
  init () {
    this.results = [];
    this.listenTo(actions.search.libraryDefaultQuery.completed, this.libraryDefaultDone)
  },
  libraryDefaultDone (res) {
    this.results = res;
    this.trigger(res);
  }
});


var historyStore = Reflux.createStore({
  __historyKey: 'user.history',
  init () {
    if (this.__historyKey in localStorage) {
      try {
        this.history = JSON.parse(localStorage.getItem(this.__historyKey));
      } catch (e) {
        console.error("could not load history from localStorage", e);
      }
    }
    if (!this.history) {
      this.history = [];
    }
    this.listenTo(actions.navigation.historyPush, this.historyPush);
    this.listenTo(actions.auth.logout.completed, this.historyClear);
    this.listenTo(actions.resources.deleteAsset.completed, this.onDeleteAssetCompleted);
  },
  historyClear () {
    localStorage.removeItem(this.__historyKey);
  },
  onDeleteAssetCompleted (deleted) {
    var oneDeleted = false;
    this.history = this.history.filter(function(asset){
      var match = asset.uid === deleted.uid;
      if (match) {
        oneDeleted = true;
      }
      return !match;
    });
    if (oneDeleted) {
      this.trigger(this.history);
    }
  },
  historyPush (item) {
    this.history = [
      item, ...this.history.filter(function(xi){ return item.uid !== xi.uid; })
    ];
    localStorage.setItem(this.__historyKey, JSON.stringify(this.history));
    this.trigger(this.history);
  }
});

var tagsStore = Reflux.createStore({
  init () {
    this.queries = {};
    this.listenTo(actions.resources.listTags.completed, this.listTagsCompleted)
  },
  listTagsCompleted (data) {
    this.trigger(data.results);
  }
});

const MAX_SEARCH_AGE = (5 * 60) // seconds

var assetSearchStore = Reflux.createStore({
  init () {
    this.queries = {};
    this.listenTo(actions.search.assets.completed, this.onAssetSearch);
  },
  getRecentSearch (queryString) {
    if (queryString in this.queries) {
      var age = new Date().getTime() - this.queries[queryString][1].getTime();
      if (age < MAX_SEARCH_AGE * 1000) {
        return this.queries[queryString][0];
      }
    }
    return false;
  },
  onAssetSearch (queryString, results) {
    results.query=queryString;
    this.queries[queryString] = [results, new Date()];
    if(results.count > 0) {
      this.trigger(results);
    }
  }
});

var pageStateStore = Reflux.createStore({
  init () {
    this.state = {
      bgTopPanelHeight: 60,
      bgTopPanelFixed: false,
      headerSearch: true,
      assetNavPresent: false,
      assetNavIsOpen: true,
      assetNavIntentOpen: true,
      sidebarIsOpen: true,
      sidebarIntentOpen: true
    }
  },
  setTopPanel (height, isFixed) {
    var changed = changes(this.state, {
      bgTopPanelHeight: height,
      bgTopPanelFixed: isFixed
    });

    if (changed) {
      assign(this.state, changed);
      this.trigger(changed);
    }
  },
  toggleSidebarIntentOpen () {
    var newIntent = !this.state.sidebarIntentOpen,
        isOpen = this.state.sidebarIsOpen,
        changes = {
          sidebarIntentOpen: newIntent
        };
    // xor
    if ( (isOpen || newIntent) && !(isOpen && newIntent) ) {
      changes.sidebarIsOpen = !isOpen;
    }
    assign(this.state, changes);
    this.trigger(changes);
  },
  hideSidebar () {
    var changes = {};
    if (this.state.sidebarIsOpen) {
      changes.sidebarIsOpen = false;
      assign(this.state, changes)
      this.trigger(changes);
    }
  },
  showSidebar () {
    var changes = {};
    if (!this.state.sidebarIsOpen) {
      changes.sidebarIsOpen = true;
      assign(this.state, changes)
      this.trigger(changes);
    }
  },
  toggleAssetNavIntentOpen () {
    var newIntent = !this.state.assetNavIntentOpen,
        isOpen = this.state.assetNavIsOpen,
        changes = {
          assetNavIntentOpen: newIntent
        };

    // xor
    if ( (isOpen || newIntent) && !(isOpen && newIntent) ) {
      changes.assetNavIsOpen = !isOpen;
    }
    assign(this.state, changes);
    this.trigger(changes);
  },
  setHeaderSearch (tf) {
    var newVal = !!tf;
    if (newVal !== this.state.headerSearch) {
      this.state.headerSearch = !!tf;
      var changes = {
        headerSearch: this.state.headerSearch,
        assetNavPresent: !this.state.headerSearch,
        assetNavIsOpen: !this.state.headerSearch
      };
      assign(this.state, changes);
      this.trigger(changes);
    }
  }
});

stores.assetPreview = Reflux.createStore({
  init () {
    this.listenTo(actions.resources.generatePreview.completed, this.previewCreated);
  },
  previewCreated (...args) {
    log('preview created1!', args);
    this.trigger(args);
  },
});
var assetStore = Reflux.createStore({
  init: function () {
    this.data = {};
    this.relatedUsers = {};
    this.listenTo(actions.resources.loadAsset.completed, this.onLoadAssetCompleted)
    this.listenTo(actions.resources.updateAsset.completed, this.onUpdateAssetCompleted);
  },

  noteRelatedUsers: function (data) {
    // this preserves usernames in the store so that the list does not
    // reorder or drop users depending on subsequent server responses
    if (!this.relatedUsers[data.uid]) {
      this.relatedUsers[data.uid] = [];
    }

    var relatedUsers = this.relatedUsers[data.uid];
    data.permissions.forEach(function (perm) {
      var username = perm.user.match(/\/users\/(.*)\//)[1];
      var isOwnerOrAnon = username === data.owner__username || username === 'AnonymousUser';
      if (!isOwnerOrAnon && relatedUsers.indexOf(username) === -1) {
        relatedUsers.push(username)
      }
    });
  },

  onUpdateAssetCompleted: function (resp, req, jqhr){
    this.data[resp.uid] = resp;
    this.noteRelatedUsers(resp);
    this.trigger(this.data, resp.uid, {asset_updated: true});
  },
  parsePermissions (resp) {
    var out = {};
    var pp = parsePermissions(resp.owner__username, resp.permissions);
    out.parsedPermissions = pp;
    out.access = (()=>{
      var viewers = {};
      var changers = {};
      var isPublic = false;
      pp.forEach(function(userPerm){
        if (userPerm.can.view) {
          viewers[userPerm.username] = true;
        }
        if (userPerm.can.change) {
          changers[userPerm.username] = true;
        }
        if (userPerm.username === 'AnonymousUser') {
          isPublic = !!userPerm.can.view;
        }
      });
      return {view: viewers, change: changers, ownerUsername: resp.owner__username, isPublic: isPublic};
    })()
    return out;
  },
  parseTags(asset) {
    return {
      tags: asset.tag_string.split(',').filter((tg) => { return tg.length > 1; })
    }
  },
  parsed (asset) {
    return assign(asset,
        this.parsePermissions(asset),
        this.parseTags(asset))
  },
  onLoadAssetCompleted: function (resp, req, jqxhr) {
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = this.parsed(resp);
    log(this.data[resp.uid]);
    this.noteRelatedUsers(resp);
    this.trigger(this.data, resp.uid);
  }
});

var sessionStore = Reflux.createStore({
  init () {
    this.listenTo(actions.auth.login.loggedin, this.triggerLoggedIn);
    this.listenTo(actions.auth.login.passwordfail, ()=> {

    });
    this.listenTo(actions.auth.login.failed, () => {

    });
    this.listenTo(actions.auth.verifyLogin.loggedin, this.triggerLoggedIn);
    this.listenTo(actions.auth.verifyLogin.anonymous, (data)=>{
      log('login confirmed anonymous', data.message);
    });
    this.listenTo(actions.auth.verifyLogin.failed, (xhr)=> {
      log('login not verified', xhr.status, xhr.statusText);
    });
    actions.auth.verifyLogin();
    // dataInterface.selfProfile().then(function success(acct){
    //   actions.auth.login.completed(acct);
    // });
  },
  getInitialState () {
    return {
      isLoggedIn: false,
      sessionIsLoggedIn: false
    }
  },
  triggerAnonymous (data) {

  },
  triggerLoggedIn (acct) {
    this.currentAccount = acct;
    this.trigger({
      isLoggedIn: true,
      sessionIsLoggedIn: true,
      sessionAccount: acct,
      currentAccount: acct
    });
  },
  onAuthLoginCompleted (acct) {
    if (acct.username) {
    } else {
      this.currentAccount = false;
      this.trigger({
        isLoggedIn: false,
        currentAccount: false
      });
    }
  }
});

var assetContentStore = Reflux.createStore({
  init: function () {
    this.data = {};
    this.surveys = {};
    this.listenTo(actions.resources.loadAssetContent.completed, this.onLoadAssetContentCompleted);
  },
  onLoadAssetContentCompleted: function(resp, req, jqxhr) {
    this.data[resp.uid] = resp;
    this.trigger(this.data, resp.uid);
  },
});

var allAssetsStore = Reflux.createStore({
  init: function () {
    this.data = [];
    this.byUid = {};
    this.listenTo(actions.resources.listAssets.completed, this.onListAssetsCompleted);
    this.listenTo(actions.resources.listAssets.failed, this.onListAssetsFailed);
    this.listenTo(actions.resources.deleteAsset.completed, this.onDeleteAssetCompleted);
    this.listenTo(actions.resources.createAsset.completed, this.onCreateAssetCompleted);

  },
  onCreateAssetCompleted (asset) {
    this.byUid[asset.uid] = asset;
    this.data.unshift(asset);
    this.trigger(this.data);
  },
  onListAssetsFailed: function (err) {
    debugger
  },
  onDeleteAssetCompleted (asset) {
    this.byUid[asset.uid].deleted = 'true';
    this.trigger(this.data);
    window.setTimeout(()=> {
      this.data = this.data.filter(function(item){
        return item.uid !== asset.uid;
      });
      this.trigger(this.data);
    }, 500);
  },
  registerAssetOrCollection (asset) {
    this.byUid[asset.uid] = asset;
  },
  onListAssetsCompleted: function(resp, req, jqxhr) {
    resp.results.forEach(this.registerAssetOrCollection)
    this.data = resp.results;
    this.trigger(this.data);
  }
});

var selectedAssetStore = Reflux.createStore({
  init () {
    this.uid = false;
  },
  toggleSelect (uid) {
    if (this.uid === uid) {
      this.uid = false;
      this.asset = {};
      return false;
    } else {
      this.uid = uid;
      this.asset = allAssetsStore.byUid[uid]
      return true;
    }
  }
});

var collectionAssetsStore = Reflux.createStore({
  init () {
    this.collections = {};
    this.listenTo(actions.resources.readCollection.completed, this.readCollectionCompleted);
  },
  readCollectionCompleted (data, x, y) {
    data.children.forEach((childAsset)=> {
      stores.allAssets.registerAssetOrCollection(childAsset);
    });
    this.collections[data.uid] = data;
    this.trigger(data, data.uid);
  }
});

var userExistsStore = Reflux.createStore({
  init () {
    this.checked = {};
    this.listenTo(actions.misc.checkUsername.completed, this.usernameExists);
    this.listenTo(actions.misc.checkUsername.failed_, this.usernameDoesntExist);
  },
  checkUsername (username) {
    if (username in this.checked) {
      return this.checked[username];
    }
  },
  usernameExists (username) {
    this.checked[username] = true;
    this.trigger(this.checked, username)
  },
  usernameDoesntExist (username) {
    this.checked[username] = false;
    this.trigger(this.checked, username)
  }
});

assign(stores, {
  history: historyStore,
  tags: tagsStore,
  pageState: pageStateStore,
  assetSearch: assetSearchStore,
  selectedAsset: selectedAssetStore,
  assetContent: assetContentStore,
  asset: assetStore,
  assetLibrary: assetLibraryStore,
  collectionAssets: collectionAssetsStore,
  allAssets: allAssetsStore,
  session: sessionStore,
  userExists: userExistsStore,
});

module.exports = stores