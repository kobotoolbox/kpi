/**
 * Dynamic data attachment related actions
 */

import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {dataInterface} from 'js/dataInterface';
import {MAX_DISPLAYED_STRING_LENGTH} from '../constants';
import {
  getAssetUIDFromUrl,
  truncateFile,
  truncateString,
} from '../utils';

const dataShareActions = Reflux.createActions({
  attachToParent: {children: ['completed', 'failed']},
  detachParent: {children: ['completed', 'failed']},
  patchParent: {children: ['completed', 'failed']},
  getAttachedParents: {children: ['completed', 'failed']},
  getSharingEnabledAssets: {children: ['completed', 'failed']},
  toggleDataSharing: {children: ['completed', 'failed']},
  updateColumnFilters: {children: ['completed', 'failed']},
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

dataShareActions.patchParent.listen((attachmentUrl, data) => {
  dataInterface.patchParent(attachmentUrl, data)
    .done((response) => {
      dataShareActions.patchParent.completed(response);
    })
    .fail((response) => {
      dataShareActions.patchParent.failed(response)
    })
});

dataShareActions.getAttachedParents.listen((assetUid) => {
  dataInterface.getAttachedParents(assetUid)
    .done((response) => {
      let allParents = [];
      response.results.forEach((parent) => {
        let parentUid = getAssetUIDFromUrl(parent.parent);
        allParents.push({
          parentName: truncateString(
            parent.parent_name,
            MAX_DISPLAYED_STRING_LENGTH.connect_projects,
          ),
          // Parent's asset url
          parentUrl: parent.parent,
          parentUid: parentUid,
          // Fields that child has selected to import
          childFields: parent.fields,
          filename: truncateFile(
            parent.filename,
            MAX_DISPLAYED_STRING_LENGTH.connect_projects,
          ),
          // Child-parent attachment endpoint
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

// The next two actions have the same endpoint but must be handled very
// differently so we leave them as seperate actions
dataShareActions.toggleDataSharing.listen((uid, data) => {
  dataInterface.patchDataSharing(uid, data)
    .done(dataShareActions.toggleDataSharing.completed)
    .fail(dataShareActions.toggleDataSharing.failed);
});
dataShareActions.toggleDataSharing.failed.listen((response) => {
  alertify.error(response?.responseJSON?.detail || t('Failed to toggle sharing'))
});

dataShareActions.updateColumnFilters.listen((uid, data) => {
  dataInterface.patchDataSharing(uid, data)
    .done(dataShareActions.updateColumnFilters.completed)
    .fail(dataShareActions.updateColumnFilters.failed);
});
dataShareActions.updateColumnFilters.failed.listen((response) => {
  alertify.error(response.responseJSON);
});

export default dataShareActions;
