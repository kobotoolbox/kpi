import assetUtils from "../assetUtils";
import assetStore from 'js/assetStore';
import Ajv from 'ajv';

const getAdvancedSchema = async (assetUid) => {
  return assetStore.getAsset(assetUid).advanced_submission_schema;
}

let _ActiveAssetFeatures = {}; // do not merge
export function getCurrentAdvancedFeaturesObject () {  // do not merge
  // this is not a great way to get the current advanced features,
  // but it should work even if you navigate to a different asset.

  // is there an easier way to get the current asset UID?
  const mtch = window.location.hash.match(/\#\/forms\/a(\w+)\//);
  if (!mtch) {
    throw new Error('cant get current asset uid');
  }
  let curAssetUid = `a${mtch[1]}`;

  if (!_ActiveAssetFeatures[curAssetUid]) {
    const advancedFeatures = assetUtils.getAssetAdvancedFeatures(curAssetUid);
    _ActiveAssetFeatures[curAssetUid] = new AssetAdvancedFeatures({
      uid: curAssetUid,
      advanced_features: advancedFeatures,
    });
  }
  return _ActiveAssetFeatures[curAssetUid];
}


export class AssetAdvancedFeatures {
  constructor (assetApiResponse) {
    const { uid, advanced_features } = assetApiResponse;
    this.uid = uid;
    this.qualQuestions = new AssetAdvancedFeaturesQualQuestions(advanced_features);
  }
  async updateResponse ({ qpath, submissionUuid }, qualResponse) {
    // this will update the SubmissionExtras model corresponding to the
    // submission's uuid, qpath, etc
    // const advancedSubmissionPostUrl = `/advanced_submission_post/${this.uid}?submission=${submissionUuid}`;
    // console.log('GET advancedSubmissionPostUrl: ', advancedSubmissionPostUrl);
    console.log('Query existing submission_extras data:')
    const url = [
      assetUtils.getAssetProcessingUrl(this.uid),
      `?submission=`,
      submissionUuid,
    ].join('');
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        accept: 'application/json',
      }
    });
    const values = await response.json();
    const forThisQpath = values[qpath] || {};
    const forQual = forThisQpath.qual || [];
    const existing = forQual.find(({ uuid }) => uuid === qualResponse.uuid);
    if (!existing) {
      forQual.push(qualResponse);
    } else {
      Object.assign(existing, qualResponse);
    }

    const updated = forQual.find(({ uuid }) => uuid === qualResponse.uuid);
    const schema = await getAdvancedSchema(this.uid);
    const ajv = new Ajv();
    const isValid = ajv.validate({
      type: 'object',
      allOf: [{'$ref': '#/definitions/qual_item'}],
      definitions: schema.definitions,
    }, updated);
    if (!isValid) {
      debugger;
      console.error("Response content does not validate:", updated);
      console.error(ajv.errors);
    } else {
      const jsonstring = JSON.stringify(values, null, 2);
      console.log(`%c PATCH ${jsonstring} \n to ${advancedSubmissionPostUrl}`, 'color:green');
    }
  }
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
  updateQuestion ({ uuid, qpath }, questionDetails) {
    const existingQuestion = this.getQuestion({ uuid, qpath });
    if ('response' in questionDetails) {
      delete questionDetails.response;
    }
    if ('isDraft' in questionDetails) {
      delete questionDetails.isDraft;
    }
    Object.assign(questionDetails, {
      scope: 'by_question#survey',
      qpath,
    })
    if (existingQuestion) {
      Object.assign(existingQuestion, questionDetails);
      this.hasChanges = true;
    } else {
      this.data.qual_survey.push(questionDetails);
      this.hasChanges = true;
    }
    console.log('%c' + JSON.stringify(this.data.qual_survey, null, 2), 'font-size:9px; color: #001e78; line-height: 8px')
    // ^ POST these changes to /api/v2/asset/{uid}'s advanced_features
  }
}
