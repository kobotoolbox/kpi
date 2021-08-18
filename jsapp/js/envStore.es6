import clonedeep from 'lodash.clonedeep';
import Reflux from 'reflux';
import {actions} from 'js/actions';

const envStore = Reflux.createStore({
  data: {},

  isReady: false,

  init() {
    this.listenTo(actions.auth.getEnvironment.completed, this.onGetEnvCompleted);
    actions.auth.getEnvironment();
  },

  onGetEnvCompleted(response) {
    const nestedArrToChoiceObjs = (i) => {
      return {
        value: i[0],
        label: i[1],
      };
    };

    const output = clonedeep(response);

    if (output.available_sectors) {
      output.available_sectors = output.available_sectors.map(nestedArrToChoiceObjs);
    }
    if (output.available_countries) {
      output.available_countries = output.available_countries.map(nestedArrToChoiceObjs);
    }
    if (output.interface_languages) {
      output.interface_languages = output.interface_languages.map(nestedArrToChoiceObjs);
    }
    if (output.all_languages) {
      output.all_languages = output.all_languages.map(nestedArrToChoiceObjs);
    }

    this.data = output;
    this.isReady = true;
    this.trigger();
  },
});

export default envStore;
