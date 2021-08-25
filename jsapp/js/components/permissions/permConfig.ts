import Reflux from 'reflux';

interface PermConfig extends Reflux.Store {
  setPermissions: (permissions: PermissionDefinition[]) => void
  getPermissionByCodename: () => PermissionDefinition
  getPermission: () => PermissionDefinition
  verifyReady: () => void | never
  isReady: () => boolean
}

/**
 * NOTE: this store relies on the app being initialized by calling
 * `actions.permissions.getConfig()` and then manually setting results here,
 * otherwise expect `verifyReady` to throw
 */
const permConfig = <PermConfig>Reflux.createStore({
  permissions: [],

  setPermissions(permissions) {
    this.permissions = permissions;
  },

  /**
   * @param {string} wantedCodename
   * @returns {PermDefinition|undefined}
   */
  getPermissionByCodename(wantedCodename) {
    this.verifyReady();
    return this.permissions.find((perm) => perm.codename === wantedCodename);
  },

  /**
   * @param {string} wantedUrl
   * @returns {PermDefinition|undefined}
   */
  getPermission(wantedUrl) {
    this.verifyReady();
    return this.permissions.find((perm) => perm.url === wantedUrl);
  },

  /**
   * Throws if trying to use permConfig before it fetches data from BE or if
   * data given by `setPermissions` is not an array.
   */
  verifyReady() {
    if (!this.isReady()) {
      throw new Error(t('Permission config is not ready or failed to initialize!'));
    }
  },

  isReady() {
    return Array.isArray(this.permissions) && this.permissions.length !== 0;
  },
});

export default permConfig;
