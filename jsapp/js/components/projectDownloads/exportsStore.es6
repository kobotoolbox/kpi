import Reflux from 'reflux';
import {DEFAULT_EXPORT_SETTINGS} from './exportsConstants';
import {router} from 'js/router/legacy';

/**
 * It handles the selected export type.
 */
const exportsStore = Reflux.createStore({
  data: {
    exportType: DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE,
  },

  init() {
    router.subscribe(this.onRouteChange.bind(this));
  },

  onRouteChange() {
    if (!this.isOnProjectDownloadsRoute()) {
      // when leaving the custom downloads route, reset the store
      this.data.exportType = DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE;
      this.trigger(this.data);
    }
  },

  isOnProjectDownloadsRoute() {
    const path = router.state.location.pathname;
    return (
      path.split('/')[1] === 'forms' &&
      path.split('/')[3] === 'data' &&
      path.split('/')[4] === 'downloads'
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
