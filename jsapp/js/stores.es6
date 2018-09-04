import Reflux from 'reflux';
import cookie from 'react-cookie';
import alertify from 'alertifyjs';

import dkobo_xlform from '../xlform/src/_xlform.init';
import assetParserUtils from './assetParserUtils';
import actions from './actions';
import {
  log,
  t,
  notify,
  assign,
} from './utils';

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

var tagsStore = Reflux.createStore({
  init () {
    this.queries = {};
    this.listenTo(actions.resources.listTags.completed, this.listTagsCompleted);
  },
  listTagsCompleted (data) {
    this.trigger(data.results);
  }
});

const MAX_SEARCH_AGE = (5 * 60); // seconds

var surveyStateStore = Reflux.createStore({
  init () {
    this.state = {};
  },
  setState (state) {
    var chz = changes(this.state, state);
    if (chz) {
      assign(this.state, state);
      this.trigger(chz);
    }
  },
});

var assetSearchStore = Reflux.createStore({
  init () {
    this.queries = {};
    this.listenTo(actions.search.assets.completed, this.onSearchAssetsCompleted);
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
  onSearchAssetsCompleted (searchData, response) {
    response.query = searchData.q;
    this.queries[searchData.q] = [response, new Date()];
    if(response.count > 0) {
      this.trigger(response);
    }
  }
});

var pageStateStore = Reflux.createStore({
  init () {
    this.state = {
      assetNavExpanded: false,
      showFixedDrawer: false
    };
  },
  setState (chz) {
    var changed = changes(this.state, chz);
    if (changed) {
      assign(this.state, changed);
      this.trigger(changed);
    }
  },
  toggleFixedDrawer () {
    var _changes = {};
    var newval = !this.state.showFixedDrawer;
    _changes.showFixedDrawer = newval;
    assign(this.state, _changes);
    this.trigger(_changes);
  },
  showModal (params) {
    this.setState({
      modal: params
    });
  },
  hideModal () {
    if (this._onHideModal) {
      this._onHideModal();
    }
    this.setState({
      modal: false
    });
  }
});

stores.snapshots = Reflux.createStore({
  init () {
    this.listenTo(actions.resources.createSnapshot.completed, this.snapshotCreated);
    this.listenTo(actions.resources.createSnapshot.failed, this.snapshotCreationFailed);
  },
  snapshotCreated (snapshot) {
    this.trigger(assign({success: true}, snapshot));
  },
  snapshotCreationFailed (jqxhr) {
    this.trigger(assign({success: false}, jqxhr.responseJSON));
  },
});

var assetStore = Reflux.createStore({
  init: function () {
    this.data = {};
    this.relatedUsers = {};
    this.listenTo(actions.resources.loadAsset.completed, this.onLoadAssetCompleted);
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
        relatedUsers.push(username);
      }
    });
  },

  onUpdateAssetCompleted: function (resp/*, req, jqhr*/){
    this.data[resp.uid] = assetParserUtils.parsed(resp);
    this.noteRelatedUsers(resp);
    this.trigger(this.data, resp.uid, {asset_updated: true});
  },
  onLoadAssetCompleted: function (resp/*, req, jqxhr*/) {
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = assetParserUtils.parsed(resp);
    this.noteRelatedUsers(resp);
    this.trigger(this.data, resp.uid);
  }
});

var sessionStore = Reflux.createStore({
  init () {
    this.listenTo(actions.auth.getEnvironment.completed, this.triggerEnv);
    this.listenTo(actions.auth.verifyLogin.loggedin, this.triggerLoggedIn);
    this.listenTo(actions.auth.verifyLogin.anonymous, (data)=>{
      log('login confirmed anonymous', data.message);
    });
    this.listenTo(actions.auth.verifyLogin.failed, (xhr)=> {
      log('login not verified', xhr.status, xhr.statusText);
    });
    actions.auth.verifyLogin();
    actions.auth.getEnvironment();

  },
  getInitialState () {
    return {
      isLoggedIn: false,
      sessionIsLoggedIn: false
    };
  },
  triggerAnonymous (/*data*/) {},
  triggerEnv (environment) {
    this.environment = environment;
  },
  triggerLoggedIn (acct) {
    this.currentAccount = acct;
    if (acct.upcoming_downtime) {
      var downtimeString = acct.upcoming_downtime[0];
      acct.downtimeDate = new Date(Date.parse(acct.upcoming_downtime[0]));
      acct.downtimeMessage = acct.upcoming_downtime[1];
      stores.pageState._onHideModal = function () {
        window.localStorage.setItem('downtimeNoticeSeen', downtimeString);
      }
      if (window.localStorage['downtimeNoticeSeen'] !== downtimeString) {
        // user has not seen the notification about upcoming downtime
        window.setTimeout(function(){
          stores.pageState.showModal({
            message: acct.downtimeMessage,
            icon: 'gears',
          })
        }, 1500);
      }
    } else {
      if ('downtimeNoticeSeen' in window.localStorage) {
        localStorage.removeItem('downtimeNoticeSeen');
      }
    }
    var nestedArrToChoiceObjs = function (_s) {
      return {
        value: _s[0],
        label: _s[1],
      };
    };
    if (acct.available_sectors) {
      acct.available_sectors = acct.available_sectors.map(
        nestedArrToChoiceObjs);
    }
    if (acct.available_countries) {
      acct.available_countries = acct.available_countries.map(
        nestedArrToChoiceObjs);
    }
    if (acct.languages) {
      acct.languages = acct.languages.map(nestedArrToChoiceObjs);
    }
    if (acct.all_languages) {
      acct.all_languages = acct.all_languages.map(nestedArrToChoiceObjs);
    }

    this.trigger({
      isLoggedIn: true,
      sessionIsLoggedIn: true,
      sessionAccount: acct,
      currentAccount: acct
    });
  },
  onAuthLoginCompleted (acct) {
    if (!acct.username) {
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
  onLoadAssetContentCompleted: function(resp/*, req, jqxhr*/) {
    this.data[resp.uid] = resp;
    this.trigger(this.data, resp.uid);
  },
});

var surveyCompanionStore = Reflux.createStore({
  init () {
    this.listenTo(actions.survey.addItemAtPosition, this.addItemAtPosition);
  },
  addItemAtPosition ({position, survey, uid}) {
    stores.allAssets.whenLoaded(uid, function(asset){
      var _s = dkobo_xlform.model.Survey.loadDict(asset.content)
      survey.insertSurvey(_s, position);
    });
  }
})


var allAssetsStore = Reflux.createStore({
  init: function () {
    this.data = [];
    this.byUid = {};
    this._waitingOn = {};

    this.listenTo(actions.search.assets.completed, this.onListAssetsCompleted);
    this.listenTo(actions.search.assets.failed, this.onListAssetsFailed);
    this.listenTo(actions.resources.deleteAsset.completed, this.onDeleteAssetCompleted);
    this.listenTo(actions.resources.cloneAsset.completed, this.onCloneAssetCompleted);
    this.listenTo(actions.resources.loadAsset.completed, this.loadAssetCompleted);
  },
  whenLoaded (uid, cb) {
    if (this.byUid[uid] && this.byUid[uid].content) {
      cb.call(this, this.byUid[uid]);
    } else {
      if (!this._waitingOn[uid]) {
        this._waitingOn[uid] = [];
      }
      this._waitingOn[uid].push(cb);
      actions.resources.loadAsset({id: uid});
    }
  },
  loadAssetCompleted (asset) {
    this.registerAssetOrCollection(asset);
  },
  onCloneAssetCompleted (asset) {
    this.registerAssetOrCollection(asset);
    this.byUid[asset.uid] = asset;
    this.data.unshift(asset);
    this.trigger(this.data);
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
    const parsedObj = assetParserUtils.parseTags(asset);
    asset.tags = parsedObj.tags;
    this.byUid[asset.uid] = asset;
    if (asset.content) {
      this.callCallbacks(asset);
    }
  },
  callCallbacks (asset) {
    if (this._waitingOn[asset.uid]) {
      while (this._waitingOn[asset.uid].length > 0) {
        var cb = this._waitingOn[asset.uid].pop();
        cb.call(this, asset);
      }
    }
  },
  onListAssetsCompleted: function(searchData, response) {
    response.results.forEach(this.registerAssetOrCollection);
    this.data = response.results;
    this.trigger(this.data);
  },
  onListAssetsFailed: function (/*searchData, response*/) {
    notify(t('failed to list assets'));
  }
});

var selectedAssetStore = Reflux.createStore({
  init () {
    this.uid = cookie.load('selectedAssetUid');
    this.listenTo(actions.resources.cloneAsset.completed, this.onCloneAssetCompleted);
  },
  onCloneAssetCompleted (asset) {
    this.uid = asset.uid;
    this.asset = allAssetsStore.byUid[asset.uid];
    if (!this.asset) {
      console.error('selectedAssetStore error');
    }
    this.trigger(this.asset);
  },
  toggleSelect (uid, forceSelect=false) {
    if (forceSelect || this.uid !== uid) {
      this.uid = uid;
      this.asset = allAssetsStore.byUid[uid];
    } else {
      this.uid = false;
      this.asset = {};
    }
    cookie.save('selectedAssetUid', this.uid);
    this.trigger({
      selectedAssetUid: this.uid,
    });
    return this.uid !== false;
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
    this.trigger(this.checked, username);
  },
  usernameDoesntExist (username) {
    this.checked[username] = false;
    this.trigger(this.checked, username);
  }
});

stores.collections = Reflux.createStore({
  init () {
    this.listenTo(actions.resources.listCollections.completed, this.listCollectionsCompleted);
    this.initialState = {
      collectionSearchState: 'none',
      collectionCount: 0,
      collectionList: [],
    };
    this.state = this.initialState;
    this.listenTo(actions.resources.deleteCollection, this.deleteCollectionStarted);
    this.listenTo(actions.resources.deleteCollection.completed, this.deleteCollectionCompleted);
  },
  listCollectionsCompleted (collectionData) {
    this.latestList = collectionData.results;
    assign(this.state, {
      collectionSearchState: 'done',
      collectionCount: collectionData.count,
      collectionList: collectionData.results,
    });
    this.trigger(this.state);
  },
  deleteCollectionCompleted ({uid}) {
    this.state.collectionList = this.state.collectionList.filter((item) => {
      return item.uid !== uid;
    });
    this.trigger(this.state);
  },
  deleteCollectionStarted ({uid}) {
    this.state.collectionList.forEach((item) => {
      if (item.uid === uid) {
        item.deleting = true;
      }
    });
    this.trigger(this.state);
  }
});

var serverEnvironmentStore = Reflux.createStore({
  init() {
    this.state = {};
    this.listenTo(actions.misc.getServerEnvironment.completed,
                  this.updateEnvironment);
  },
  setState (state) {
    var chz = changes(this.state, state);
    if (chz) {
      assign(this.state, state);
      this.trigger(chz);
    }
  },
  updateEnvironment(response) {
    this.setState(response);
  },
});

if (window.Intercom) {
  var IntercomStore = Reflux.createStore({
    init () {
      this.listenTo(actions.navigation.routeUpdate, this.routeUpdate);
      this.listenTo(actions.auth.verifyLogin.loggedin, this.loggedIn);
      this.listenTo(actions.auth.logout.completed, this.loggedOut);
    },
    routeUpdate (routes) {
      window.Intercom('update');
    },
    loggedIn (acct) {
      let name = acct.extra_details.name;
      let legacyName = [
        acct.first_name, acct.last_name].filter(val => val).join(' ');
      let userData = {
        'user_id': [acct.username, window.location.host].join('@'),
        'username': acct.username,
        'email': acct.email,
        'name': name ? name : legacyName ? legacyName : acct.username,
        'created_at': Math.floor(
          (new Date(acct.date_joined)).getTime() / 1000),
        'app_id': window.IntercomAppId
      }
      window.Intercom('boot', userData);
    },
    loggedOut () {
      window.Intercom('shutdown');
    }
  });
}

assign(stores, {
  tags: tagsStore,
  pageState: pageStateStore,
  assetSearch: assetSearchStore,
  selectedAsset: selectedAssetStore,
  assetContent: assetContentStore,
  asset: assetStore,
  allAssets: allAssetsStore,
  session: sessionStore,
  userExists: userExistsStore,
  surveyState: surveyStateStore,
  serverEnvironment: serverEnvironmentStore,
});

module.exports = stores;
