/**
 * permissions related actions
 */

import {dataInterface} from 'js/dataInterface';
import {
  t,
  notify
} from 'js/utils';
const Reflux = require('reflux');

const permissionsActions = Reflux.createActions({
  getConfig: {children: ['completed', 'failed']},
  getAllAssetPermissions: {children: ['completed', 'failed']},
  assignPerm: {children: ['completed', 'failed']},
  removePerm: {children: ['completed', 'failed']},
  copyPermissionsFrom: {children: ['completed', 'failed']},
  assignPublicPerm: {children: ['completed', 'failed']},
  setCollectionDiscoverability: {children: ['completed', 'failed']}
});

/*
 * New actions
 */

permissionsActions.getConfig.listen(() => {
  dataInterface.permissionsConfig()
    .done(permissionsActions.getConfig.completed)
    .fail(permissionsActions.getConfig.failed);
});

permissionsActions.getAllAssetPermissions.listen((uid) => {
  dataInterface.assetPermissions(uid)
    .done(permissionsActions.getAllAssetPermissions)
    .fail(permissionsActions.getAllAssetPermissions.failed);
});

/*
Old actions
 */

permissionsActions.assignPerm.listen(function(creds){
  dataInterface.assignPerm(creds)
    .done(permissionsActions.assignPerm.completed)
    .fail(permissionsActions.assignPerm.failed);
});
permissionsActions.assignPerm.failed.listen(function(){
  notify(t('failed to update permissions'), 'error');
});

// copies permissions from one asset to other
permissionsActions.copyPermissionsFrom.listen(function(sourceUid, targetUid) {
  dataInterface.copyPermissionsFrom(sourceUid, targetUid)
    .done(() => {
      permissionsActions.copyPermissionsFrom.completed(sourceUid, targetUid);
    })
    .fail(permissionsActions.copyPermissionsFrom.failed);
});

permissionsActions.removePerm.listen(function(details){
  if (!details.content_object_uid) {
    throw new Error('removePerm needs a content_object_uid parameter to be set');
  }
  dataInterface.removePerm(details.permission_url)
    .done(function(resp){
      permissionsActions.removePerm.completed(details.content_object_uid, resp);
    })
    .fail(function(resp) {
      permissionsActions.removePerm.failed(details.content_object_uid, resp);
      notify(t('Failed to remove permissions'), 'error');
    });
});

permissionsActions.setCollectionDiscoverability.listen(function(uid, discoverable){
  dataInterface.patchCollection(uid, {discoverable_when_public: discoverable})
    .done(permissionsActions.setCollectionDiscoverability.completed)
    .fail(permissionsActions.setCollectionDiscoverability.failed);
});

export default permissionsActions;
