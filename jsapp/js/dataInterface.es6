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
      var url = "/assets/?q=example";
      return $.getJSON(url);
    },
    readCollection ({uid}) {
      return $ajax({
        url: `/collections/${uid}/`
      })
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
    searchAssets (queryString) {
      return $ajax({
        url: '/assets/',
        data: {
          q: queryString
        }
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
    listTags () {
      return $ajax({
        url: `/tags/`,
        method: 'GET'
      });
    },
    getCollection ({id}) {
      if (params.url) {
        return $.getJSON(params.url);
      } else  {
        return $.getJSON(`/collections/${params.id}/`);
      }
    },
    deployAsset (uid, form_id_string) {
      var data = {
        'asset[uid]': uid,
      };
      if (form_id_string) {
        data.form_id_string = form_id_string;
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