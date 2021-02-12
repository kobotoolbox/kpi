/**
 * exports related actions
 */

import Reflux from 'reflux';
import {dataInterface} from 'js/dataInterface';
import {notify} from 'utils';

const exportsActions = Reflux.createActions({
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

exportsActions.createExport.listen((data) => {
  dataInterface.createExport(data)
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
  dataInterface.updateExportSetting(assetUid, settingUid, data)
    .done(exportsActions.updateExportSetting.completed)
    .fail(exportsActions.updateExportSetting.failed);
});
exportsActions.updateExportSetting.failed.listen(() => {
  notify(t('Failed to update export setting'), 'error');
});

exportsActions.createExportSetting.listen((assetUid, data) => {
  dataInterface.createExportSetting(assetUid, data)
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
