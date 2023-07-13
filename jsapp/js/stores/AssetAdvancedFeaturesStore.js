// Convert this to ts with interfaces, etc.
// Is this a "store" in the same way as other stores?

let _ActiveAssetFeatures = null; // do not merge
export function _getActiveAssetAdvancedFeatures () {  // do not merge
  // this is a hacky way to get the features of the latest asset to be
  // loaded into a store;
  // it will not work when users navigate between different forms.
  // there's a proper way to do this in the state+props somehow
  return _ActiveAssetFeatures;
}

class AssetAdvancedFeaturesQualQuestions {
  constructor (advancedFeatures) {
    this.data = advancedFeatures.qual;
    this.hasChanges = false;
  }
  qualSurveyForQpath (qpath) {
    return this.data.qual_survey.filter((item) => item.qpath === qpath);
  }
  getQuestion ({ qpath, uuid }) {
    // Returns question json or undefined
    // uuid is unique on its own so we don't need to filter on qpath also
    return this.data.qual_survey.filter((item) => {
      return item.qpath === qpath && item.uuid === uuid
    })[0];
  }
  hasQuestion ({ qpath, uuid }) {
    return !!this.getQuestion({ qpath, uuid });
  }
}

export class AssetAdvancedFeaturesStore {
  constructor (assetApiResponse) {
    const { uid, advanced_features } = assetApiResponse;
    this.qualQuestions = new AssetAdvancedFeaturesQualQuestions(advanced_features);
    if (!_ActiveAssetFeatures) { _ActiveAssetFeatures = this; } // do not merge
  }
}
