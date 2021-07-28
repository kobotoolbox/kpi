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
  init() {
    this.permissions = [];
  },

  setPermissions(permissions) {
    this.permissions = permissions;
  },

  /**
   * @param {string} permCodename
   * @returns {PermDefinition}
   */
  getPermissionByCodename(permCodename) {
    this.verifyReady();
    const foundPerm = this.permissions.find((permission) => {
      return permission.codename === permCodename;
    });
    return foundPerm;
  },

  /**
   * @param {string} permUrl
   * @returns {PermDefinition}
   */
  getPermission(permUrl) {
    this.verifyReady();
    const foundPerm = this.permissions.find((permission) => {
      return permission.url === permUrl;
    });
    return foundPerm;
  },

  /**
   * Throws if trying to use permConfig before it fetches data from BE.
   */
  verifyReady() {
    if (this.permissions.length === 0) {
      throw new Error(t('Permission config is not ready or failed to initialize!'));
    }
  },
});

export default permConfig;
