import React from 'react'
import {AssetTypeName} from 'js/constants'
import {stores} from 'js/stores'
import permConfig from 'js/components/permissions/permConfig'
import {buildUserUrl} from 'js/utils'
import envStore from 'js/envStore'
import {
  ASSET_TYPES,
  MODAL_TYPES,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
  ANON_USERNAME,
  PERMISSIONS_CODENAMES,
  ACCESS_TYPES,
  ROOT_URL,
  AnyRowTypeName,
  QuestionTypeName,
} from 'js/constants';

/**
 * Removes whitespace from tags. Returns list of cleaned up tags.
 * NOTE: Behavior should match KpiTaggableManager.add()
 */
export function cleanupTags(tags: string[]) {
  return tags.map(function(tag) {
    return tag.trim().replace(/ /g, '-');
  });
}

/**
 * Returns nicer "me" label for your own assets.
 */
export function getAssetOwnerDisplayName(username: string) {
  if (
    stores.session.currentAccount &&
    stores.session.currentAccount.username &&
    stores.session.currentAccount.username === username
  ) {
    return t('me');
  } else {
    return username;
  }
}

export function getOrganizationDisplayString(asset: AssetResponse) {
  if (asset.settings.organization) {
    return asset.settings.organization;
  } else {
    return '-';
  }
}

/**
 * Note: `langString` is language string (the de facto "id").
 * Returns the index of language or null if not found.
 */
export function getLanguageIndex(asset: AssetResponse, langString: string) {
  let foundIndex = null;

  if (
    Array.isArray(asset.summary?.languages) &&
    asset.summary?.languages.length >= 1
  ) {
    asset.summary.languages.forEach((language, index) => {
      if (language === langString) {
        foundIndex = index;
      }
    });
  }

  return foundIndex;
}

export function getLanguagesDisplayString(asset: AssetResponse) {
  if (
    asset.summary &&
    asset.summary.languages &&
    asset.summary.languages.length >= 1
  ) {
    return asset.summary.languages.join(', ');
  } else {
    return '-';
  }
}

/**
 * Returns `-` for assets without sector and localized label otherwise
 */
export function getSectorDisplayString(asset: AssetResponse): string {
  let output = '-'

  if (asset.settings.sector?.value) {
    /**
     * We don't want to use labels from asset's settings, as these are localized
     * and thus prone to not be true (e.g. creating form in spanish UI language
     * and then switching to french would result in seeing spanish labels)
     */
    const sectorLabel = envStore.getSectorLabel(asset.settings.sector.value)
    if (sectorLabel !== undefined) {
      output = sectorLabel
    } else {
      output = asset.settings.sector.value
    }
  }

  return output
}

export function getCountryDisplayString(asset: AssetResponse): string {
  if (asset.settings.country) {
    /**
     * We don't want to use labels from asset's settings, as these are localized
     * and thus prone to not be true (e.g. creating form in spanish UI language
     * and then switching to french would result in seeing spanish labels)
     */
    let countries = [];
    // https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#working-with-union-types
    if (Array.isArray(asset.settings.country)) {
      for (let country of asset.settings.country) {
        countries.push(envStore.getCountryLabel(country.value));
      }
    } else {
      countries.push(envStore.getCountryLabel(asset.settings.country.value));
    }
    // TODO: improve for RTL?
    return countries.join(', ');
  } else {
    return '-';
  }
}

interface DisplayNameObj {
  original?: string // Name typed in by user.
  question?: string // First question name.
  empty?: string // Set when no other is available.
  final: string // original, question or empty name - the one to be displayed.
}

/**
 * Returns a name to be displayed for asset (especially unnamed ones) - an object
 * containing final name and all useful data. Most of the times you should use
 * `getAssetDisplayName(…).final`.
 */
export function getAssetDisplayName(asset: AssetResponse): DisplayNameObj {
  const emptyName = t('untitled');

  const output: DisplayNameObj = {
    // empty name is a fallback
    final: emptyName
  };

  if (asset.name) {
    output.original = asset.name;
  }
  if (asset.summary && asset.summary.labels && asset.summary.labels.length > 0) {
    // for unnamed assets, we try to display first question name
    output.question = asset.summary.labels[0];
  }
  if (!output.original && !output.question) {
    output.empty = emptyName;
  }

  // We prefer original name over question name
  if (output.original) {
    output.final = output.original;
  } else if (output.question) {
    output.final = output.question;
  }

  return output;
}

/**
 * Returns usable name of the question or choice when possible, fallbacks to
 * "Unlabelled". `translationIndex` defaults to first (default) language.
 */
export function getQuestionOrChoiceDisplayName(
  questionOrChoice: SurveyRow | SurveyChoice,
  translationIndex: number = 0
): string {
  if (questionOrChoice.label && Array.isArray(questionOrChoice.label)) {
    return questionOrChoice.label[translationIndex];
  } else if (questionOrChoice.label && !Array.isArray(questionOrChoice.label)) {
    // in rare cases the label could be a string
    return questionOrChoice.label;
  } else if (questionOrChoice.name) {
    return questionOrChoice.name;
  // the "string in obj" is needed because choice type doesn't have $autoname
  } else if ('$autoname' in questionOrChoice && questionOrChoice.$autoname) {
    return questionOrChoice.$autoname;
  } else {
    return t('Unlabelled');
  }
}

export function isLibraryAsset(assetType: AssetTypeName) {
  return (
    assetType === ASSET_TYPES.question.id ||
    assetType === ASSET_TYPES.block.id ||
    assetType === ASSET_TYPES.template.id ||
    assetType === ASSET_TYPES.collection.id
  );
}

/**
 * For getting the icon class name for given asset type. Returned string always
 * contains two class names: base `k-icon` and respective CSS class name.
 */
export function getAssetIcon(asset: AssetResponse) {
  switch (asset.asset_type) {
    case ASSET_TYPES.template.id:
      if (asset.summary?.lock_any) {
        return 'k-icon k-icon-template-locked';
      } else {
        return 'k-icon k-icon-template';
      }
    case ASSET_TYPES.question.id:
      return 'k-icon k-icon-question';
    case ASSET_TYPES.block.id:
      return 'k-icon k-icon-block';
    case ASSET_TYPES.survey.id:
      if (asset.summary?.lock_any) {
        return 'k-icon k-icon-project-locked';
      } else if (asset.has_deployment && !asset.deployment__active) {
        return 'k-icon k-icon-project-archived';
      } else if (asset.has_deployment) {
        return 'k-icon k-icon-project-deployed';
      } else {
        return 'k-icon k-icon-project-draft';
      }
    case ASSET_TYPES.collection.id:
      if (asset.access_types && asset.access_types.includes(ACCESS_TYPES.subscribed)) {
        return 'k-icon k-icon-folder-subscribed';
      } else if (isAssetPublic(asset.permissions)) {
        return 'k-icon k-icon-folder-public';
      } else if (asset.access_types && asset.access_types.includes(ACCESS_TYPES.shared)) {
        return 'k-icon k-icon-folder-shared';
      } else {
        return 'k-icon k-icon-folder';
      }
    default:
      return 'k-icon k-icon-project';
  }
}

/**
 * Opens a modal for editing asset details.
 */
export function modifyDetails(asset: AssetResponse) {
  let modalType;
  if (asset.asset_type === ASSET_TYPES.template.id) {
    modalType = MODAL_TYPES.LIBRARY_TEMPLATE;
  } else if (asset.asset_type === ASSET_TYPES.collection.id) {
    modalType = MODAL_TYPES.LIBRARY_COLLECTION;
  }
  if (modalType) {
    stores.pageState.showModal({
      type: modalType,
      asset: asset,
    });
  } else {
    throw new Error(`Unsupported asset type: ${asset.asset_type}.`)
  }
}

/**
 * Opens a modal for sharing asset.
 */
export function share(asset: AssetResponse) {
  stores.pageState.showModal({
    type: MODAL_TYPES.SHARING,
    assetid: asset.uid,
  });
}

/**
 * Opens a modal for modifying asset languages and translation strings.
 */
export function editLanguages(asset: AssetResponse) {
  stores.pageState.showModal({
    type: MODAL_TYPES.FORM_LANGUAGES,
    asset: asset,
  });
}

/**
 * Opens a modal for modifying asset tags (also editable in Details Modal).
 */
export function editTags(asset: AssetResponse) {
  stores.pageState.showModal({
    type: MODAL_TYPES.ASSET_TAGS,
    asset: asset,
  });
}

/**
 * Opens a modal for replacing an asset using a file.
 */
export function replaceForm(asset: AssetResponse) {
  stores.pageState.showModal({
    type: MODAL_TYPES.REPLACE_PROJECT,
    asset: asset,
  });
}

type SurveyFlatPaths = {
  [P in string]: string
}

/**
 * NOTE: this works based on a fact that all questions have unique names.
 * @param includeGroups - wheter to put groups into output
 * @param includeMeta - whether to include meta question types (false on default)
 * Returns object with pairs of quesion names and their full paths
 */
export function getSurveyFlatPaths(
  survey: SurveyRow[],
  includeGroups: boolean = false,
  includeMeta: boolean = false
): SurveyFlatPaths {
  const output: SurveyFlatPaths = {};
  const openedGroups: string[] = [];

  survey.forEach((row) => {
    const rowName = getRowName(row);
    if (GROUP_TYPES_BEGIN.hasOwnProperty(row.type)) {
      openedGroups.push(rowName);
      if (includeGroups) {
        output[rowName] = openedGroups.join('/');
      }
    } else if (GROUP_TYPES_END.hasOwnProperty(row.type)) {
      openedGroups.pop();
    } else if (
      QUESTION_TYPES.hasOwnProperty(row.type) ||
      row.type === SCORE_ROW_TYPE ||
      row.type === RANK_LEVEL_TYPE ||
      (includeMeta && META_QUESTION_TYPES.hasOwnProperty(row.type))
    ) {
      let groupsPath = '';
      if (openedGroups.length >= 1) {
        groupsPath = openedGroups.join('/') + '/';
      }
      output[rowName] = `${groupsPath}${rowName}`;
    }
  });

  return output;
}

export function getRowName(row: SurveyRow | SurveyChoice) {
  return row.name || ('$autoname' in row && row.$autoname) || row.$kuid;
}

/**
 * @param rowName - could be either a survey row name or choices row name
 * @param data - is either a survey or choices
 * Returns null for not found
 */
export function getTranslatedRowLabel(
  rowName: string,
  data: SurveyRow[] | SurveyChoice[],
  translationIndex: number
): string | null {
  let foundRowIndex: number | undefined;
  let foundRow: SurveyRow | SurveyChoice | undefined;

  data.forEach((row, rowIndex) => {
    if (getRowName(row) === rowName) {
      foundRow = row;
      foundRowIndex = rowIndex;
    }
  });

  if (typeof foundRow === 'object' && foundRow.hasOwnProperty('label')) {
    return getRowLabelAtIndex(foundRow, translationIndex);
  } else if (typeof foundRow === 'object' && typeof foundRowIndex === 'number') {
    // that mysterious row always comes as a next row
    let possibleRow = data[foundRowIndex + 1];
    if (isRowSpecialLabelHolder(foundRow, possibleRow)) {
      return getRowLabelAtIndex(possibleRow, translationIndex);
    }
  }

  return null;
}

/**
 * If a row doesn't have a label it is very possible that this is
 * a complex type of form item (e.g. ranking, matrix) that was constructed
 * as a group and a row by Backend. This function detects if this is the case.
 */
export function isRowSpecialLabelHolder(
  mainRow: SurveyRow | SurveyChoice,
  holderRow: SurveyRow | SurveyChoice
): boolean {
  if (!mainRow || !holderRow || !Object.prototype.hasOwnProperty.call(holderRow, 'label')) {
    return false;
  } else {
    let mainRowName = getRowName(mainRow);
    let holderRowName = getRowName(holderRow);
    return (
      (
        // this handles ranking questions
        'type' in holderRow &&
        holderRowName === `${mainRowName}_label` &&
        holderRow.type === QUESTION_TYPES.note.id
      ) ||
      (
        // this handles matrix questions (partially)
        'type' in holderRow &&
        holderRowName === `${mainRowName}_note` &&
        holderRow.type === QUESTION_TYPES.note.id
      ) ||
      (
        // this handles rating questions
        'type' in holderRow &&
        holderRowName === `${mainRowName}_header` &&
        holderRow.type === QUESTION_TYPES.select_one.id // rating
      )
    );
  }
}

/**
 * An internal helper function for DRY code
 */
function getRowLabelAtIndex(
  row: SurveyRow | SurveyChoice,
  index: number
): string | null {
  if (Array.isArray(row.label)) {
    return row.label[index] || null;
  } else {
    return row.label || null;
  }
}

export function renderQuestionTypeIcon(
  rowType: AnyRowTypeName
): React.DetailedReactHTMLElement<{}, HTMLElement> | null {
  let iconClassName: string = '';

  if (rowType === SCORE_ROW_TYPE) {
    iconClassName = QUESTION_TYPES.score.icon;
  } else if (rowType === RANK_LEVEL_TYPE) {
    iconClassName = QUESTION_TYPES.rank.icon;
  } else if (QUESTION_TYPES.hasOwnProperty(rowType)) {
    // We need to cast with `as` operator to avoid typescript complaining that
    // we can't use AnyRowTypeName as index for QuestionTypes.
    const rowTypeAsQuestionType = rowType as QuestionTypeName;
    iconClassName = QUESTION_TYPES[rowTypeAsQuestionType].icon;
  }

  if (rowType === META_QUESTION_TYPES['background-audio']) {
    iconClassName = 'k-icon-background-rec';
  } else if (META_QUESTION_TYPES.hasOwnProperty(rowType)) {
    iconClassName = 'qt-meta-default';
  }

  if (iconClassName) {
    return React.createElement(
      'i',
      {
        className: `k-icon k-icon-${iconClassName}`,
        title: rowType
      }
    );
  } else {
    return null;
  }
}

interface FlatQuestion {
  type: AnyRowTypeName
  name: string
  isRequired: boolean
  label: string
  path: string
  parents: string[]
  hasRepatParent: boolean
}

/**
 * Use this to get a nice parsed list of survey questions (optionally with meta
 * questions included). Useful when you need to render form questions to users.
 *
 * @param {Object} survey
 * @param {number} [translationIndex] - defaults to first (default) language
 * @param {boolean} [includeMeta] - whether to include meta question types (false on default)
 * @returns {Array<object>} a list of parsed questions
 */
export function getFlatQuestionsList(
  survey: SurveyRow[],
  translationIndex: number = 0,
  includeMeta: boolean = false
): FlatQuestion[] {
  const flatPaths = getSurveyFlatPaths(survey, false, true);
  const output: FlatQuestion[] = [];
  const openedGroups: string[] = [];
  let openedRepeatGroupsCount = 0;

  survey.forEach((row) => {
    if (row.type === 'begin_group' || row.type === 'begin_repeat') {
      openedGroups.push(getQuestionOrChoiceDisplayName(row, translationIndex));
    }
    if (row.type === 'end_group' || row.type === 'end_repeat') {
      openedGroups.pop();
    }

    if (row.type === 'begin_repeat') {
      openedRepeatGroupsCount++;
    } else if (row.type === 'end_repeat') {
      openedRepeatGroupsCount--;
    }

    if (
      QUESTION_TYPES.hasOwnProperty(row.type) ||
      (includeMeta && META_QUESTION_TYPES.hasOwnProperty(row.type))
    ) {
      const rowName = getRowName(row);
      output.push({
        type: row.type,
        name: rowName,
        isRequired: Boolean(row.required),
        label: getQuestionOrChoiceDisplayName(row, translationIndex),
        path: flatPaths[rowName],
        parents: openedGroups.slice(0),
        hasRepatParent: openedRepeatGroupsCount >= 1,
      });
    }
  });

  return output;
}

/**
 * Validates asset data to see if ready to be made public.
 * NOTE: currently we assume the asset type is `collection`.
 *
 * Returns an array of errors (empty array means no errors)
 */
export function isAssetPublicReady(asset: AssetResponse): string[] {
  const errors = [];

  if (asset.asset_type === ASSET_TYPES.collection.id) {
    if (!asset.name || !asset.settings.organization || !asset.settings.sector) {
      errors.push(t('Name, organization and sector are required to make collection public.'));
    }
    if (asset.children.count === 0) {
      errors.push(t('Empty collection is not allowed to be made public.'));
    }
  } else {
    errors.push(t('Only collections are allowed to be made public!'));
  }

  return errors;
}

/**
 * Checks whether the asset is public - i.e. visible and discoverable by anyone.
 * Note that `view_asset` is implied when you have `discover_asset`.
 */
export function isAssetPublic(permissions: Permission[]) {
  let isDiscoverableByAnonymous = false;
  permissions.forEach((perm) => {
    const foundPerm = permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.discover_asset);
    if (
      perm.user === buildUserUrl(ANON_USERNAME) &&
      foundPerm !== undefined &&
      perm.permission === foundPerm.url
    ) {
      isDiscoverableByAnonymous = true;
    }
  });
  return isDiscoverableByAnonymous;
}

export function isSelfOwned(asset: AssetResponse) {
  return (
    asset &&
    stores.session.currentAccount &&
    asset.owner__username === stores.session.currentAccount.username
  );
}

export function buildAssetUrl(assetUid: string) {
  return `${ROOT_URL}/api/v2/assets/${assetUid}/`;
}

/*
* Inspired by https://gist.github.com/john-doherty/b9195065884cdbfd2017a4756e6409cc
* Remove everything forbidden by XML 1.0 specifications, plus the unicode replacement character U+FFFD
* @param {string} str
*/
export function removeInvalidChars(str: string) {
  var regex = /((?:[\0-\x08\x0B\f\x0E-\x1F\uFFFD\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))/g;
  return str = String(str || '').replace(regex, '');
}

export default {
  buildAssetUrl,
  cleanupTags,
  editLanguages,
  editTags,
  getAssetDisplayName,
  getAssetIcon,
  getAssetOwnerDisplayName,
  getCountryDisplayString,
  getFlatQuestionsList,
  getLanguageIndex,
  getLanguagesDisplayString,
  getOrganizationDisplayString,
  getQuestionOrChoiceDisplayName,
  getRowName,
  getSectorDisplayString,
  getSurveyFlatPaths,
  getTranslatedRowLabel,
  isAssetPublic,
  isAssetPublicReady,
  isLibraryAsset,
  isRowSpecialLabelHolder,
  isSelfOwned,
  modifyDetails,
  renderQuestionTypeIcon,
  replaceForm,
  share,
  removeInvalidChars,
};
