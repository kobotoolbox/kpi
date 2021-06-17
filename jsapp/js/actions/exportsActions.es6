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
  dataInterface.createAssetExport(assetUid, data)
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

/**
 * @param {string} assetUid
 * @param {object} [passData] - object with custom properties to be passed to
 *                              success response
 */
exportsActions.getExportSettings.listen((assetUid, passData = {}) => {
  dataInterface.getExportSettings(assetUid)
    .done((response) => {
      exportsActions.getExportSettings.completed(response, passData);
    })
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
    export_settings: JSON.stringify(data.export_settings),
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
    export_settings: JSON.stringify(data.export_settings),
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
