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
  loadAsset: {
    children: [
      "completed",
      "failed"
    ]
  },
  publishAsset: {
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

module.exports = actions;

