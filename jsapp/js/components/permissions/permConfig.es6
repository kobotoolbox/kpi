import Reflux from 'reflux';

/**
 * @typedef {Object} PermDefinition - A permission object from backend.
 * @property {string} url - Url of given permission type.
 * @property {string} name
 * @property {string} description
 * @property {string} codename
 * @property {string[]} implied - A list of implied permissions.
 * @property {string[]} contradictory - A list of contradictory permissions.
 */

/**
 * NOTE: this relies on the app being initialized by calling
 * `actions.permissions.getConfig()` and then manually setting results here,
 * otherwise expect `verifyReady` to throw
 */
const permConfig = Reflux.createStore({
  permissions: [],

  /**
   * @param {PermDefinition[]} permissions
   */
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
