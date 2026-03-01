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

import { toast } from 'react-hot-toast'
import Reflux from 'reflux'
import { notify, recordKeys } from '#/utils'
import { actions } from './actions'
import { parseTags } from './assetParserUtils'

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

const MAX_SEARCH_AGE = 5 * 60 // seconds

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

/**
 * This store keeps data of assets, both complete (i.e. with `content` property)
 * and incomplete (e.g. from asset lists).
 *
 * NOTE: this is not a reliable source of complete assets (i.e. ones with
 * `content`) as `onListAssetsCompleted` will overwrite asset-with-content with
 * one without it.
 *
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
stores.allAssets = Reflux.createStore({
  init() {
    this.data = []
    this.byUid = {}
    this._waitingOn = {}

    this.listenTo(actions.resources.updateAsset.completed, this.onUpdateAssetCompleted)
    this.listenTo(actions.resources.deleteAsset.completed, this.onDeleteAssetCompleted)
    this.listenTo(actions.resources.cloneAsset.completed, this.onCloneAssetCompleted)
    this.listenTo(actions.resources.loadAsset.completed, this.onLoadAssetCompleted)
    this.listenTo(actions.permissions.removeAssetPermission.completed, this.onDeletePermissionCompleted)
  },
  /**
   * Either calls immediately if data already exists, or makes a call to get
   * asset and then calls.
   *
   * @param {string} uid
   * @param {function} cb
   */
  whenLoaded(uid, cb) {
    if (typeof uid !== 'string' || typeof cb !== 'function') {
      return
    }

    if (this.byUid[uid] && this.byUid[uid].content) {
      cb.call(this, this.byUid[uid])
    } else {
      if (!this._waitingOn[uid]) {
        this._waitingOn[uid] = []
      }
      this._waitingOn[uid].push(cb)
      actions.resources.loadAsset({ id: uid })
    }
  },

  /**
   * @param {string} assetUid
   * @returns {object|undefined}
   */
  getAsset(assetUid) {
    return this.byUid[assetUid]
  },

  onUpdateAssetCompleted(asset) {
    this.registerAsset(asset)
    this.data.forEach((dataAsset, index) => {
      if (dataAsset.uid === asset.uid) {
        this.data[index] = asset
      }
    })
  },
  onLoadAssetCompleted(asset) {
    this.registerAsset(asset)
  },
  onCloneAssetCompleted(asset) {
    this.registerAsset(asset)
    this.byUid[asset.uid] = asset
    this.data.unshift(asset)
    this.trigger(this.data)
  },
  onDeleteAssetCompleted(asset) {
    if (this.byUid[asset.uid]) {
      // We append `deleted: true` to the asset after the asset is removed in
      // the backend because the asset still exists in the frontend,
      // specifically in the search store's lists.
      // We do this so that the deleted asset doesn't show up in the asset list
      // during the same search store instance
      this.byUid[asset.uid].deleted = 'true'
      this.trigger(this.data)
      window.setTimeout(() => {
        this.data = this.data.filter((item) => item.uid !== asset.uid)
        this.trigger(this.data)
      }, 500)
    }
  },
  onDeletePermissionCompleted(assetUid, isNonOwner) {
    // When non owner self removes all his asset permissions, it's as if the
    // asset was deleted for them
    if (isNonOwner) {
      this.onDeleteAssetCompleted({ uid: assetUid })
    }
  },
  registerAsset(asset) {
    const parsedObj = parseTags(asset)
    asset.tags = parsedObj.tags
    this.byUid[asset.uid] = asset
    if (asset.content) {
      this.callCallbacks(asset)
    }
  },
  callCallbacks(asset) {
    if (this._waitingOn[asset.uid]) {
      while (this._waitingOn[asset.uid].length > 0) {
        var cb = this._waitingOn[asset.uid].pop()
        cb.call(this, asset)
      }
    }
  },
  onListAssetsCompleted: function (searchData, response) {
    toast.dismiss('query_too_short')
    response.results.forEach(this.registerAsset)
    this.data = response.results
    this.trigger(this.data)
  },
  onListAssetsFailed: (searchData, response) => {
    let iconStyle = 'warning'
    const opts = {}
    if (response?.responseJSON?.detail === t('Your query is too short')) {
      iconStyle = 'empty'
      opts.id = 'query_too_short' // de-dupe and make dismissable on success
    }
    notify(response?.responseJSON?.detail || t('failed to list assets'), iconStyle, opts)
  },
})
