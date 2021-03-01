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

/**
 * @param {string} assetUid
 */
exportsActions.getExports.listen((assetUid) => {
  dataInterface.getAssetExports(assetUid)
    .done(exportsActions.getExports.completed)
    .fail(exportsActions.getExports.failed);
});

/**
 * @param {string} assetUid
 * @param {string} exportUid
 */
exportsActions.getExport.listen((assetUid, exportUid) => {
  dataInterface.getAssetExport(assetUid, exportUid)
    .done(exportsActions.getExport.completed)
    .fail(exportsActions.getExport.failed);
});

/**
 * @param {string} assetUid
 * @param {object} data
 * @param {string} data.source - asset uid
 * …and the rest of parameters should match export_settings
 */
exportsActions.createExport.listen((assetUid, data) => {
  const cleanData = cleanupExportSettings(data);
  dataInterface.createAssetExport(assetUid, cleanData)
    .done(exportsActions.createExport.completed)
    .fail(exportsActions.createExport.failed);
});
exportsActions.createExport.failed.listen(() => {
  notify(t('Failed to create export'), 'error');
});

/**
 * @param {string} assetUid
 * @param {string} exportUid
 */
exportsActions.deleteExport.listen((assetUid, exportUid) => {
  dataInterface.deleteAssetExport(assetUid, exportUid)
    .done(exportsActions.deleteExport.completed)
    .fail(exportsActions.deleteExport.failed);
});
exportsActions.deleteExport.failed.listen(() => {
  notify(t('Failed to delete export'), 'error');
});

function cleanupExportSettings(export_settings) {
  const clean = {
    // Backend expects booleans as strings
    fields_from_all_versions: String(export_settings.fields_from_all_versions),
    fields: export_settings.fields,
    group_sep: export_settings.group_sep,
    // Backend expects booleans as strings
    hierarchy_in_labels: String(export_settings.hierarchy_in_labels),
    lang: export_settings.lang,
    multiple_select: export_settings.multiple_select,
    type: export_settings.type,
  };

  if (export_settings.flatten) {
    // Backend expects booleans as strings
    clean.flatten = String(export_settings.flatten);
  }

  if (export_settings.source) {
    clean.source = export_settings.source;
  }

  return clean;
}

/**
 * @param {string} assetUid
 */
exportsActions.getExportSettings.listen((assetUid) => {
  dataInterface.getExportSettings(assetUid)
    .done(exportsActions.getExportSettings.completed)
    .fail(exportsActions.getExportSettings.failed);
});

/**
 * @param {string} assetUid
 * @param {string} settingUid
 */
exportsActions.getExportSetting.listen((assetUid, settingUid) => {
  dataInterface.getExportSetting(assetUid, settingUid)
    .done(exportsActions.getExportSetting.completed)
    .fail(exportsActions.getExportSetting.failed);
});

/**
 * @param {string} assetUid
 * @param {string} settingUid
 * @param {object} data
 */
exportsActions.updateExportSetting.listen((assetUid, settingUid, data) => {
  const cleanData = {
    name: data.name,
    export_settings: JSON.stringify(cleanupExportSettings(data.export_settings)),
  };
  dataInterface.updateExportSetting(assetUid, settingUid, cleanData)
    .done(exportsActions.updateExportSetting.completed)
    .fail(exportsActions.updateExportSetting.failed);
});
exportsActions.updateExportSetting.failed.listen(() => {
  notify(t('Failed to update export setting'), 'error');
});

/**
 * @param {string} assetUid
 * @param {object} data
 */
exportsActions.createExportSetting.listen((assetUid, data) => {
  const cleanData = {
    name: data.name,
    export_settings: JSON.stringify(cleanupExportSettings(data.export_settings)),
  };
  dataInterface.createExportSetting(assetUid, cleanData)
    .done(exportsActions.createExportSetting.completed)
    .fail(exportsActions.createExportSetting.failed);
});
exportsActions.createExportSetting.failed.listen(() => {
  notify(t('Failed to create export setting'), 'error');
});

/**
 * @param {string} assetUid
 * @param {string} settingUid
 */
exportsActions.deleteExportSetting.listen((assetUid, settingUid) => {
  dataInterface.deleteExportSetting(assetUid, settingUid)
    .done(exportsActions.deleteExportSetting.completed)
    .fail(exportsActions.deleteExportSetting.failed);
});
exportsActions.deleteExportSetting.failed.listen(() => {
  notify(t('Failed to delete export setting'), 'error');
});

export default exportsActions;
