'use strict';

import {log, t} from './utils';

import {dataDispatch} from './data';

var sessionDispatch = dataDispatch;
var actions = require('./actions');
var Reflux = require('reflux');
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
  },
  historyClear () {
    localStorage.removeItem(this.__historyKey);
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

  onLoadAssetCompleted: function (resp, req, jqxhr) {
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = resp;
    this.noteRelatedUsers(resp);
    this.trigger(this.data, resp.uid);
  }
});

var sessionStore = Reflux.createStore({
  init () {
    this.listenTo(actions.auth.login.completed, this.onAuthLoginCompleted);
    var _this = this;
    sessionDispatch.selfProfile().then(function success(acct){
      actions.auth.login.completed(acct);
    });
  },
  getInitialState () {
    return {
      isLoggedIn: false
    }
  },
  onAuthLoginCompleted (acct) {
    if (acct.username) {
      this.currentAccount = acct;
      this.trigger({
        isLoggedIn: true,
        currentAccount: acct
      });
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


var stores = {
  history: historyStore,
  tags: tagsStore,
  pageState: pageStateStore,
  assetSearch: assetSearchStore,
  assetContent: assetContentStore,
  asset: assetStore,
  session: sessionStore,
};

module.exports = stores