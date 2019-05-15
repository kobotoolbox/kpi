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

const permConfig = Reflux.createStore({
  init() {
    this.state = {};
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
    console.debug('permConfig getConfig cmpleted', response);
    this.setState(response);
  },
  onGetConfigFailed() {
    notify('Failed to get permissions config!', 'error');
  },
  getConfig() {
    if (Object.keys(this.state).length === 0) {
      throw new Error(t('No permissions config to get!'));
    } else {
      return this.state;
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
