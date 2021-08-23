import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {DEFAULT_EXPORT_SETTINGS} from './exportsConstants';

/**
 * It handles the selected export type.
 */
const exportsStore = Reflux.createStore({
  previousPath: hashHistory.getCurrentLocation().pathname,
  data: {
    exportType: DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE,
  },

  init() {
    hashHistory.listen(this.onRouteChange.bind(this));
  },

  onRouteChange() {
    if (!this.isOnProjectDownloadsRoute()) {
      // when leaving the custom downloads route, reset the store
      this.data.exportType = DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE;
      this.trigger(this.data);
    }
  },

  isOnProjectDownloadsRoute() {
    const path = hashHistory.getCurrentLocation().pathname;
    return (
      path.split('/')[1] === 'forms' &&
      path.split('/')[3] === 'data' &&
      path.split('/')[3] === 'downloads'
    );
  },

  setExportType(newExportType, needsUpdating = true) {
    this.data.exportType = newExportType;
    if (needsUpdating) {
      this.trigger(this.data);
    }
  },

  getExportType() {
    return this.data.exportType;
  },
});

export default exportsStore;
