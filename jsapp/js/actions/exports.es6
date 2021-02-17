/**
 * exports related actions
 */

import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {notify} from 'utils';

const exportsActions = Reflux.createActions({
  getExport: {children: ['completed', 'failed']},
  getExports: {children: ['completed', 'failed']},
  createExport: {children: ['completed', 'failed']},
  deleteExport: {children: ['completed', 'failed']},
  getExportSettings: {children: ['completed', 'failed']},
  getExportSetting: {children: ['completed', 'failed']},
  updateExportSetting: {children: ['completed', 'failed']},
  createExportSetting: {children: ['completed', 'failed']},
  deleteExportSetting: {children: ['completed', 'failed']},
});

exportsActions.getExports.listen((assetUid) => {
  dataInterface.getAssetExports(assetUid)
    .done(exportsActions.getExports.completed)
    .fail(exportsActions.getExports.failed);
});

exportsActions.getExport.listen((assetUid) => {
  dataInterface.getAssetExport(assetUid)
    .done(exportsActions.getExport.completed)
    .fail(exportsActions.getExport.failed);
});

/**
 * @param {object} data
 * @param {string} data.source - asset uid
 * …and the rest of parameters should match export_settings
 */
exportsActions.createExport.listen((data) => {
  dataInterface.createAssetExport(data)
    .done(exportsActions.createExport.completed)
    .fail(exportsActions.createExport.failed);
});
exportsActions.createExport.failed.listen(() => {
  notify(t('Failed to create export'), 'error');
});

exportsActions.deleteExport.listen((exportUid) => {
  dataInterface.deleteAssetExport(exportUid)
    .done(exportsActions.deleteExport.completed)
    .fail(exportsActions.deleteExport.failed);
});
exportsActions.deleteExport.failed.listen(() => {
  notify(t('Failed to delete export'), 'error');
});

function cleanupExportSettingData(data) {
  const cleanData = {
    name: data.name,
    // Backend requires export_settings to be stringified JSON
    export_settings: JSON.stringify({
      // Backend expects booleans as strings
      fields_from_all_versions: String(data.export_settings.fields_from_all_versions),
      fields: data.export_settings.fields,
      group_sep: data.export_settings.group_sep,
      // Backend expects booleans as strings
      hierarchy_in_labels: String(data.export_settings.hierarchy_in_labels),
      lang: data.export_settings.lang,
      multiple_select: data.export_settings.multiple_select,
      type: data.export_settings.type,
    }),
  };

  if (data.export_settings.flatten) {
    // Backend expects booleans as strings
    cleanData.flatten = String(data.export_settings.flatten);
  }

  return cleanData;
}

exportsActions.getExportSettings.listen((assetUid) => {
  dataInterface.getExportSettings(assetUid)
    .done(exportsActions.getExportSettings.completed)
    .fail(exportsActions.getExportSettings.failed);
});

exportsActions.getExportSetting.listen((assetUid, settingUid) => {
  dataInterface.getExportSetting(assetUid, settingUid)
    .done(exportsActions.getExportSetting.completed)
    .fail(exportsActions.getExportSetting.failed);
});

exportsActions.updateExportSetting.listen((assetUid, settingUid, data) => {
  const cleanData = cleanupExportSettingData(data);
  dataInterface.updateExportSetting(assetUid, settingUid, cleanData)
    .done(exportsActions.updateExportSetting.completed)
    .fail(exportsActions.updateExportSetting.failed);
});
exportsActions.updateExportSetting.failed.listen(() => {
  notify(t('Failed to update export setting'), 'error');
});

exportsActions.createExportSetting.listen((assetUid, data) => {
  const cleanData = cleanupExportSettingData(data);
  dataInterface.createExportSetting(assetUid, cleanData)
    .done(exportsActions.createExportSetting.completed)
    .fail(exportsActions.createExportSetting.failed);
});
exportsActions.createExportSetting.failed.listen(() => {
  notify(t('Failed to create export setting'), 'error');
});

exportsActions.deleteExportSetting.listen((assetUid, settingUid) => {
  dataInterface.deleteExportSetting(assetUid, settingUid)
    .done(exportsActions.deleteExportSetting.completed)
    .fail(exportsActions.deleteExportSetting.failed);
});
exportsActions.deleteExportSetting.failed.listen(() => {
  notify(t('Failed to delete export setting'), 'error');
});

export default exportsActions;
