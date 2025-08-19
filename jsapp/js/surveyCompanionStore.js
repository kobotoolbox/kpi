import clonedeep from 'lodash.clonedeep'
import Reflux from 'reflux'
import { actions } from '#/actions'
import { stores } from '#/stores'
import dkobo_xlform from '../xlform/src/_xlform.init'

const surveyCompanionStore = Reflux.createStore({
  init() {
    this.listenTo(actions.survey.addExternalItemAtPosition, this.addExternalItemAtPosition)
  },
  addExternalItemAtPosition({ position, survey, uid, groupId }) {
    // `survey` is what's currently open in the form builder
    // `uid` identifies the library item being added to `survey`
    stores.allAssets.whenLoaded(uid, (asset) => {
      // `asset` is the library item being added to `survey`
      // be careful not to mutate it, becuase it's kept in a store and not
      // re-fetched from the server each time it's loaded
      const assetCopy = clonedeep(asset)
      // `loadDict()` will mutate its first argument; see `inputParser.parse()`
      const _s = dkobo_xlform.model.Survey.loadDict(assetCopy.content, survey)
      survey.insertSurvey(_s, position, groupId)
    })
  },
})

export default surveyCompanionStore
