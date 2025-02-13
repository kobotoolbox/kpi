import Reflux, {type StoreDefinition, type Store} from 'reflux';
import {DEFAULT_EXPORT_SETTINGS, type ExportTypeDefinition} from './exportsConstants';
import {router} from 'js/router/legacy';

interface ExportsStoreDefinition extends StoreDefinition {
  data: {
    exportType: ExportTypeDefinition;
  };
  setExportType: (newExportType: ExportTypeDefinition, needsUpdating?: boolean) => void;
  getExportType: () => ExportTypeDefinition;
}

const exportsStoreDefinition: ExportsStoreDefinition = {
  data: {
    exportType: DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE,
  },

  init() {
    router?.subscribe(this.onRouteChange.bind(this));
  },

  onRouteChange() {
    if (!this.isOnProjectDownloadsRoute()) {
      // when leaving the custom downloads route, reset the store
      this.data.exportType = DEFAULT_EXPORT_SETTINGS.EXPORT_TYPE;
      this.trigger(this.data);
    }
  },

  isOnProjectDownloadsRoute() {
    const path = router?.state.location.pathname;
    return (
      path?.split('/')[1] === 'forms' &&
      path?.split('/')[3] === 'data' &&
      path?.split('/')[4] === 'downloads'
    );
  },

  setExportType(newExportType: ExportTypeDefinition, needsUpdating = true) {
    this.data.exportType = newExportType;
    if (needsUpdating) {
      this.trigger(this.data);
    }
  },

  getExportType() {
    return this.data.exportType;
  },
};

/**
 * It handles the selected export type.
*/
const exportsStore = Reflux.createStore(exportsStoreDefinition);

// TODO: refactor this Reflux store out of existence. Until then, we use this
// weird construct with forced "as" to make things work. Unfortunately Reflux
// typings are incomplete and partially wrong :,(
type ExportsStoreObj = ExportsStoreDefinition & Store;
export default exportsStore as ExportsStoreObj;
