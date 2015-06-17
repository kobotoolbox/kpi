import {dataInterface} from './dataInterface';
import {log, t} from './utils';

var Reflux = require('reflux');

var actions = {}


actions.navigation = Reflux.createActions([
    "transitionStart",
    "transitionEnd",
    "historyPush",
    "routeUpdate",

    "documentTitleUpdate"
  ]);

actions.auth = Reflux.createActions({
  login: {
    children: [
      "completed",
      "failed"
    ]
  },
  verifyLogin: {
    children: [
      "completed",
      "failed"
    ]
  },
  logout: {
    children: [
      "completed",
      "failed"
    ]
  }
});

actions.search = Reflux.createActions({
  assets: {
    children: [
      "completed",
      "failed"
    ]
  },
  tags: {
    children: [
      "completed",
      "failed"
    ]
  },
  libraryDefaultQuery: {
    children: [
      "completed",
      "failed"
    ]
  },
  collections: {
    children: [
      "completed",
      "failed"
    ]
  }
});

actions.resources = Reflux.createActions({
  listAssets: {
    children: [
      "completed",
      "failed"
    ]
  },
  createAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  loadAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  deployAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  cloneAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  deleteAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  listTags: {
    children: [
      "completed",
      "failed"
    ]
  },
  createCollection: {
    children: [
      "completed",
      "failed"
    ]
  },
  readCollection: {
    children: [
      "completed",
      "failed"
    ]
  },
  updateCollection: {
    children: [
      "completed",
      "failed"
    ]
  },
  deleteCollection: {
    children: [
      "completed",
      "failed"
    ]
  },
  loadAssetSubResource: {
    children: [
      "completed",
      "failed"
    ]
  },
  loadAssetContent: {
    children: [
      "completed",
      "failed"
    ]
  },
  loadResource: {
    children: [
      "completed",
      "failed"
    ],
  },
  createResource: {
    children: [
      "completed",
      "failed"
    ]
  },
  updateAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  notFound: {}
});

actions.permissions = Reflux.createActions({
  assignPerm: {
    children: [
      "completed",
      "failed"
    ]
  },
  removePerm: {
    children: [
      "completed",
      "failed"
    ]
  },
  assignPublicPerm: {
    children: [
      "completed",
      "failed"
    ]
  }
});

actions.misc = Reflux.createActions({
  checkUsername: {
    asyncResult: true,
    children: [
      "completed",
      "failed_"
    ]
  }
});


actions.misc.checkUsername.listen(function(username){
  dataInterface.queryUserExistence(username)
    .done(actions.misc.checkUsername.completed)
    .fail(actions.misc.checkUsername.failed_);
});

actions.resources.createAsset.listen(function(contents){
  if (contents.base64Encoded) {
    dataInterface.postCreateBase64EncodedAsset(contents)
      .done(actions.resources.createAsset.completed)
      .fail(actions.resources.createAsset.failed);
  }
});
actions.resources.createResource.failed.listen(function(){
  log('createResourceFailed');
});
actions.resources.listTags.listen(function(){
  dataInterface.listTags()
    .done(actions.resources.listTags.completed)
    .fail(actions.resources.listTags.failed);
});

actions.resources.updateAsset.listen(function(uid, values){
  dataInterface.patchAsset(uid, values)
    .done(actions.resources.updateAsset.completed)
    .fail(actions.resources.updateAsset.failed);
});

actions.resources.deployAsset.listen(function(uid){
  dataInterface.deployAsset(uid)
    .done(actions.resources.deployAsset.completed)
    .fail(actions.resources.deployAsset.failed);
})

actions.resources.createResource.listen(function(details){
  dataInterface.createResource(details)
    .done(actions.resources.createResource.completed)
    .fail(actions.resources.createResource.failed);
});

actions.resources.deleteAsset.listen(function(details){
  dataInterface.deleteAsset(details)
    .done(function(result){
      actions.resources.deleteAsset.completed(details)
    })
    .fail(actions.resources.deleteAsset.failed);
});
actions.resources.readCollection.listen(function(details){
  dataInterface.readCollection(details)
      .done(actions.resources.readCollection.completed)
      .fail(actions.resources.readCollection.failed);
})
actions.resources.cloneAsset.listen(function(details){
  dataInterface.cloneAsset(details)
    .done(actions.resources.cloneAsset.completed)
    .fail(actions.resources.cloneAsset.failed);
});

actions.search.assets.listen(function(queryString){
  dataInterface.searchAssets(queryString)
    .done(function(...args){
      actions.search.assets.completed.apply(this, [queryString, ...args])
    })
    .fail(function(...args){
      actions.search.assets.failed.apply(this, [queryString, ...args])
    })
});

actions.search.libraryDefaultQuery.listen(function(){
  dataInterface.libraryDefaultSearch()
    .done(actions.search.libraryDefaultQuery.completed)
    .fail(actions.search.libraryDefaultQuery.failed);
});

actions.search.tags.listen(function(queryString){
  dataInterface.searchTags(queryString)
    .done(actions.search.searchTags.completed)
    .fail(actions.search.searchTags.failed)
});

actions.permissions.assignPerm.listen(function(creds){
  dataInterface.assignPerm(creds)
    .done(actions.permissions.assignPerm.completed)
    .fail(actions.permissions.assignPerm.failed);
});
actions.permissions.assignPerm.completed.listen(function(val){
  actions.resources.loadAsset({url: val.content_object});
});

actions.permissions.removePerm.listen(function(details){
  if (!details.content_object_uid) {
    throw new Error('removePerm needs a content_object_uid parameter to be set')
  }
  dataInterface.removePerm(details.permission_url)
    .done(function(resp){
      actions.permissions.removePerm.completed(details.content_object_uid, resp);
    })
    .fail(actions.permissions.removePerm.failed);
});

actions.permissions.removePerm.completed.listen(function(uid){
  actions.resources.loadAsset({id: uid});
});

actions.auth.login.listen(function(creds){
  dataInterface.login(creds).done(function(){
    dataInterface.selfProfile().done(actions.auth.login.completed)
        .fail(function(){
          console.error('login failed what sould we do now?');
        });
  })
    .fail(actions.auth.logout.failed);
});

// reload so a new csrf token is issued
actions.auth.logout.completed.listen(function(){
  window.setTimeout(function(){
    window.location.replace('', '');
  }, 1);
});

actions.auth.logout.listen(function(){
  dataInterface.logout().done(actions.auth.logout.completed).fail(function(){
    console.error('logout failed for some reason. what should happen now?');
  });
})

actions.resources.loadAsset.listen(function(params){
  var dispatchMethodName;
  if (params.url) {
    dispatchMethodName = params.url.indexOf('collections') === -1 ? 
        'getAsset' : 'getCollection';
  } else {
    dispatchMethodName = {
      c: 'getCollection',
      a: 'getAsset'
    }[params.id[0]];
  }

  dataInterface[dispatchMethodName](params)
      .done(actions.resources.loadAsset.completed)
      .fail(actions.resources.loadAsset.failed)
});

actions.resources.loadAsset.completed.listen(function(asset){
  actions.navigation.historyPush(asset);
});

actions.resources.loadAssetContent.listen(function(params){
  dataInterface.getAssetContent(params)
      .done(function(data, ...args) {
        // data.sheeted = new Sheeted([['survey', 'choices', 'settings'], data.data])
        actions.resources.loadAssetContent.completed(data, ...args);
      })
      .fail(actions.resources.loadAssetContent.failed)
});

actions.resources.listAssets.listen(function(){
  dataInterface.listAllAssets()
      .done(actions.resources.listAssets.completed)
      .fail(actions.resources.listAssets.failed)
})

module.exports = actions;

