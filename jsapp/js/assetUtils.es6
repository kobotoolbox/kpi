import {actions} from './actions';
import {
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END
} from 'js/constants';

/**
 * @param {object} survey - from asset's `content.survey`
 * @returns {object} a pair of quesion names and their full paths
 */
export function getSurveyFlatPaths(survey) {
  const output = {};
  const openedGroups = [];

  survey.forEach((row) => {
    if ([GROUP_TYPES_BEGIN.get('begin_group'), GROUP_TYPES_BEGIN.get('begin_repeat')].includes(row.type)) {
      openedGroups.push(row.name || row.$autoname);
    }
    if ([GROUP_TYPES_END.get('end_group'), GROUP_TYPES_END.get('end_repeat')].includes(row.type)) {
      openedGroups.pop();
    }

    if (QUESTION_TYPES.has(row.type)) {
      const rowName = row.name || row.$autoname;
      let groupsPath = '';
      if (openedGroups.length >= 1) {
        groupsPath = openedGroups.join('/') + '/';
      }

      output[rowName] = `${groupsPath}${rowName}`;
    }
  });

  return output;
}

/**
 * Moves asset to a non-nested collection.
 * @param {string} assetUid
 * @param {string} collectionId
 */
export function moveToCollection(assetUid, collectionId) {
  actions.resources.updateAsset(
    assetUid,
    {parent: `/api/v2/collections/${collectionId}/`}
  );
}

export default {
  getSurveyFlatPaths,
  moveToCollection
};
