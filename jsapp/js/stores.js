/**
 * Reflux stores for keeping all the user data.
 *
 * Using it in multiple components helps with keeping whole application up to
 * date and avoids making unnecessary calls to Backend.
 *
 * It is tightly connected to actions and the most kosher way of handling data
 * would be to trigger Backend calls through actions but to observe the results
 * throught stores not actions callbacks (for applicable stores of course - not
 * every action is connected to a store).
 *
 * TODO: it would be best to split these to separate files within `#/stores`
 * directory and probably import all of them here and keep this file as a single
 * source for all stores(?).
 * See: https://github.com/kobotoolbox/kpi/issues/3908
 */

import Reflux from 'reflux'
import { recordKeys } from '#/utils'
import { actions } from './actions'

function changes(orig_obj, new_obj) {
  var out = {},
    any = false
  recordKeys(new_obj).forEach((key) => {
    if (orig_obj[key] !== new_obj[key]) {
      out[key] = new_obj[key]
      any = true
    }
  })
  if (!any) {
    return false
  }
  return out
}

export var stores = {}

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
stores.surveyState = Reflux.createStore({
  init() {
    this.state = {}
  },
  setState(state) {
    var chz = changes(this.state, state)
    if (chz) {
      Object.assign(this.state, state)
      this.trigger(chz)
    }
  },
})

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
stores.translations = Reflux.createStore({
  init() {
    this.state = {
      isTranslationTableUnsaved: false,
    }
  },
  setState(change) {
    const changed = changes(this.state, change)
    if (changed) {
      Object.assign(this.state, changed)
      this.trigger(changed)
    }
  },
  setTranslationTableUnsaved(isUnsaved) {
    this.setState({
      isTranslationTableUnsaved: isUnsaved,
    })
  },
})

/**
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
stores.snapshots = Reflux.createStore({
  init() {
    this.listenTo(actions.resources.createSnapshot.completed, this.snapshotCreated)
    this.listenTo(actions.resources.createSnapshot.failed, this.snapshotCreationFailed)
  },
  snapshotCreated(snapshot) {
    this.trigger(Object.assign({ success: true }, snapshot))
  },
  snapshotCreationFailed(jqxhr) {
    this.trigger(Object.assign({ success: false }, jqxhr.responseJSON))
  },
})
