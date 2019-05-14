import Reflux from 'reflux';
import actions from 'js/actions';
import {
  t,
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
    console.log('permConfig getConfig cmpleted', response);
    this.setState(response);
  },
  onGetConfigFailed(response) {
    console.error('Failed to get permissions config!', response);
  },
  getConfig() {
    if (Object.keys(this.state).length === 0) {
      throw new Error(t('No permissions config to get!'));
    } else {
      return this.state;
    }
  }
});

export default permConfig;
