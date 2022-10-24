import Reflux from 'reflux';
import {DEFAULT_EXPORT_SETTINGS} from './exportsConstants';
import {history} from 'js/router/historyRouter';

/**
 * It handles the selected export type.
 */
const exportsStore = Reflux.createStore({
  previousPath: history.location.pathname,
  data: {
    exportType: DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE,
  },

  init() {
    history.listen(this.onRouteChange.bind(this));
  },

  onRouteChange() {
    if (!this.isOnProjectDownloadsRoute()) {
      // when leaving the custom downloads route, reset the store
      this.data.exportType = DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE;
      this.trigger(this.data);
    }
  },

  isOnProjectDownloadsRoute() {
    const path = history.location.pathname;
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
