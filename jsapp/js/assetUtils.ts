/**
 * This file contains different methods for filtering and understanding asset's
 * data. Most of these are helpers for rendering information in UI.
 */

import React from 'react';
import permConfig from 'js/components/permissions/permConfig';
import {ANON_USERNAME_URL} from 'js/users/utils';
import envStore from 'js/envStore';
import sessionStore from 'js/stores/session';
import type {
  AssetTypeName,
  AnyRowTypeName,
  QuestionTypeName,
} from 'js/constants';
import assetStore from 'js/assetStore';
import {
  ASSET_TYPES,
  QUESTION_TYPES,
  META_QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
  ACCESS_TYPES,
  ROOT_URL,
  SUPPLEMENTAL_DETAILS_PROP,
  XML_VALUES_OPTION_VALUE,
} from 'js/constants';
import {PERMISSIONS_CODENAMES} from 'js/components/permissions/permConstants';
import type {
  AssetContent,
  AssetResponse,
  ProjectViewAsset,
  SurveyRow,
  SurveyChoice,
  PermissionResponse,
  AnalysisFormJsonField,
} from 'js/dataInterface';
import type {IconName} from 'jsapp/fonts/k-icons';
import {QUAL_NOTE_TYPE} from 'js/components/processing/analysis/constants';

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

export function getOrganizationDisplayString(asset: AssetResponse | ProjectViewAsset) {
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
  // Return -1 instead of null as that would allow
  // `getQuestionOrChoiceDisplayName` to default to xml names.
  if (langString === XML_VALUES_OPTION_VALUE) {
    return -1;
  }

  let foundIndex = 0;

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

export function getLanguagesDisplayString(asset: AssetResponse | ProjectViewAsset) {
  if (
    asset &&
    'summary' in asset &&
    asset.summary.languages &&
    asset.summary.languages.length > 0
  ) {
    return asset?.summary?.languages?.join(', ');
  } else if (
    asset &&
    'languages' in asset &&
    asset.languages.length > 0
  ) {
    return asset.languages.join(', ');
  } else {
    return '-';
  }
}

/**
 * Returns `-` for assets without sector and localized label otherwise
 */
export function getSectorDisplayString(asset: AssetResponse | ProjectViewAsset): string {
  let output = '-';

  if (asset.settings.sector && 'value' in asset.settings.sector) {
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

export function getCountryDisplayString(asset: AssetResponse | ProjectViewAsset): string {
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

    if (countries.length === 0) {
      return '-';
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
export function getAssetDisplayName(asset?: AssetResponse | ProjectViewAsset): DisplayNameObj {
  const emptyName = t('untitled');

  const output: DisplayNameObj = {
    // empty name is a fallback
    final: emptyName,
  };

  if (asset?.name) {
    output.original = asset.name;
  }
  if (
    asset &&
    'summary' in asset &&
    asset.summary.labels &&
    asset.summary.labels.length > 0
  ) {
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
 *
 * TODO: see how does this function output differs from `getTranslatedRowLabel`
 */
export function getQuestionOrChoiceDisplayName(
  questionOrChoice: SurveyChoice | SurveyRow,
  translationIndex = 0
): string {
  // The `translationIndex` is set to `-1` when user chooses to display xml
  // values instead of labels
  if (translationIndex === -1) {
    return getRowName(questionOrChoice);
  }

  if (questionOrChoice.label && Array.isArray(questionOrChoice.label)) {
    // If the user hasn't made translations yet for a form language show
    // the xml names instead of blank.
    if (questionOrChoice.label[translationIndex] === null) {
      return getRowName(questionOrChoice);
    }
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
export function isAssetPublic(permissions?: PermissionResponse[]) {
  let isDiscoverableByAnonymous = false;
  permissions?.forEach((perm) => {
    const foundPerm = permConfig.getPermissionByCodename(PERMISSIONS_CODENAMES.discover_asset);
    if (
      perm.user === ANON_USERNAME_URL &&
      foundPerm !== undefined &&
      perm.permission === foundPerm.url
    ) {
      isDiscoverableByAnonymous = true;
    }
  });
  return isDiscoverableByAnonymous;
}

/**
 * For getting the icon name for given asset type. Recommended to be used with
 * the `<Icon>` component.
 */
export function getAssetIcon(asset: AssetResponse): IconName {
  switch (asset.asset_type) {
    case ASSET_TYPES.template.id:
      if ('summary' in asset && asset.summary?.lock_any) {
        return 'template-locked';
      } else {
        return 'template';
      }
    case ASSET_TYPES.question.id:
      return 'question';
    case ASSET_TYPES.block.id:
      return 'block';
    case ASSET_TYPES.survey.id:
      if ('summary' in asset && asset.summary?.lock_any) {
        return 'project-locked';
      } else if (asset.deployment_status === 'archived') {
        return 'project-archived';
      } else if (asset.deployment_status === 'deployed') {
        return 'project-deployed';
      } else {
        return 'project-draft';
      }
    case ASSET_TYPES.collection.id:
      if ('access_types' in asset && asset?.access_types?.includes(ACCESS_TYPES.subscribed)) {
        return 'folder-subscribed';
      } else if (isAssetPublic(asset.permissions)) {
        return 'folder-public';
      } else if (asset?.access_types?.includes(ACCESS_TYPES.shared)) {
        return 'folder-shared';
      } else {
        return 'folder';
      }
    default:
      return 'project';
  }
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
 *
 * TODO: see how does this function output differs from `getQuestionOrChoiceDisplayName`
 */
export function getTranslatedRowLabel(
  rowName: string,
  data: SurveyChoice[] | SurveyRow[] | undefined,
  translationIndex: number
): string | null {
  let foundRowIndex: number | undefined;
  let foundRow: SurveyChoice | SurveyRow | undefined;

  // Background audio questions don't have labels, but we need something to be
  // displayed to users. If translation we want is `-1`, it means we want to
  // display xml name.
  if (
    translationIndex !== -1 &&
    rowName === QUESTION_TYPES['background-audio'].id
  ) {
    return t('Background audio');
  }

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

export function findRowByXpath(assetContent: AssetContent, xpath: string) {
  return assetContent?.survey?.find((row) => row.$xpath === xpath);
}

export function getRowType(assetContent: AssetContent, rowName: string) {
  const foundRow = findRow(assetContent, rowName);
  return foundRow?.type;
}

export function getRowNameByXpath(assetContent: AssetContent, xpath: string) {
  const foundRow = findRowByXpath(assetContent, xpath);
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

  if (rowType && Object.prototype.hasOwnProperty.call(META_QUESTION_TYPES, rowType)) {
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
 * Injects supplemental details columns next to their respective source rows in
 * a given list of rows. Returns a new updated `rows` list.
 *
 * Note: we omit injecting `qual_note` questions.
 */
export function injectSupplementalRowsIntoListOfRows(
  asset: AssetResponse,
  rows: Set<string> | Array<string>,
) {
  if (asset.content?.survey === undefined) {
    throw new Error('Asset has no content');
  }

  // Step 1: clone the list
  let output = Array.from(rows);

  // Step 2: filter out the SUPPLEMENTAL_DETAILS_PROP as it bears no data
  output = output.filter((key) => key !== SUPPLEMENTAL_DETAILS_PROP);

  // Step 3: use the list of additional columns (with data), that was generated
  // on Back end, to build a list of columns grouped by source question
  const additionalFields = asset.analysis_form_json?.additional_fields || [];
  const extraColsBySource: Record<string, AnalysisFormJsonField[]> = {};
  additionalFields.forEach((field: AnalysisFormJsonField) => {
    // Note questions make sense only in the context of writing responses to
    // Qualitative Analysis questions. They bear no data, so there is no point
    // displaying them outside of Single Processing route. As this function is
    // part of Data Table and Data Downloads, we need to hide the notes.
    if (field.type === QUAL_NOTE_TYPE) {
      return;
    }

    const sourceName: string = field.source;
    if (!extraColsBySource[sourceName]) {
      extraColsBySource[sourceName] = [];
    }
    extraColsBySource[sourceName].push(field);
  });

  // Step 4: Inject all the extra columns immediately after source question
  const outputWithCols: string[] = [];
  output.forEach((col: string) => {
    outputWithCols.push(col);
    (extraColsBySource[col] || []).forEach((extraCol) => {
      outputWithCols.push(`_supplementalDetails/${extraCol.dtpath}`);
    });
  });

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

export function isSelfOwned(asset: AssetResponse | ProjectViewAsset) {
  return (
    asset &&
    sessionStore.currentAccount &&
    asset.owner_label === sessionStore.currentAccount.username
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

// This url returns `ProcessingDataResponse`
export function getAssetProcessingUrl(assetUid: string): string | undefined {
  const foundAsset = assetStore.getAsset(assetUid);
  if (foundAsset) {
    return foundAsset.advanced_submission_schema?.url;
  }
  return undefined;
}

// This url returns `SubmissionProcessingDataResponse`
export function getAssetSubmissionProcessingUrl(
  assetUid: string,
  submission: string
) {
  const processingUrl = getAssetProcessingUrl(assetUid);
  if (processingUrl) {
    return processingUrl + '?submission=' + submission;
  }
  return undefined;
}

/** Returns a list of all rows (their `xpath`s) activated for advanced features. */
export function getAssetProcessingRows(assetUid: string) {
  const foundAsset = assetStore.getAsset(assetUid);
  if (foundAsset?.advanced_submission_schema?.properties) {
    const rows: string[] = [];
    Object.keys(foundAsset.advanced_submission_schema.properties).forEach((propertyName) => {
      if (foundAsset.advanced_submission_schema?.properties !== undefined) {
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

export function isRowProcessingEnabled(assetUid: string, xpath: string) {
  const processingRows = getAssetProcessingRows(assetUid);
  return Array.isArray(processingRows) && processingRows.includes(xpath);
}

export function isAssetProcessingActivated(assetUid: string) {
  return getAssetProcessingUrl(assetUid) !== undefined;
}

export default {
  buildAssetUrl,
  cleanupTags,
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
  renderQuestionTypeIcon,
  removeInvalidChars,
  getAssetAdvancedFeatures,
  getAssetProcessingUrl,
  getAssetProcessingRows,
  isRowProcessingEnabled,
  isAssetProcessingActivated,
};
