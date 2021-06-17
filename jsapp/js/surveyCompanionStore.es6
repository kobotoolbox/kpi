import Reflux from 'reflux';
import clonedeep from 'lodash.clonedeep';
import dkobo_xlform from '../xlform/src/_xlform.init';
import {actions} from 'js/actions';
import {stores} from 'js/stores';

const surveyCompanionStore = Reflux.createStore({
  init() {
    this.listenTo(actions.survey.addExternalItemAtPosition, this.addExternalItemAtPosition);
  },
  addExternalItemAtPosition({position, survey, uid, groupId}) {
    // `survey` is what's currently open in the form builder
    // `uid` identifies the library item being added to `survey`
    stores.allAssets.whenLoaded(uid, function(asset){
      // `asset` is the library item being added to `survey`
      // be careful not to mutate it, becuase it's kept in a store and not
      // re-fetched from the server each time it's loaded
      let assetCopy = clonedeep(asset);
      // `loadDict()` will mutate its first argument; see `inputParser.parse()`
      let _s = dkobo_xlform.model.Survey.loadDict(assetCopy.content, survey);
      survey.insertSurvey(_s, position, groupId);
    });
  },
});

export default surveyCompanionStore;
