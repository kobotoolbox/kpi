import actions from 'js/actions';
import stores from 'js/stores';
import {
  t,
  getAnonymousUserPermission
} from 'js/utils';
import {
  ASSET_TYPES,
  MODAL_TYPES
} from 'js/constants';

/**
 * @param {Object} question - Part of BE asset data
 * @returns {string} usable name of the question when possible, "Unlabelled" otherwise.
 */
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
 * For getting the icon class name for given asset type.
 * @param {Object} asset - BE asset data
 * @returns {string} k-icon CSS class name
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

/**
 * Opens a modal for editing asset details.
 * @param {Object} asset - BE asset data
 */
export function modifyDetails(asset) {
  let modalType;
  if (asset.asset_type === ASSET_TYPES.template.id) {
    modalType = MODAL_TYPES.LIBRARY_TEMPLATE;
  } else if (asset.asset_type === ASSET_TYPES.collection.id) {
    modalType = MODAL_TYPES.LIBRARY_COLLECTION;
  }
  stores.pageState.showModal({
    type: modalType,
    asset: asset
  });
}

/**
 * Opens a modal for sharing asset.
 * @param {Object} asset - BE asset data
 */
export function share(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.SHARING,
    assetid: asset.uid
  });
}

/**
 * Opens a modal for modifying asset languages and translation strings.
 * @param {Object} asset - BE asset data
 */
export function editLanguages(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.FORM_LANGUAGES,
    asset: asset
  });
}

/**
 * Opens a modal for modifying asset tags (also editable in Details Modal).
 * @param {Object} asset - BE asset data
 */
export function editTags(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.ASSET_TAGS,
    asset: asset
  });
}

/**
 * Opens a modal for replacing an asset using a file.
 * @param {Object} asset - BE asset data
 */
export function replaceForm(asset) {
  stores.pageState.showModal({
    type: MODAL_TYPES.REPLACE_PROJECT,
    asset: asset
  });
}

/**
 * Moves asset to a non-nested collection.
 * @param {string} assetUid
 * @param {string} collectionId
 */
export function moveToCollection(assetUid, collectionId) {
  const collectionUrl = '/collections/' + collectionId + '/';
  actions.resources.updateAsset(
    assetUid,
    {parent: collectionUrl}
  );
}

export default {
  getQuestionDisplayName,
  getAssetIcon,
  modifyDetails,
  share,
  editLanguages,
  editTags,
  replaceForm,
  moveToCollection
};
