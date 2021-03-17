import Reflux from 'reflux';
import {hashHistory} from 'react-router';
import {DEFAULT_EXPORT_TYPE} from './exportsConstants';

const exportsStore = Reflux.createStore({
  previousPath: hashHistory.getCurrentLocation().pathname,
  data: {
    // one of EXPORT_TYPES
    exportType: DEFAULT_EXPORT_TYPE,
  },

  init() {
    hashHistory.listen(this.onRouteChange.bind(this));
  },

  onRouteChange() {
    if (!this.isOnProjectDownloadsRoute()) {
      this.data.exportType = DEFAULT_EXPORT_TYPE;
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
