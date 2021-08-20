import Reflux from 'reflux';
import {parsed} from './assetParserUtils';
import {actions} from './actions';

/**
 * This store keeps only full assets (i.e. ones with `content`)
 */
const assetStore = Reflux.createStore({
  init() {
    this.data = {};
    this.listenTo(actions.resources.loadAsset.completed, this.onLoadAssetCompleted);
    this.listenTo(actions.resources.updateAsset.completed, this.onUpdateAssetCompleted);
  },

  onUpdateAssetCompleted(resp: AssetResponse) {
    this.data[resp.uid] = parsed(resp);
    this.trigger(this.data, resp.uid, {asset_updated: true});
  },

  onLoadAssetCompleted(resp: AssetResponse) {
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = parsed(resp);
    this.trigger(this.data, resp.uid);
  },

  getAsset(assetUid: string): AssetResponse | undefined {
    return this.data[assetUid];
  },
});

export default assetStore;
