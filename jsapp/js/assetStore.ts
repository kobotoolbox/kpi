import Reflux from 'reflux'
import type { AssetResponse } from '#/dataInterface'
import { actions } from './actions'
import { parsed } from './assetParserUtils'

export interface AssetStoreData {
  [uid: string]: AssetResponse
}

interface WhenLoadedListeners {
  [assetUid: string]: Array<(foundAsset: AssetResponse) => void>
}

/**
 * A store that keeps data of each asset (only the full data with `.content`).
 *
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
class AssetStore extends Reflux.Store {
  data: AssetStoreData = {}

  private whenLoadedListeners: WhenLoadedListeners = {}

  init() {
    actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted.bind(this))
    actions.resources.updateAsset.completed.listen(this.onUpdateAssetCompleted.bind(this))
    actions.resources.deleteAsset.completed.listen(this.onDeleteAssetCompleted.bind(this))
  }

  onDeleteAssetCompleted(resp: { uid: string }) {
    delete this.data[resp.uid]
    this.trigger(this.data)
  }

  onUpdateAssetCompleted(resp: AssetResponse) {
    this.data[resp.uid] = parsed(resp)
    this.trigger(this.data)
  }

  onLoadAssetCompleted(resp: AssetResponse) {
    this.data[resp.uid] = parsed(resp)
    this.notifyWhenLoadedListeners(this.data[resp.uid])
    this.trigger(this.data)
  }

  /** Returns asset object (if exists). */
  getAsset(assetUid: string): AssetResponse | undefined {
    return this.data[assetUid]
  }

  /**
   * Either calls back immediately if asset data already exists, or makes a call
   * to get asset and then calls back with fresh data.
   *
   * Useful when your component needs asset data to work, and there is a high
   * probability that it was already fetched from backend.
   *
   * NOTE: this is a copy of functionality that already exists in
   * `stores.allAssets.whenLoaded` (that one is a bit broken due to how
   * `allAssets` was written; plus it's not typed).
   */
  whenLoaded(assetUid: string, callback: (foundAsset: AssetResponse) => void) {
    const foundAsset = this.getAsset(assetUid)
    if (foundAsset) {
      callback(foundAsset)
    } else {
      if (!Array.isArray(this.whenLoadedListeners[assetUid])) {
        this.whenLoadedListeners[assetUid] = []
      }
      this.whenLoadedListeners[assetUid].push(callback)
      actions.resources.loadAsset({ id: assetUid })
    }
  }

  notifyWhenLoadedListeners(asset: AssetResponse) {
    if (this.whenLoadedListeners[asset.uid]) {
      while (this.whenLoadedListeners[asset.uid].length > 0) {
        const callback = this.whenLoadedListeners[asset.uid].pop()
        if (callback !== undefined) {
          callback(asset)
        }
      }
    }
  }
}

/**
 * This store keeps only full assets (i.e. ones with `content`)
 *
 * @deprecated migrate to react-query whenever you need to adjust things beyond simple rename
 */
const assetStore = new AssetStore()
assetStore.init()

export default assetStore
