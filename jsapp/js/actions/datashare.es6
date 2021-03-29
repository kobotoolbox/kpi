/**
 * Dynamic data attachment related actions
 */

import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {dataInterface} from 'js/dataInterface';

const dataShareActions = Reflux.createActions({
  attachToParent: {children: ['completed', 'failed']},
  detachParent: {children: ['completed', 'failed']},
  getAttachedParents: {children: ['completed', 'failed']},
  getSharingEnabledAssets: {children: ['completed', 'failed']},
  toggleDataSharing: {children: ['completed', 'failed']},
});

dataShareActions.attachToParent.listen((assetUid, data) => {
  dataInterface.attachToParent(assetUid, data)
    .done(dataShareActions.attachToParent.completed)
    .fail(dataShareActions.attachToParent.failed);
});

dataShareActions.detachParent.listen((attachmentUrl) => {
  dataInterface.detachParent(attachmentUrl)
    .done(dataShareActions.detachParent.completed)
    .fail(dataShareActions.detachParent.failed);
});

dataShareActions.getAttachedParents.listen((assetUid) => {
  dataInterface.getAttachedParents(assetUid)
    .done((response) => {
      let allParents = [];
      response.results.forEach((parent) => {
        // Remove file extension
        let filename = parent.filename.replace(/\.[^/.]+$/, '');
        // Get Uid from url
        let parentUid = parent.parent.match(/.*\/([^/]+)\//)[1];
        allParents.push({
          parentName: parent.parent_name,
          parentUrl: parent.parent,
          parentUid: parentUid,
          filename: filename,
          attachmentUrl: parent.url,
        });
      });
      dataShareActions.getAttachedParents.completed(allParents);
    })
    .fail(dataShareActions.getAttachedParents.failed);
});

dataShareActions.getSharingEnabledAssets.listen(() => {
  dataInterface.getSharingEnabledAssets()
    .done(dataShareActions.getSharingEnabledAssets.completed)
    .fail(dataShareActions.getSharingEnabledAssets.failed);
});
dataShareActions.getSharingEnabledAssets.failed.listen(() => {
  alertify.error(t('Failed to retrieve sharing enabled assets'));
});

dataShareActions.toggleDataSharing.listen((uid, data) => {
  dataInterface.toggleDataSharing(uid, data)
    .done(dataShareActions.toggleDataSharing.completed)
    .fail(dataShareActions.toggleDataSharing.failed);
});
dataShareActions.toggleDataSharing.failed.listen((response) => {
  alertify.error(response?.responseJSON?.detail || t('Failed to toggle sharing'))
});

export default dataShareActions;
