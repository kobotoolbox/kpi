import React from 'react';
import {stores} from 'js/stores';
import sessionStore from 'js/components/account/sessionStore';
import permConfig from 'js/components/permissions/permConfig';
import {buildUserUrl} from 'js/utils';
import envStore from 'js/envStore';
import type {
  AssetTypeName,
  AnyRowTypeName,
  QuestionTypeName,
} from 'js/constants';
import assetStore from 'js/assetStore';
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
  SUPPLEMENTAL_DETAILS_PROP,
} from 'js/constants';
import type {
  AssetContent,
  AssetResponse,
  SurveyRow,
  SurveyChoice,
  Permission,
} from 'js/dataInterface';
import {
  getSupplementalTranscriptPath,
  getSupplementalTranslationPath,
} from 'js/components/processing/processingUtils';
import type {LanguageCode} from 'js/components/languages/languagesStore';

/**
 * Removes whitespace from tags. Returns list of cleaned up tags.
 * NOTE: Behavior should match KpiTaggableManager.add()
 */
export function cleanupTags(tags: string[]) {
  return tags.map(function (tag) {
    return tag.trim().replace(/ /g, '-');
  });
}

/**
 * Returns nicer "me" label for your own assets.
 */
export function getAssetOwnerDisplayName(username: string) {
  if (
    sessionStore.currentAccount?.username &&
    sessionStore.currentAccount.username === username
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
  if (asset?.summary?.languages && asset.summary.languages.length >= 1) {
    return asset?.summary?.languages?.join(', ');
  } else {
    return '-';
  }
}

/**
 * Returns `-` for assets without sector and localized label otherwise
 */
export function getSectorDisplayString(asset: AssetResponse): string {
  let output = '-';

  if (asset.settings.sector?.value) {
    /**
     * We don't want to use labels from asset's settings, as these are localized
     * and thus prone to not be true (e.g. creating form in spanish UI language
     * and then switching to french would result in seeing spanish labels)
     */
    const sectorLabel = envStore.getSectorLabel(asset.settings.sector.value);
    if (sectorLabel !== undefined) {
      output = sectorLabel;
    } else {
      output = asset.settings.sector.value;
    }
  }

  return output;
}

export function getCountryDisplayString(asset: AssetResponse): string {
  if (asset.settings.country) {
    /**
     * We don't want to use labels from asset's settings, as these are localized
     * and thus prone to not be true (e.g. creating form in spanish UI language
     * and then switching to french would result in seeing spanish labels)
     */
    const countries = [];
    // https://www.typescriptlang.org/docs/handbook/2/everyday-types.html#working-with-union-types
    if (Array.isArray(asset.settings.country)) {
      for (const country of asset.settings.country) {
        countries.push(envStore.getCountryLabel(country.value));
      }
    } else {
      countries.push(envStore.getCountryLabel(asset.settings.country.value));
    }
    // TODO: improve for RTL?
    // See: https://github.com/kobotoolbox/kpi/issues/3903
    return countries.join(', ');
  } else {
    return '-';
  }
}

interface DisplayNameObj {
  original?: string; // Name typed in by user.
  question?: string; // First question name.
  empty?: string; // Set when no other is available.
  final: string; // original, question or empty name - the one to be displayed.
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
    final: emptyName,
  };

  if (asset.name) {
    output.original = asset.name;
  }
  if (asset?.summary?.labels && asset.summary.labels.length > 0) {
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
  questionOrChoice: SurveyChoice | SurveyRow,
  translationIndex = 0
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
      if (asset?.access_types?.includes(ACCESS_TYPES.subscribed)) {
        return 'k-icon k-icon-folder-subscribed';
      } else if (isAssetPublic(asset.permissions)) {
        return 'k-icon k-icon-folder-public';
      } else if (asset?.access_types?.includes(ACCESS_TYPES.shared)) {
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
    throw new Error(`Unsupported asset type: ${asset.asset_type}.`);
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

export type SurveyFlatPaths = {
  [P in string]: string
};

export function getRowName(row: SurveyChoice | SurveyRow) {
  return row.name || ('$autoname' in row && row.$autoname) || row.$kuid;
}

/**
 * NOTE: this works based on a fact that all questions have unique names.
 * @param includeGroups - wheter to put groups into output
 * @param includeMeta - whether to include meta question types (false on default)
 * Returns object with pairs of quesion names and their full paths
 */
export function getSurveyFlatPaths(
  survey: SurveyRow[],
  includeGroups = false,
  includeMeta = false
): SurveyFlatPaths {
  const output: SurveyFlatPaths = {};
  const openedGroups: string[] = [];

  survey.forEach((row) => {
    const rowName = getRowName(row);
    if (Object.prototype.hasOwnProperty.call(GROUP_TYPES_BEGIN, row.type)) {
      openedGroups.push(rowName);
      if (includeGroups) {
        output[rowName] = openedGroups.join('/');
      }
    } else if (Object.prototype.hasOwnProperty.call(GROUP_TYPES_END, row.type)) {
      openedGroups.pop();
    } else if (
      Object.prototype.hasOwnProperty.call(QUESTION_TYPES, row.type) ||
      row.type === SCORE_ROW_TYPE ||
      row.type === RANK_LEVEL_TYPE ||
      (includeMeta && Object.prototype.hasOwnProperty.call(META_QUESTION_TYPES, row.type))
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

/**
 * An internal helper function for DRY code
 */
function getRowLabelAtIndex(row: SurveyChoice | SurveyRow, index: number) {
  if (Array.isArray(row.label)) {
    return row.label[index] || null;
  } else {
    return row.label || null;
  }
}

/**
 * If a row doesn't have a label it is very possible that this is
 * a complex type of form item (e.g. ranking, matrix) that was constructed
 * as a group and a row by Backend. This function detects if this is the case.
 */
export function isRowSpecialLabelHolder(
  mainRow: SurveyChoice | SurveyRow,
  holderRow: SurveyChoice | SurveyRow
): boolean {
  if (!mainRow || !holderRow || !Object.prototype.hasOwnProperty.call(holderRow, 'label')) {
    return false;
  } else {
    const mainRowName = getRowName(mainRow);
    const holderRowName = getRowName(holderRow);
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
 * @param rowName - could be either a survey row name or choices row name
 * @param data - is either a survey or choices
 * Returns null for not found
 */
export function getTranslatedRowLabel(
  rowName: string,
  data: SurveyChoice[] | SurveyRow[] | undefined,
  translationIndex: number
): string | null {
  let foundRowIndex: number | undefined;
  let foundRow: SurveyChoice | SurveyRow | undefined;

  if (data === undefined) {
    return null;
  }

  data.forEach((row, rowIndex) => {
    if (getRowName(row) === rowName) {
      foundRow = row;
      foundRowIndex = rowIndex;
    }
  });

  if (typeof foundRow === 'object' && Object.prototype.hasOwnProperty.call(foundRow, 'label')) {
    return getRowLabelAtIndex(foundRow, translationIndex);
  } else if (typeof foundRow === 'object' && typeof foundRowIndex === 'number') {
    // that mysterious row always comes as a next row
    const possibleRow = data[foundRowIndex + 1];
    if (isRowSpecialLabelHolder(foundRow, possibleRow)) {
      return getRowLabelAtIndex(possibleRow, translationIndex);
    }
  }

  return null;
}

export function findRow(assetContent: AssetContent, rowName: string) {
  return assetContent?.survey?.find((row) => getRowName(row) === rowName);
}

export function findRowByQpath(assetContent: AssetContent, qpath: string) {
  return assetContent?.survey?.find((row) => row.$qpath === qpath);
}

export function getRowType(assetContent: AssetContent, rowName: string) {
  const foundRow = findRow(assetContent, rowName);
  return foundRow?.type;
}

export function getRowNameByQpath(assetContent: AssetContent, qpath: string) {
  const foundRow = findRowByQpath(assetContent, qpath);
  if (foundRow) {
    return getRowName(foundRow);
  }
  return undefined;
}

export function getRowTypeIcon(rowType: AnyRowTypeName | undefined) {
  if (rowType === SCORE_ROW_TYPE) {
    return QUESTION_TYPES.score.icon;
  } else if (rowType === RANK_LEVEL_TYPE) {
    return QUESTION_TYPES.rank.icon;
  } else if (rowType && Object.prototype.hasOwnProperty.call(QUESTION_TYPES, rowType)) {
    // We need to cast with `as` operator to avoid typescript complaining that
    // we can't use AnyRowTypeName as index for QuestionTypes.
    const rowTypeAsQuestionType = rowType as QuestionTypeName;
    return QUESTION_TYPES[rowTypeAsQuestionType].icon;
  }

  if (rowType === META_QUESTION_TYPES['background-audio']) {
    return 'background-rec';
  } else if (rowType && Object.prototype.hasOwnProperty.call(META_QUESTION_TYPES, rowType)) {
    return 'qt-meta-default';
  }

  return undefined;
}

export function renderQuestionTypeIcon(
  rowType: AnyRowTypeName
): React.DetailedReactHTMLElement<{}, HTMLElement> | null {
  const rowTypeIcon = getRowTypeIcon(rowType);
  if (rowTypeIcon) {
    // TODO: use Icon component here, but please check out all usages first.
    // Also make sure the icon size is right.
    // It should be done while working on https://github.com/kobotoolbox/kpi/issues/3571
    return React.createElement(
      'i',
      {
        className: `k-icon k-icon-${rowTypeIcon}`,
        title: rowType,
      }
    );
  } else {
    return null;
  }
}

/**
 * This returns a list of paths for all applicable question names - we do it
 * this way to make it easier to connect the paths to the source question.
 */
export function getSupplementalDetailsPaths(asset: AssetResponse): {
  [questionName: string]: string[];
} {
  const paths: {[questionName: string]: string[]} = {};
  const advancedFeatures = asset.advanced_features;

  advancedFeatures.transcript?.values?.forEach((questionName: string) => {
    if (!Array.isArray(paths[questionName])) {
      paths[questionName] = [];
    }
    // NOTE: the values for transcripts are not nested in submission, but we
    // need the path to contain language for other parts of code to work.
    advancedFeatures.transcript?.languages?.forEach((languageCode: LanguageCode) => {
      paths[questionName].push(
        getSupplementalTranscriptPath(questionName, languageCode)
      );
    });
  });

  advancedFeatures.translation?.values?.forEach((questionName: string) => {
    if (!Array.isArray(paths[questionName])) {
      paths[questionName] = [];
    }
    advancedFeatures.translation?.languages?.forEach((languageCode: LanguageCode) => {
      paths[questionName].push(
        getSupplementalTranslationPath(questionName, languageCode)
      );
    });
  });

  return paths;
}

/**
 * Injects supplemental details columns next to (immediately after) their
 * matching rows in a given list of rows.
 *
 * NOTE: it returns a new updated `rows` list.
 */
export function injectSupplementalRowsIntoListOfRows(
  asset: AssetResponse,
  rows: string[],
) {
  if (asset.content?.survey === undefined) {
    throw new Error('Asset has no content');
  }

  let output = Array.from(rows);

  // First filter out the SUPPLEMENTAL_DETAILS_PROP as it bears no data
  output = output.filter((key) => key !== SUPPLEMENTAL_DETAILS_PROP);

  const supplementalDetailsPaths = getSupplementalDetailsPaths(asset);

  const { analysis_form_json } = asset;
  const additional_fields: any = analysis_form_json.additional_fields;

  const extraColsBySource: Record<string, any[]> = {};
  additional_fields.forEach((add_field: any) => {
    let sourceName: string = add_field.source;
    if (!extraColsBySource[sourceName]) {
      extraColsBySource[sourceName] = [];
    }
    extraColsBySource[sourceName].push(add_field);
  });

  const outputWithCols: string[] = [];
  output.forEach((col: string) => {
    let qpath = col.replace(/\//g, '-')
    outputWithCols.push(col);
    (extraColsBySource[qpath] || []).forEach((assetAddlField) => {
      outputWithCols.push(`_supplementalDetails/${assetAddlField.dtpath}`)
    });
  });

  /*
  revisit this before merge: (does this work with longer paths / within groups?)

  Object.keys(supplementalDetailsPaths).forEach((rowName) => {
    // In supplementalDetailsPaths we get row names, in output we already have
    // row paths. We need to find a matching row and put all paths immediately
    // after it.
    const rowPath = flatPathsWithGroups[rowName];
    const sourceRowIndex = output.indexOf(rowPath);
    if (sourceRowIndex !== -1) {
      output.splice(sourceRowIndex + 1, 0, ...supplementalDetailsPaths[rowName]);
    }
  });
  */
  return outputWithCols;
}

export interface FlatQuestion {
  type: AnyRowTypeName;
  name: string;
  isRequired: boolean;
  label: string;
  path: string;
  parents: string[];
  parentRows: SurveyRow[];
  hasRepeatParent: boolean;
}

/**
 * Use this to get a nice parsed list of survey questions (optionally with meta
 * questions included). Useful when you need to render form questions to users.
 */
export function getFlatQuestionsList(
  survey: SurveyRow[],
  /** Defaults to first (default) language. */
  translationIndex = 0,
  /** Whether to include meta question types (not included by default). */
  includeMeta = false
): FlatQuestion[] {
  const flatPaths = getSurveyFlatPaths(survey, false, true);
  const output: FlatQuestion[] = [];
  const openedGroups: SurveyRow[] = [];
  let openedRepeatGroupsCount = 0;

  survey.forEach((row) => {
    if (row.type === 'begin_group' || row.type === 'begin_repeat') {
      openedGroups.push(row);
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
      Object.prototype.hasOwnProperty.call(QUESTION_TYPES, row.type) ||
      (includeMeta && Object.prototype.hasOwnProperty.call(META_QUESTION_TYPES, row.type))
    ) {
      const rowName = getRowName(row);
      output.push({
        type: row.type,
        name: rowName,
        isRequired: Boolean(row.required),
        label: getQuestionOrChoiceDisplayName(row, translationIndex),
        path: flatPaths[rowName],
        parents: openedGroups
          .slice(0)
          .map((group) =>
            getQuestionOrChoiceDisplayName(group, translationIndex)
          ),
        parentRows: openedGroups.slice(0),
        hasRepeatParent: openedRepeatGroupsCount >= 1,
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

export function isSelfOwned(asset: AssetResponse) {
  return (
    asset &&
    sessionStore.currentAccount &&
    asset.owner__username === sessionStore.currentAccount.username
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
  const regex = /((?:[\0-\x08\x0B\f\x0E-\x1F\uFFFD\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?:[^\uD800-\uDBFF]|^)[\uDC00-\uDFFF]))/g;
  return str = String(str || '').replace(regex, '');
}

export function getAssetAdvancedFeatures(assetUid: string) {
  const foundAsset = assetStore.getAsset(assetUid);
  if (foundAsset) {
    return foundAsset.advanced_features;
  }
  return undefined;
}

export function getAssetProcessingUrl(assetUid: string): string | undefined {
  const foundAsset = assetStore.getAsset(assetUid);
  if (foundAsset) {
    return foundAsset.advanced_submission_schema.url;
  }
  return undefined;
}

/** Returns a list of all rows (their `qpath`s) activated for advanced features. */
export function getAssetProcessingRows(assetUid: string) {
  const foundAsset = assetStore.getAsset(assetUid);
  if (foundAsset?.advanced_submission_schema.properties) {
    const rows: string[] = [];
    Object.keys(foundAsset.advanced_submission_schema.properties).forEach((propertyName) => {
      if (foundAsset.advanced_submission_schema.properties !== undefined) {
        const propertyObj = foundAsset.advanced_submission_schema.properties[propertyName];
        // NOTE: we assume that the properties will hold only a special string
        // "submission" property and one object property for each
        // processing-enabled row.
        if (propertyObj.type === 'object') {
          rows.push(propertyName);
        }
      }
    });
    return rows;
  }
  return undefined;
}

export function isRowProcessingEnabled(assetUid: string, qpath: string) {
  const processingRows = getAssetProcessingRows(assetUid);
  return Array.isArray(processingRows) && processingRows.includes(qpath);
}

export function isAssetProcessingActivated(assetUid: string) {
  return getAssetProcessingUrl(assetUid) !== undefined;
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
  getAssetAdvancedFeatures,
  getAssetProcessingUrl,
  getAssetProcessingRows,
  isRowProcessingEnabled,
  isAssetProcessingActivated,
};
