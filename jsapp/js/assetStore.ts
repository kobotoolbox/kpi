import Reflux from 'reflux';
import {parsed} from './assetParserUtils';
import {actions} from './actions';

class AssetStore extends Reflux.Store {
  data: {[uid: string]: AssetResponse} = {};

  init() {
    actions.resources.loadAsset.completed.listen(this.onLoadAssetCompleted.bind(this));
    actions.resources.updateAsset.completed.listen(this.onUpdateAssetCompleted.bind(this));
  }

  onUpdateAssetCompleted(resp: AssetResponse) {
    this.data[resp.uid] = parsed(resp);
    this.trigger(this.data);
  }

  onLoadAssetCompleted(resp: AssetResponse) {
    if (!resp.uid) {
      throw new Error('no uid found in response');
    }
    this.data[resp.uid] = parsed(resp);
    this.trigger(this.data);
  }

  getAsset(assetUid: string): AssetResponse | undefined {
    return this.data[assetUid];
  }
}

/**
 * This store keeps only full assets (i.e. ones with `content`)
 */
const assetStore = new AssetStore();
assetStore.init();

export default assetStore;
