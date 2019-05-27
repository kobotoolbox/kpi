import Reflux from 'reflux';
import actions from 'js/actions';
import {
  t,
  notify,
  assign
} from 'js/utils';

// TODO instead of this use `stateChanges` function from '/js/utils'
// after https://github.com/kobotoolbox/kpi/pull/1959 is merged
function stateChanges(orig_obj, new_obj) {
  var out = {},
      any = false;
  Object.keys(new_obj).forEach(function(key) {
    if (orig_obj[key] !== new_obj[key]) {
      out[key] = new_obj[key];
      any = true;
    }
  });
  if (!any) {
    return false;
  }
  return out;
}

/**
 * @typedef {Object} PermDefinition - A permission object from backend.
 * @property {string} url - Url of given permission type.
 * @property {string} name
 * @property {string} description
 * @property {string} codename
 * @property {string[]} implied - A list of implied permissions.
 * @property {string[]} contradictory - A list of contradictory permissions.
 */

const permConfig = Reflux.createStore({
  init() {
    this.state = {
      permissions: []
    };
    this.listenTo(actions.permissions.getConfig.completed, this.onGetConfigCompleted);
    this.listenTo(actions.permissions.getConfig.failed, this.onGetConfigFailed);
    actions.permissions.getConfig();
  },

  setState (change) {
    const changed = stateChanges(this.state, change);
    if (changed) {
      assign(this.state, changed);
      this.trigger(changed);
    }
  },

  onGetConfigCompleted(response) {
    this.setState({permissions: response.results});
  },

  onGetConfigFailed() {
    notify('Failed to get permissions config!', 'error');
  },

  /**
   * @param {string} permCodename
   * @returns {PermDefinition}
   */
  getPermissionByCodename(permCodename) {
    this.verifyReady();
    const foundPerm = this.state.permissions.find((permission) => {
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
    const foundPerm = this.state.permissions.find((permission) => {
      return permission.url === permUrl;
    });
    return foundPerm;
  },

  /**
   * Throws if trying to use permConfig before it fetches data from BE.
   */
  verifyReady() {
    if (this.state.permissions.length === 0) {
      throw new Error(t('Permission config is not ready or failed to initialize!'));
    }
  },

  /**
   * Returns a list of available permissions for given asset type.
   */
  getAvailablePermissions(assetType) {
    if (assetType === 'survey') {
      return [
        {value: 'view', label: t('View Form')},
        {value: 'change', label: t('Edit Form')},
        {value: 'view_submissions', label: t('View Submissions')},
        {value: 'add_submissions', label: t('Add Submissions')},
        {value: 'change_submissions', label: t('Edit Submissions')},
        {value: 'validate_submissions', label: t('Validate Submissions')}
      ];
    } else {
      return [
        {value: 'view', label: t('View')},
        {value: 'change', label: t('Edit')},
      ];
    }
  }
});

export default permConfig;
