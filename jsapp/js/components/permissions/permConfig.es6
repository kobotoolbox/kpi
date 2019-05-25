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

// TODO: this data should come from backend
const MOCK_ASSIGNABLE_PERMISSIONS = {
  view_asset: {id: 'view_asset', label: 'View Form'},
  change_asset: {id: 'change_asset', label: 'Edit Form'},
  add_submissions: {id: 'add_submissions', label: 'Add Submissions'},
  view_submissions: {id: 'view_submissions', label: 'View Submissions'},
  partial_submissions: {id: 'partial_submissions', label: 'Restrict to submissions made by certain users'},
  change_submissions: {id: 'change_submissions', label: 'Edit Submissions'},
  validate_submissions: {id: 'validate_submissions', label: 'Validate Submissions'}
};
const MOCK_IMPLIED_PERMISSIONS = {
  view_asset: [],
  change_asset: ['view_asset'],
  add_submissions: ['view_asset'],
  view_submissions: ['view_asset'],
  partial_submissions: ['view_asset'],
  change_submissions: ['view_submissions'],
  validate_submissions: ['view_submissions']
};

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
  getPermissionName(permUrl) {
    this.verifyReady();
    const foundPerm = this.state.permissions.find((permission) => {
      return permission.url === permUrl;
    });
    // fallback to codename
    return foundPerm.name || foundPerm.codename;
  },
  getPermissionDescription(permUrl) {
    this.verifyReady();
    const foundPerm = this.state.permissions.find((permission) => {
      return permission.url === permUrl;
    });
    return foundPerm.description;
  },
  getImpliedPermissions(permCodename) {
    this.verifyReady();
    return this.state.implied[permCodename];
  },
  getAssignablePermissions() {
    this.verifyReady();
    return this.state.assignable;
  },
  verifyReady() {
    if (this.state.permissions.length === 0) {
      throw new Error(t('Permission config is not ready or failed to initialize!'));
    }
  },
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
