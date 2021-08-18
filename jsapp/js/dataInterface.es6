/**
 * The only file that is making calls to Backend. You shouldn't use it directly,
 * but through proper actions in `jsapp/js/actions.es6`.
 *
 * TODO: Instead of splitting this huge file it could be a good idead to move
 * all the calls from here to appropriate actions and drop this file entirely.
 * And make actions for calls that doesn't have them.
 */

import alertify from 'alertifyjs';
import {assign} from 'utils';
import {
  ROOT_URL,
  COMMON_QUERIES
} from './constants';

const DEFAULT_PAGE_SIZE = 100;

export var dataInterface;
(function(){
  var $ajax = (o)=> {
    return $.ajax(assign({}, {dataType: 'json', method: 'GET'}, o));
  };
  const assetMapping = {
    'a': 'assets',
    'c': 'collections',
    'p': 'permissions',
  };

  // hook up to all AJAX requests to check auth problems
  $(document).ajaxError((event, request, settings) => {
    if (request.status === 403 || request.status === 401 || request.status === 404) {
      dataInterface.selfProfile().done((data) => {
        if (data.message === 'user is not logged in') {
          let errorMessage = t('Please try reloading the page. If you need to contact support, note the following message: <pre>##server_message##</pre>');
          let serverMessage = request.status.toString();
          if (request.responseJSON && request.responseJSON.detail) {
            serverMessage += ': ' + request.responseJSON.detail;
          }
          errorMessage = errorMessage.replace('##server_message##', serverMessage);
          alertify.alert(t('You are not logged in'), errorMessage);
        }
      });
    }
  });

  assign(this, {
    selfProfile: ()=> $ajax({ url: `${ROOT_URL}/me/` }),
    apiToken: () => {
      return $ajax({
        url: `${ROOT_URL}/token/?format=json`
      });
    },
    getUser: (userUrl) => {
      return $ajax({
        url: userUrl
      });
    },
    queryUserExistence: (username)=> {
      var d = new $.Deferred();
      $ajax({ url: `${ROOT_URL}/api/v2/users/${username}/` })
        .done(()=>{ d.resolve(username, true); })
        .fail(()=>{ d.reject(username, false); });
      return d.promise();
    },
    logout: ()=> {
      var d = new $.Deferred();
      $ajax({ url: `${ROOT_URL}/api-auth/logout/` }).done(d.resolve).fail(function (/*resp, etype, emessage*/) {
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
        url: `${ROOT_URL}/me/`,
        method: 'PATCH',
        data: data
      });
    },
    listTemplates () {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/?q=${COMMON_QUERIES.t}`
      });
    },
    getCollections(params = {}) {
      let q = COMMON_QUERIES.c;
      if (params.owner) {
        q += ` AND owner__username__exact:${params.owner}`;
      }
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/`,
        dataType: 'json',
        data: {
          q: q,
          limit: params.pageSize || DEFAULT_PAGE_SIZE,
          page: params.page || 0
        },
        method: 'GET'
      });
    },
    createAssetSnapshot (data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/asset_snapshots/`,
        method: 'POST',
        data: data
      });
    },
    createTemporaryAssetSnapshot ({source}) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/asset_snapshots/`,
        method: 'POST',
        data: {
          source: source
        }
      });
    },

    /*
     * external services
     */

    getHooks(uid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/`,
        method: 'GET'
      });
    },
    getHook(uid, hookUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
        method: 'GET'
      });
    },
    addExternalService(uid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/`,
        method: 'POST',
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: 'application/json'
      });
    },
    updateExternalService(uid, hookUid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
        method: 'PATCH',
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: 'application/json'
      });
    },
    deleteExternalService(uid, hookUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/`,
        method: 'DELETE'
      });
    },
    getHookLogs(uid, hookUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/`,
        method: 'GET'
      });
    },
    getHookLog(uid, hookUid, lid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/`,
        method: 'GET'
      });
    },
    retryExternalServiceLogs(uid, hookUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/retry/`,
        method: 'PATCH'
      });
    },
    retryExternalServiceLog(uid, hookUid, lid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/hooks/${hookUid}/logs/${lid}/retry/`,
        method: 'PATCH'
      });
    },

    getReportData (data) {
      let identifierString;
      if (data.identifiers) {
        identifierString = `?names=${data.identifiers.join(',')}`
      }
      if (data.group_by != '')
        identifierString += `&split_by=${data.group_by}`;

      return $ajax({
        url: `${ROOT_URL}/reports/${data.uid}/${identifierString}`,
      });
    },
    cloneAsset ({uid, name, version_id, new_asset_type, parent}) {
      let data = {
        clone_from: uid,
      };
      if (name) { data.name = name; }
      if (version_id) { data.clone_from_version_id = version_id; }
      if (new_asset_type) { data.asset_type = new_asset_type; }
      if (parent) { data.parent = parent; }
      return $ajax({
        method: 'POST',
        url: `${ROOT_URL}/api/v2/assets/`,
        data: data,
      });
    },

    /*
     * form media
     */
    postFormMedia(uid, data) {
      return $ajax({
        method: 'POST',
        url: `${ROOT_URL}/api/v2/assets/${uid}/files/`,
        data: data,
      });
    },
    deleteFormMedia(url) {
      return $ajax({
        method: 'DELETE',
        url: url,
      });
    },

    /*
     * Dynamic data attachments
     */
    attachToSource(assetUid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/paired-data/`,
        method: 'POST',
        data: JSON.stringify(data),
        contentType: 'application/json'
      });
    },
    detachSource(attachmentUrl) {
      return $ajax({
        url: attachmentUrl,
        method: 'DELETE',
      });
    },
    patchSource(attachmentUrl, data) {
      return $ajax({
        url: attachmentUrl,
        method: 'PATCH',
        data: JSON.stringify(data),
        contentType: 'application/json'
      });
    },
    getAttachedSources(assetUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/paired-data/`,
        method: 'GET',
      });
    },
    getSharingEnabledAssets() {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/?q=data_sharing__enabled:true`,
        method: 'GET',
      });
    },
    patchDataSharing(assetUid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/`,
        method: 'PATCH',
        data: JSON.stringify(data),
        contentType: 'application/json'
      });
    },

    /*
     * permissions
     */

    getPermissionsConfig() {
      return $ajax({
        url: `${ROOT_URL}/api/v2/permissions/`,
        method: 'GET'
      });
    },

    getAssetPermissions(assetUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
        method: 'GET'
      });
    },

    bulkSetAssetPermissions(assetUid, perms) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/bulk/`,
        method: 'POST',
        data: JSON.stringify(perms),
        dataType: 'json',
        contentType: 'application/json'
      });
    },

    assignAssetPermission(assetUid, perm) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/permission-assignments/`,
        method: 'POST',
        data: JSON.stringify(perm),
        dataType: 'json',
        contentType: 'application/json'
      });
    },

    removePermission (permUrl) {
      return $ajax({
        method: 'DELETE',
        url: permUrl
      });
    },

    copyPermissionsFrom(sourceUid, targetUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${targetUid}/permission-assignments/clone/`,
        method: 'PATCH',
        data: {
          clone_from: sourceUid
        }
      });
    },
    deleteAsset ({uid}) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/`,
        method: 'DELETE'
      });
    },
    subscribeToCollection(assetUrl) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/asset_subscriptions/`,
        data: {
          asset: assetUrl
        },
        method: 'POST'
      });
    },
    unsubscribeFromCollection(uid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/asset_subscriptions/`,
        data: {
          asset__uid: uid
        },
        method: 'GET'
      }).then((data) => {
        return $ajax({
          url: data.results[0].url,
          method: 'DELETE'
        });
      });
    },
    getImportDetails ({uid}) {
      return $.getJSON(`${ROOT_URL}/api/v2/imports/${uid}/`);
    },
    getAsset (params={}) {
      if (params.url) {
        return $.getJSON(params.url);
      } else {
        // limit is for collections children
        return $.getJSON(`${ROOT_URL}/api/v2/assets/${params.id}/?limit=${DEFAULT_PAGE_SIZE}`);
      }
    },

    getAssetExports(assetUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/`,
        data: {
          ordering: '-date_created',
          // TODO: handle pagination of this in future, for now we get "all"
          limit: 9999,
        },
      });
    },

    createAssetExport(assetUid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/`,
        method: 'POST',
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: 'application/json',
      });
    },

    getAssetExport(assetUid, exportUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/${exportUid}/`,
        method: 'GET',
      });
    },

    deleteAssetExport(assetUid, exportUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/exports/${exportUid}/`,
        method: 'DELETE',
      });
    },

    getExportSettings(assetUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/`,
        // TODO: handle pagination of this in future, for now we get "all"
        data: {limit: 9999},
      });
    },

    getExportSetting(assetUid, settingUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
      });
    },

    updateExportSetting(assetUid, settingUid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
        method: 'PATCH',
        data: data,
      });
    },

    createExportSetting(assetUid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/`,
        method: 'POST',
        data: data,
      });
    },

    deleteExportSetting(assetUid, settingUid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/export-settings/${settingUid}/`,
        method: 'DELETE',
      });
    },

    getAssetXformView (uid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/xform/`,
        dataType: 'html'
      });
    },
    searchAssets(searchData) {
      // TODO https://github.com/kobotoolbox/kpi/issues/1983
      // force set limit to get hacky "all" assets
      searchData.limit = 200;
      return $.ajax({
        url: `${ROOT_URL}/api/v2/assets/`,
        dataType: 'json',
        data: searchData,
        method: 'GET'
      });
    },
    _searchAssetsWithPredefinedQuery(params, predefinedQuery) {
      const searchData = {
        q: predefinedQuery,
        limit: params.pageSize || DEFAULT_PAGE_SIZE,
        offset: params.page * params.pageSize || 0
      };

      if (params.searchPhrase) {
        searchData.q += ` AND (${params.searchPhrase})`;
      }

      if (params.filterProperty && params.filterValue) {
        searchData.q += ` AND ${params.filterProperty}:${params.filterValue}`;
      }

      if (params.ordering) {
        searchData.ordering = params.ordering;
      }

      if (params.metadata === true) {
        searchData.metadata = 'on';
      }

      if (params.collectionsFirst === true) {
        searchData.collections_first = 'true';
      }

      if (params.status) {
        searchData.status = params.status;
      }

      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/`,
        dataType: 'json',
        data: searchData,
        method: 'GET'
      });
    },
    _searchMetadataWithPredefinedQuery(params, predefinedQuery) {
      const searchData = {
        q: predefinedQuery,
        limit: params.pageSize || DEFAULT_PAGE_SIZE,
        offset: params.page * params.pageSize || 0
      };

      if (params.searchPhrase) {
        searchData.q += ` AND (${params.searchPhrase})`;
      }

      if (params.filterProperty && params.filterValue) {
        searchData.q += ` AND ${params.filterProperty}:"${params.filterValue}"`;
      }

      if (params.ordering) {
        searchData.ordering = params.ordering;
      }

      if (params.status) {
        searchData.status = params.status;
      }

      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/metadata/`,
        dataType: 'json',
        data: searchData,
        method: 'GET'
      });
    },
    searchMyCollectionAssets(params = {}) {
      return this._searchAssetsWithPredefinedQuery(
        params,
        // we only want the currently viewed collection's assets
        `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`,
      );
    },
    searchMyLibraryAssets(params = {}) {
      // we only want orphans (assets not inside collection)
      // unless it's a search
      let query = COMMON_QUERIES.qbtc;
      if (!params.searchPhrase) {
        query += ' AND parent:null';
      }

      return this._searchAssetsWithPredefinedQuery(params, query);
    },
    searchMyCollectionMetadata(params = {}) {
      return this._searchMetadataWithPredefinedQuery(
        params,
        // we only want the currently viewed collection's assets
        `${COMMON_QUERIES.qbtc} AND parent__uid:${params.uid}`,
      );
    },
    searchMyLibraryMetadata(params = {}) {
      // we only want orphans (assets not inside collection)
      // unless it's a search
      let query = COMMON_QUERIES.qbtc;
      if (!params.searchPhrase) {
        query += ' AND parent:null';
      }

      return this._searchMetadataWithPredefinedQuery(params, query);
    },
    searchPublicCollections(params = {}) {
      params.status = 'public-discoverable';
      return this._searchAssetsWithPredefinedQuery(
        params,
        COMMON_QUERIES.c,
      );
    },
    searchPublicCollectionsMetadata(params = {}) {
      params.status = 'public-discoverable';
      return this._searchMetadataWithPredefinedQuery(
        params,
        COMMON_QUERIES.c,
      );
    },
    assetsHash () {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/hash/`,
        method: 'GET'
      });
    },
    createResource (details) {
      return $ajax({
        method: 'POST',
        url: `${ROOT_URL}/api/v2/assets/`,
        data: details
      });
    },
    patchAsset (uid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/`,
        method: 'PATCH',
        data: data
      });
    },
    listTags (data) {
      return $ajax({
        url: `${ROOT_URL}/tags/`,
        method: 'GET',
        data: assign({
          // If this number is too big (e.g. 9999) it causes a deadly timeout
          // whenever Form Builder displays the aside Library search
          limit: 100,
        }, data),
      });
    },
    loadNextPageUrl(nextPageUrl){
      return $ajax({
        url: nextPageUrl,
        method: 'GET'
      });
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
    createImport(contents) {
      var formData = new FormData();
      Object.keys(contents).forEach((key) => {
        formData.append(key, contents[key]);
      });
      return $ajax({
        method: 'POST',
        url: `${ROOT_URL}/api/v2/imports/`,
        data: formData,
        processData: false,
        contentType: false
      });
    },
    getResource ({id}) {
      // how can we avoid pulling asset type from the 1st character of the uid?
      var assetType = assetMapping[id[0]];
      return $.getJSON(`${ROOT_URL}/${assetType}/${id}/`);
    },

    getSubmissions(
      uid,
      pageSize = DEFAULT_PAGE_SIZE,
      page = 0,
      sort = [],
      fields = [],
      filter = ''
    ) {
      const query = `limit=${pageSize}&start=${page}`;
      var s = '&sort={"_id":-1}'; // default sort
      var f = '';
      if (sort.length) {
        s = sort[0].desc === true ? `&sort={"${sort[0].id}":-1}` : `&sort={"${sort[0].id}":1}`;
      }
      if (fields.length) {
        f = `&fields=${JSON.stringify(fields)}`;
      }

      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/?${query}${s}${f}${filter}`,
        method: 'GET',
      });
    },

    getSubmission(uid, sid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/`,
        method: 'GET'
      });
    },
    duplicateSubmission(uid, sid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/duplicate/`,
        method: 'POST'
      });
    },
    bulkPatchSubmissionsValues(uid, submissionIds, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/bulk/`,
        method: 'PATCH',
        data: {'payload': JSON.stringify({
          submission_ids: submissionIds,
          data: data,
        })}
      });
    },
    bulkPatchSubmissionsValidationStatus(uid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
        method: 'PATCH',
        data: {'payload': JSON.stringify(data)}
      });
    },
    bulkRemoveSubmissionsValidationStatus(uid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/validation_statuses/`,
        method: 'DELETE',
        data: {'payload': JSON.stringify(data)}
      });
    },
    updateSubmissionValidationStatus(uid, sid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
        method: 'PATCH',
        data: data
      });
    },
    removeSubmissionValidationStatus(uid, sid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/validation_status/`,
        method: 'DELETE'
      });
    },
    getSubmissionsQuery(uid, query='') {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/?${query}`,
        method: 'GET'
      });
    },
    deleteSubmission(uid, sid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/`,
        method: 'DELETE'
      });
    },
    bulkDeleteSubmissions(uid, data) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/bulk/`,
        method: 'DELETE',
        data: {'payload': JSON.stringify(data)}
      });
    },
    getEnketoEditLink(uid, sid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/edit/?return_url=false`,
        method: 'GET'
      });
    },
    getEnketoViewLink(uid, sid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/data/${sid}/enketo/view/`,
        method: 'GET'
      });
    },
    uploadAssetFile(uid, data) {
      var formData = new FormData();
      Object.keys(data).forEach(function(key) {
        formData.append(key, data[key]);
      });

      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/files/`,
        method: 'POST',
        data: formData,
        processData: false,
        contentType: false
      });
    },
    getAssetFiles(uid, fileType) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${uid}/files/?file_type=${fileType}`,
        method: 'GET'
      });
    },
    deleteAssetFile(assetUid, uid) {
      return $ajax({
        url: `${ROOT_URL}/api/v2/assets/${assetUid}/files/${uid}/`,
        method: 'DELETE'
      });
    },

    getHelpInAppMessages() {
      return $ajax({
        url: `${ROOT_URL}/help/in_app_messages/`,
        method: 'GET'
      });
    },
    patchHelpInAppMessage(uid, data) {
      return $ajax({
        url: `${ROOT_URL}/help/in_app_messages/${uid}/`,
        method: 'PATCH',
        data: JSON.stringify(data),
        dataType: 'json',
        contentType: 'application/json'
      });
    },

    setLanguage(data) {
      return $ajax({
        url: `${ROOT_URL}/i18n/setlang/`,
        method: 'POST',
        data: data
      });
    },
    environment() {
      return $ajax({url: `${ROOT_URL}/environment/`});
    },
    login: (creds)=> {
      return $ajax({ url: `${ROOT_URL}/api-auth/login/?next=/me/`, data: creds, method: 'POST'});
    }
  });
}).call(dataInterface = {});
