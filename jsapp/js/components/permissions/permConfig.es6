import Reflux from 'reflux';
import actions from './actions';
import {t} from 'js/utils';

const permConfig = Reflux.createStore({
  init() {
    this.state = {};
    this.listenTo(actions.permissions.getConfig.completed, this.onGetConfigCompleted);
    this.listenTo(actions.permissions.getConfig.failed, this.onGetConfigFailed);

    actions.permissions.getConfig();
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
