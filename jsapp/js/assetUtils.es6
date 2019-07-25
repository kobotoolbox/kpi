import {
  t,
  getAnonymousUserPermission
} from 'js/utils';
import {ASSET_TYPES} from 'js/constants';

export function getQuestionDisplayName(question) {
  if (question.label) {
    return question.label[0];
  } else if (question.name) {
    return question.name;
  } else if (question.$autoname) {
    return question.$autoname;
  } else {
    t('Unlabelled');
  }
}

/**
 * @param {Object} asset - BE asset data
 * @return {string} k-icon CSS class name
 */
export function getAssetIcon(asset) {
  if (asset.asset_type === ASSET_TYPES.template.id) {
    return 'k-icon-template';
  } else if (
    asset.asset_type === ASSET_TYPES.question.id ||
    asset.asset_type === ASSET_TYPES.block.id
  ) {
    return 'k-icon-question-block';
  } else if (asset.asset_type === ASSET_TYPES.survey.id) {
    if (asset.has_deployment) {
      return 'k-icon-deploy';
    } else {
      return 'k-icon-drafts';
    }
  } else if (asset.kind === ASSET_TYPES.collection.id) {
    const hasAnonPerm = typeof getAnonymousUserPermission(asset.permissions) !== 'undefined';

    if (asset.discoverable_when_public || hasAnonPerm) {
      return 'k-icon-folder-public';
    } else if (asset.access_type === 'shared') {
      return 'k-icon-folder-shared';
    } else {
      return 'k-icon-folder';
    }
  }
}
