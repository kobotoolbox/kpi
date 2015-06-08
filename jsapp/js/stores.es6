'use strict';

import {log, t} from './utils';

var actions = require('./actions');
var Reflux = require('reflux');

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


var stores = {
  history: historyStore,
  tags: tagsStore,
  assetSearch: assetSearchStore,
};

module.exports = stores