import clonedeep from 'lodash.clonedeep'
import Reflux from 'reflux'
import { actions } from '#/actions'
import { stores } from '#/stores'
import dkobo_xlform from '../xlform/src/_xlform.init'
import type { Survey } from '../xlform/src/model.survey'
import type { AssetResponse } from './dataInterface'

const surveyCompanionStore = Reflux.createStore({
  init() {
    this.listenTo(actions.survey.addExternalItemAtPosition, this.addExternalItemAtPosition)
  },
  addExternalItemAtPosition(options: { position: number; survey: Survey; uid: string; groupId?: string }) {
    // `survey` is what's currently open in the form builder
    // `uid` identifies the library item being added to `survey`
    stores.allAssets.whenLoaded(options.uid, (asset: AssetResponse) => {
      // `asset` is the library item being added to `survey`
      // be careful not to mutate it, because it's kept in a store and not
      // re-fetched from the server each time it's loaded
      const assetCopy = clonedeep(asset)
      // `loadDict()` will mutate its first argument; see `inputParser.parse()`
      const _s = dkobo_xlform.model.Survey.loadDict(assetCopy.content, options.survey)
      options.survey.insertSurvey(_s, options.position, options.groupId)
    })
  },
})

export default surveyCompanionStore
