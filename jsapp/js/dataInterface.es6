import $ from 'jquery';

import {
  assign,
} from './utils';

var dataInterface;
(function(){
  var $ajax = (o)=> {
    return $.ajax(assign({}, {dataType: 'json', method: 'GET'}, o));
  };
  const assetMapping = {
    'a': 'assets',
    'c': 'collections',
    'p': 'permissions',
  };

  var rootUrl = (function(){
    try {
      return document.head.querySelector('meta[name=kpi-root-url]').content.replace(/\/$/, '');
    } catch (e) {
      console.error('no kpi-root-url meta tag set. defaulting to ""');
      return '';
    }
  })();
  this.rootUrl = rootUrl;

  assign(this, {
    selfProfile: ()=> $ajax({ url: `${rootUrl}/me/` }),
    serverEnvironment: ()=> $ajax({ url: `${rootUrl}/environment/` }),
    queryUserExistence: (username)=> {
      var d = new $.Deferred();
      $ajax({ url: `${rootUrl}/users/${username}/` })
        .done(()=>{ d.resolve(username, true); })
        .fail(()=>{ d.reject(username, false); });
      return d.promise();
    },
    logout: ()=> {
      var d = new $.Deferred();
      $ajax({ url: `${rootUrl}/api-auth/logout/` }).done(d.resolve).fail(function (/*resp, etype, emessage*/) {
        // logout request wasn't successful, but may have logged the user out
        // querying '/me/' can confirm if we have logged out.
        dataInterface.selfProfile().done(function(data){
          if (data.message === 'user is not logged in') {
            d.resolve(data);
          } else {
            d.fail(data);
          }
        }).fail(d.fail);
      });
      return d.promise();
    },
    patchProfile (data) {
      return $ajax({
        url: `${rootUrl}/me/`,
        method: 'PATCH',
        data: data
      });
    },
    listTemplates () {
      return $ajax({
        url: `${rootUrl}/assets/?q=asset_type:template`
      });
    },
    listCollections () {
      return $.getJSON(`${rootUrl}/collections/?all_public=true`);
    },
    createAssetSnapshot (data) {
      return $ajax({
        url: `${rootUrl}/asset_snapshots/`,
        method: 'POST',
        data: data
      });
    },
    getReportData (data) {
      let identifierString;
      if (data.identifiers) {
        identifierString = `?names=${data.identifiers.join(',')}`
      }
      if (data.group_by != '')
        identifierString += `&split_by=${data.group_by}`

      return $ajax({
        url: `${rootUrl}/reports/${data.uid}/${identifierString}`,
      });
    },
    createTemporaryAssetSnapshot ({source}) {
      return $ajax({
        url: `${rootUrl}/asset_snapshots/`,
        method: 'POST',
        data: {
          source: source
        }
      });
    },
    cloneAsset ({uid, name, version_id, new_asset_type}) {
      let data = {
        clone_from: uid,
      };
      if (name) { data.name = name; }
      if (version_id) { data.clone_from_version_id = version_id; }
      if (new_asset_type) { data.asset_type = new_asset_type; }
      return $ajax({
        method: 'POST',
        url: `${rootUrl}/assets/`,
        data: data,
      });
    },
    cloneCollection ({uid}) {
      return $ajax({
        method: 'POST',
        url: `${rootUrl}/collections/`,
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
    copyPermissionsFrom(sourceUid, targetUid) {
      return $ajax({
        url: `${rootUrl}/assets/${targetUid}/permissions/`,
        method: 'PATCH',
        data: {
          clone_from: sourceUid
        }
      })
    },
    assignPerm (creds) {
      // Do we already have these URLs stored somewhere?
      var objectUrl = creds.objectUrl || `${rootUrl}/${creds.kind}s/${creds.uid}/`;
      var userUrl = `${rootUrl}/users/${creds.username}/`;
      var codename = creds.role.includes('_submissions') ? creds.role : `${creds.role}_${creds.kind}`;
      return $ajax({
        url: `${rootUrl}/permissions/`,
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
    setCollectionDiscoverability (uid, discoverable) {
      dataInterface.patchCollection(uid, {
        discoverable_when_public: discoverable
      });
    },
    libraryDefaultSearch () {
      return $ajax({
        url: `${rootUrl}/assets/`,
        data: {
          q: 'asset_type:question OR asset_type:block OR asset_type:template'
        },
        method: 'GET'
      });
    },
    assetSearch ({tags, q}) {
      var params = [];
      if (tags) {
        tags.forEach(function(tag){
          params.push(`tag:${tag}`);
        });
      }
      if (q) {
        params.push(`(${q})`);
      }
      return $ajax({
        url: `${rootUrl}/assets/?${params.join(' AND ')}`,
        method: 'GET'
      });
    },
    deleteCollection ({uid}) {
      return $ajax({
        url: `${rootUrl}/collections/${uid}/`,
        method: 'DELETE'
      });
    },
    deleteAsset ({uid}) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/`,
        method: 'DELETE'
      });
    },
    subscribeCollection ({uid}) {
      return $ajax({
        url: `${rootUrl}/collection_subscriptions/`,
        data: {
          collection: `${rootUrl}/collections/${uid}/`,
        },
        method: 'POST'
      });
    },
    unsubscribeCollection ({uid}) {
      return $ajax({
        url: `${rootUrl}/collection_subscriptions/`,
        data: {
          collection__uid: uid
        },
        method: 'GET'
      }).then((data) => {
        return $ajax({
          url: data.results[0].url,
          method: 'DELETE'
        });
      });
    },
    getAssetContent ({id}) {
      return $.getJSON(`${rootUrl}/assets/${id}/content/`);
    },
    getImportDetails ({uid}) {
      return $.getJSON(`${rootUrl}/imports/${uid}/`);
    },
    getAsset (params={}) {
      if (params.url) {
        return $.getJSON(params.url);
      } else {
        return $.getJSON(`${rootUrl}/assets/${params.id}/`);
      }
    },
    getAssetExports (uid) {
      return $ajax({
        url: `${rootUrl}/exports/`,
        data: {
          q: `source:${uid}`
        }
      });
    },
    deleteAssetExport (euid) {
      return $ajax({
        url: `${rootUrl}/exports/${euid}/`,
        method: 'DELETE'
      });
    },
    getAssetXformView (uid) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/xform`,
        dataType: 'html'
      });
    },
    searchAssets (searchData) {
      // override limit
      searchData.limit = 200;
      return $.ajax({
        url: `${rootUrl}/assets/`,
        dataType: 'json',
        data: searchData,
        method: 'GET'
      });
    },
    createCollection (data) {
      return $ajax({
        method: 'POST',
        url: `${rootUrl}/collections/`,
        data: data,
      });
    },
    patchCollection (uid, data) {
      return $ajax({
        url: `${rootUrl}/collections/${uid}/`,
        method: 'PATCH',
        data: data
      });
    },
    createResource (details) {
      return $ajax({
        method: 'POST',
        url: `${rootUrl}/assets/`,
        data: details
      });
    },
    patchAsset (uid, data) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/`,
        method: 'PATCH',
        data: data
      });
    },
    listTags (data) {
      return $ajax({
        url: `${rootUrl}/tags/`,
        method: 'GET',
        data: assign({
          limit: 9999,
        }, data),
      });
    },
    getCollection (params={}) {
      if (params.url) {
        return $.getJSON(params.url);
      } else {
        return $.getJSON(`${rootUrl}/collections/${params.id}/`);
      }
    },
    deployAsset (asset, redeployment) {
      var data = {
        'active': true,
      };
      var method = 'POST';
      if (redeployment) {
        method = 'PATCH';
        data.version_id = asset.version_id;
      }
      return $ajax({
        method: method,
        url: `${asset.url}deployment/`,
        data: data
      });
    },
    setDeploymentActive ({asset, active}) {
      return $ajax({
        method: 'PATCH',
        url: `${asset.url}deployment/`,
        data: {
          active: active
        }
      });
    },
    postCreateImport (contents) {
      var formData = new FormData();
      Object.keys(contents).forEach(function(key){
        formData.append(key, contents[key]);
      });
      return $.ajax({
        method: 'POST',
        url: `${rootUrl}/imports/`,
        data: formData,
        processData: false,
        contentType: false
      });
    },
    getResource ({id}) {
      // how can we avoid pulling asset type from the 1st character of the uid?
      var assetType = assetMapping[id[0]];
      return $.getJSON(`${rootUrl}/${assetType}/${id}/`);
    },
    getSubmissions(uid, pageSize=100, page=0, sort=[], fields=[], filter='', count=false) {
      const query = `limit=${pageSize}&start=${page}`;
      var s = '&sort={"_id":-1}'; // default sort
      var f = '';
      if (sort.length)
        s = sort[0].desc === true ? `&sort={"${sort[0].id}":-1}` : `&sort={"${sort[0].id}":1}`;
      if (fields.length)
        f = `&fields=${JSON.stringify(fields)}`;
      if (count)
        filter += '&count=1';

      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions?${query}${s}${f}${filter}`,
        method: 'GET'
      });
    },
    getSubmission(uid, sid) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions/${sid}`,
        method: 'GET'
      });
    },
    patchSubmissions(uid, data) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions/validation_statuses/`,
        method: 'PATCH',
        data: {'payload': JSON.stringify(data)}
      });
    },
    updateSubmissionValidationStatus(uid, sid, data) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions/${sid}/validation_status/`,
        method: 'PATCH',
        data: data
      });
    },
    getSubmissionsQuery(uid, query='') {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions?${query}`,
        method: 'GET'
      });
    },
    deleteSubmission(uid, sid) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions/${sid}`,
        method: 'DELETE'
      });
    },
    getEnketoEditLink(uid, sid) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/submissions/${sid}/edit?return_url=false`,
        method: 'GET'
      });
    },
    uploadAssetFile(uid, data) {
      var formData = new FormData();
      Object.keys(data).forEach(function(key) {
        formData.append(key, data[key]);
      });

      return $ajax({
        url: `${rootUrl}/assets/${uid}/files/`,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false
      });
    },
    getAssetFiles(uid) {
      return $ajax({
        url: `${rootUrl}/assets/${uid}/files`,
        method: 'GET'
      });
    },
    deleteAssetFile(assetUid, uid) {
      return $ajax({
        url: `${rootUrl}/assets/${assetUid}/files/${uid}`,
        method: 'DELETE'
      });
    },

    setLanguage(data) {
      return $ajax({
        url: `${rootUrl}/i18n/setlang/`,
        method: 'POST',
        data: data
      });
    },
    environment() {
      return $ajax({url: `${rootUrl}/environment/`,method: 'GET'});
    },
    login: (creds)=> {
      return $ajax({ url: `${rootUrl}/api-auth/login/?next=/me/`, data: creds, method: 'POST'});
    }
  });
}).call(dataInterface = {});

export default {dataInterface: dataInterface};
