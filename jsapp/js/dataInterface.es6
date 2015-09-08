var $ = require('jquery');

import assign from 'react/lib/Object.assign';


var dataInterface;
(function(){
  var $ajax = (o)=> {
    return $.ajax(assign({}, {dataType: 'json', method: 'GET'}, o));
  };
  const assetMapping = {
    'a': 'assets',
    'c': 'collections',
    'p': 'permissions',
  }
  assign(this, {
    selfProfile: ()=> $ajax({ url: '/me/' }),
    queryUserExistence: (username)=> {
      var d = new $.Deferred();
      $ajax({ url: `/users/${username}/` })
        .done(()=>{ d.resolve(username, true); })
        .fail(()=>{ d.reject(username, false); });
      return d.promise();
    },
    logout: ()=> {
      var d = new $.Deferred();
      $ajax({ url: '/api-auth/logout/' }).done(d.resolve).fail(function (resp, etype, emessage) {
        // logout request wasn't successful, but may have logged the user out
        // querying '/me/' can confirm if we have logged out.
        dataInterface.selfProfile().done(function(data){
          if (data.message == "user is not logged in") {
            d.resolve(data);
          } else {
            d.fail(data);
          }
        }).fail(d.fail);
      });
      return d.promise();
    },
    listBlocks () {
      return $ajax({
        url: '/assets/?q=asset_type:block'
      })
    },
    listQuestionsAndBlocks() {
      return $ajax({
        url: '/assets/',
        data: {
          q: 'asset_type:question OR asset_type:block'
        },
        method: 'GET'
      });
    },
    listSurveys() {
      return $ajax({
        url: '/assets/',
        data: {
          q: 'asset_type:survey'
        },
        method: 'GET'
      });
    },
    listCollections () {
      return $.getJSON('/collections/?parent=');
    },
    listAllAssets () {
      var d = new $.Deferred();
      $.when($.getJSON('/assets/?parent='), $.getJSON('/collections/?parent=')).done(function(assetR, collectionR){
        var assets = assetR[0],
            collections = collectionR[0];
        var r = {results:[]};
        var pushItem = function (item){r.results.push(item)};
        assets.results.forEach(pushItem);
        collections.results.forEach(pushItem);
        var sortAtt = 'date_modified'
        r.results.sort(function(a,b){
          var ad = a[sortAtt], bd = b[sortAtt];
          return (ad === bd) ? 0 : ((ad > bd) ? -1 : 1);
        });
        d.resolve(r);
      }).fail(d.fail);
      return d.promise();
    },
    createAssetSnapshot (data) {
      return $ajax({
        url: '/asset_snapshots/',
        method: 'POST',
        data: data
      });
    },
    createTemporaryAssetSnapshot ({source}) {
      return $ajax({
        url: '/asset_snapshots/',
        method: 'POST',
        data: {
          source: source
        }
      })
    },
    cloneAsset ({uid}) {
      return $ajax({
        method: 'POST',
        url: '/assets/',
        data: {
          clone_from: uid
        }
      });
    },
    cloneCollection ({uid}) {
      return $ajax({
        method: 'POST',
        url: '/collections/',
        data: {
          clone_from: uid
        }
      });
    },
    removePerm (permUrl) {
      return $ajax({
        method: 'DELETE',
        url: permUrl
      });
    },
    assignPerm (creds) {
      // Do we already have these URLs stored somewhere?
      var objectUrl = creds.objectUrl || `/${creds.kind}s/${creds.uid}/`;
      var userUrl = `/users/${creds.username}/`;
      var codename = `${creds.role}_${creds.kind}`;
      return $ajax({
        url: '/permissions/',
        method: 'POST',
        data: {
          'user': userUrl,
          'permission': codename,
          'content_object': objectUrl
        }
      });
    },
    assignPublicPerm (params) {
      params.username = 'AnonymousUser';
      return dataInterface(params);
    },
    libraryDefaultSearch () {
      return $ajax({
        url: '/assets/',
        data: {
          q: 'asset_type:question OR asset_type:block'
        },
        method: 'GET'
      });
    },
    assetSearch ({tags, q}) {
      var params = [];
      if (tags) {
        tags.forEach(function(tag){
          params.push(`tag:${tag}`)
        });
      }
      if (q) {
        params.push(`(${q})`);
      }
      return $ajax({
        url: `/assets/?${params.join(' AND ')}`,
        method: 'GET'
      });
    },
    readCollection ({uid}) {
      return $ajax({
        url: `/collections/${uid}/`
      });
    },
    deleteCollection ({uid}) {
      return $ajax({
        url: `/collections/${uid}/`,
        method: 'DELETE'
      });
    },
    deleteAsset ({uid}) {
      return $ajax({
        url: `/assets/${uid}/`,
        method: 'DELETE'
      });
    },
    getAssetContent ({id}) {
      return $.getJSON(`/assets/${id}/content/`);
    },
    getAsset (params={}) {
      if (params.url) {
        return $.getJSON(params.url);
      } else  {
        return $.getJSON(`/assets/${params.id}/`);
      }
    },
    getAssetXformView (uid) {
      return $ajax({
        url: `/assets/${uid}/xform`,
        dataType: 'html'
      });
    },
    searchAssets (queryString) {
      return $ajax({
        url: '/assets/',
        data: {
          q: queryString
        }
      });
    },
    createCollection (data) {
      return $ajax({
        method: 'POST',
        url: '/collections/',
        data: data,
      })
    },
    patchCollection (uid, data) {
      return $ajax({
        url: `/collections/${uid}/`,
        method: 'PATCH',
        data: data
      });
    },
    createResource (details) {
      return $ajax({
        method: 'POST',
        url: '/assets/',
        data: details
      });
    },
    patchAsset (uid, data) {
      return $ajax({
        url: `/assets/${uid}/`,
        method: 'PATCH',
        data: data
      });
    },
    listTags (data) {
      return $ajax({
        url: `/tags/`,
        method: 'GET',
        data: assign({
          limit: 9999,
        }, data),
      });
    },
    getCollection (params={}) {
      if (params.url) {
        return $.getJSON(params.url);
      } else  {
        return $.getJSON(`/collections/${params.id}/`);
      }
    },
    deployAsset (asset_url, xform_id_string) {
      var data = {
        'asset': asset_url,
      };
      if (xform_id_string) {
        data.xform_id_string = xform_id_string;
      }
      return $ajax({
        method: 'POST',
        url: '/deployments/',
        data: data
      });
    },
    postCreateBase64EncodedAsset (contents) {
      var formData = new FormData();
      Object.keys(contents).forEach(function(key){
        formData.append(key, contents[key]);
      });
      return $.ajax({
        method: 'POST',
        url: '/imports/',
        data: formData,
        processData: false,
        contentType: false
      });
    },
    getResource ({id}) {
      // how can we avoid pulling asset type from the 1st character of the uid?
      var assetType = assetMapping[id[0]];
      return $.getJSON(`/${assetType}/${id}/`);
    },
    login: (creds)=> {
      return $ajax({ url: '/api-auth/login/?next=/me/', data: creds, method: 'POST'});
    }
  });
}).call(dataInterface={});

export default {dataInterface: dataInterface};
