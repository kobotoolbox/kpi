/**
 * Dynamic data attachment related actions
 */

import Reflux from 'reflux';
import alertify from 'alertifyjs';
import {dataInterface} from 'js/dataInterface';
import {MAX_DISPLAYED_STRING_LENGTH} from 'js/constants';
import {
  getAssetUIDFromUrl,
  truncateFile,
  truncateString,
} from 'js/utils';

const dataShareActions = Reflux.createActions({
  attachToSource: {children: ['started', 'completed', 'failed']},
  detachSource: {children: ['completed', 'failed']},
  patchSource: {children: ['started', 'completed', 'failed']},
  getAttachedSources: {children: ['completed', 'failed']},
  getSharingEnabledAssets: {children: ['completed', 'failed']},
  toggleDataSharing: {children: ['completed', 'failed']},
  updateColumnFilters: {children: ['completed', 'failed']},
});

dataShareActions.attachToSource.listen((assetUid, data) => {
  dataInterface.attachToSource(assetUid, data)
    .done(dataShareActions.attachToSource.completed)
    .fail(dataShareActions.attachToSource.failed);
  dataShareActions.attachToSource.started();
});
dataShareActions.attachToSource.failed.listen((response) => {
  alertify.error(
    response?.responseJSON?.filename[0] ||
      response?.responseJSON ||
      t('Failed to attach to source')
  );
});

dataShareActions.detachSource.listen((attachmentUrl) => {
  dataInterface.detachSource(attachmentUrl)
    .done(dataShareActions.detachSource.completed)
    .fail(dataShareActions.detachSource.failed);
});
dataShareActions.detachSource.failed.listen((response) => {
  alertify.error(response?.responseJSON || t('Failed to detach from source'));
});

dataShareActions.patchSource.listen((attachmentUrl, data) => {
  dataInterface.patchSource(attachmentUrl, data)
    .done(dataShareActions.patchSource.completed)
    .fail(dataShareActions.patchSource.failed);
  dataShareActions.patchSource.started();
});
dataShareActions.patchSource.failed.listen((response) => {
  alertify(response?.responseJSON || t('Failed to patch source'));
});

dataShareActions.getAttachedSources.listen((assetUid) => {
  dataInterface.getAttachedSources(assetUid)
    .done((response) => {
      // We create our own object from backend response because:
      // 1. We need to truncate the filename and display this instead
      // 2. We need both the current asset URL as well as it's source data URL
      let allSources = [];

      // TODO: Check is pagination is an issue, if so we should try to use the
      //       backend response directly
      response.results.forEach((source) => {
        let sourceUid = getAssetUIDFromUrl(source.source);
        allSources.push({
          sourceName: truncateString(
            source.source__name,
            MAX_DISPLAYED_STRING_LENGTH.connect_projects,
          ),
          // Source's asset url
          sourceUrl: source.source,
          sourceUid: sourceUid,
          // Fields that the connecting project has selected to import
          linkedFields: source.fields,
          filename: truncateFile(
            source.filename,
            MAX_DISPLAYED_STRING_LENGTH.connect_projects,
          ),
          // Source project attachment endpoint
          attachmentUrl: source.url,
        });
      });

      dataShareActions.getAttachedSources.completed(allSources);
    })
    .fail(dataShareActions.getAttachedSources.failed);
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

// TODO: Improve the parameters so these functions are clearly different from
//       each other
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
  alertify.error(response?.responseJSON || t('Failed to update column filters'));
});

export default dataShareActions;
