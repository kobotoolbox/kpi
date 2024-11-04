import {
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  META_QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP,
} from 'js/constants';
import type {AnyRowTypeName} from 'js/constants';
import {ValidationStatusAdditionalName} from 'js/components/submissions/validationStatus.constants';
import {
  EXCLUDED_COLUMNS,
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
  TEXT_FILTER_QUESTION_IDS,
  TEXT_FILTER_QUESTION_TYPES,
  FILTER_EXACT_TYPES,
  DROPDOWN_FILTER_QUESTION_TYPES,
} from 'js/components/submissions/tableConstants';
import type {
  SubmissionResponse,
  AssetResponse,
  SurveyRow,
} from 'js/dataInterface';
import {
  getSurveyFlatPaths,
  getRowName,
  injectSupplementalRowsIntoListOfRows,
} from 'js/assetUtils';
import {getSupplementalPathParts} from 'js/components/processing/processingUtils';
import type {Filter} from 'react-table';

export function getColumnLabel(
  asset: AssetResponse,
  key: string,
  showGroupName: boolean,
  translationIndex = 0
): string {
  // NOTE: Some very old code has something to do with nonexistent/negative
  // translationIndex. No idea what is that. It does influences returned value.
  const showLabels = translationIndex > -1;

  if (asset.content?.survey === undefined) {
    return key;
  }

  let question;
  let questionPath: string[] = [];
  if (key.includes('/')) {
    questionPath = key.split('/');
    question = asset.content.survey.find(
      (o) =>
        o.name === questionPath[questionPath.length - 1] ||
        o.$autoname === questionPath[questionPath.length - 1]
    );
  } else {
    questionPath = [key];
    question = asset.content.survey.find(
      (o) => o.name === key || o.$autoname === key
    );
  }

  // This identifies the supplemental details column. For such column question
  // was not found by the `key` provided (because it starts with
  // `SUPPLEMENTAL_DETAILS_PROP`) - we will find the question based on the value
  // returned by `getSupplementalPathParts` later.
  if (question === undefined && questionPath[0] === SUPPLEMENTAL_DETAILS_PROP) {
    const supplementalPathParts = getSupplementalPathParts(key);

    const sourceName = supplementalPathParts.sourceRowPath;

    // Supplemental details keys are built like one of:
    // - prefix / source question name / transcript _ language code
    // - prefix / source question name / translated _ language code
    // e.g. `_supplementalDetails/Wie_heisst_du/transcript_de`
    const sourceQuestionLabel = getColumnLabel(
      asset,
      sourceName,
      showGroupName,
      translationIndex
    );

    if (supplementalPathParts.type === 'transcript') {
      return `${t('transcript')} (${
        supplementalPathParts.languageCode
      }) | ${sourceQuestionLabel}`;
    } else if (supplementalPathParts.type === 'translation') {
      return `${t('translation')} (${
        supplementalPathParts.languageCode
      }) | ${sourceQuestionLabel}`;
    } else {
      // this is absurd, to undo what `injectSupplementalRowsIntoListOfRows()`
      // did when the back end already provided what's needed in the first
      // place
      const dtpath = key.slice('_supplementalDetails/'.length);
      // FIXME: pass the entire object (or at least the label!) provided by
      // the back end through to this function, without doing all this nonsense
      const analysisQuestion =
        asset.analysis_form_json?.additional_fields.filter(
          (f) => f.dtpath === dtpath
        )[0];
      if (analysisQuestion?.label) {
        return `${analysisQuestion.label} | ${sourceQuestionLabel}`;
      }
    }
  }

  // Background audio questions don't have labels, but we need something to be
  // displayed to users.
  if (key === QUESTION_TYPES['background-audio'].id && showLabels) {
    return t('Background audio');
  }

  if (key === SUBMISSION_ACTIONS_ID) {
    return t('Multi-select checkboxes column');
  }
  if (key === VALIDATION_STATUS_ID_PROP) {
    return t('Validation');
  }

  let label = key;

  if (key.includes('/')) {
    const splitK = key.split('/');
    label = splitK[splitK.length - 1];
  }
  if (question?.label && showLabels && question.label[translationIndex]) {
    label = question.label[translationIndex];
  }
  // show Groups in labels, when selected
  if (showGroupName && questionPath && key.includes('/')) {
    let gLabels = questionPath.join(' / ');

    if (showLabels) {
      const gT = questionPath.map(function (g) {
        const x = asset.content?.survey?.find(
          (o) => o.name === g || o.$autoname === g
        );
        if (x?.label && x.label[translationIndex]) {
          return x.label[translationIndex];
        }

        return g;
      });
      gLabels = gT.join(' / ');
    }
    return gLabels;
  }

  return label;
}

export function getColumnHXLTags(survey: SurveyRow[], key: string) {
  const colQuestion: SurveyRow | undefined = survey.find(
    (question) => question.$autoname === key
  );
  if (!colQuestion || !colQuestion.tags) {
    return null;
  }
  const HXLTags: string[] = [];
  colQuestion.tags.forEach((tag) => {
    if (tag.startsWith('hxl:')) {
      HXLTags.push(tag.replace('hxl:', ''));
    }
  });
  if (HXLTags.length === 0) {
    return null;
  } else {
    return HXLTags.join('');
  }
}

export function getBackgroundAudioQuestionName(
  asset: AssetResponse
): string | null {
  return (
    asset?.content?.survey?.find(
      (item) => item.type === QUESTION_TYPES['background-audio'].id
    )?.name || null
  );
}

/**
 * Returns a complete and unique list of columns (keys) that contain displayable
 * data that is useful for users.
 *
 * Gathers all possible columns based on asset survey definition and optionally
 * all the columns from provided submissions. Passing submissions is useful for
 * a case when previous asset version had more/different rows than current one.
 *
 * NOTE: includes supplemental details columns (AKA processing columns).
 */
export function getAllDataColumns(
  asset: AssetResponse,
  submissions?: SubmissionResponse[]
) {
  if (asset.content?.survey === undefined) {
    throw new Error('Asset has no content');
  }

  const flatPaths = getSurveyFlatPaths(asset.content.survey, false, true);

  // add all questions from the survey definition
  let output = Object.values(flatPaths);

  if (submissions) {
    // Gather unique columns from all provided submissions and add them to output
    const dataKeys = Object.keys(
      submissions.reduce(function (result, obj) {
        return Object.assign(result, obj);
      }, {})
    );
    output = [...new Set([...output, ...dataKeys])];
  }

  // Put `start` and `end` first
  if (output.indexOf(META_QUESTION_TYPES.end)) {
    output.unshift(
      output.splice(output.indexOf(META_QUESTION_TYPES.end), 1)[0]
    );
  }
  if (output.indexOf(META_QUESTION_TYPES.start)) {
    output.unshift(
      output.splice(output.indexOf(META_QUESTION_TYPES.start), 1)[0]
    );
  }

  // exclude some technical non-data columns
  output = output.filter((key) => EXCLUDED_COLUMNS.includes(key) === false);

  // exclude notes
  output = output.filter((key) => {
    const foundPathKey = Object.keys(flatPaths).find(
      (pathKey) => flatPaths[pathKey] === key
    );

    // no path means this definitely is not a note type
    if (!foundPathKey) {
      return true;
    }

    const foundNoteRow = asset?.content?.survey?.find(
      (row) =>
        typeof foundPathKey !== 'undefined' &&
        foundPathKey === getRowName(row) &&
        row.type === QUESTION_TYPES.note.id
    );

    if (typeof foundNoteRow !== 'undefined') {
      // filter out this row as this is a note type
      return false;
    }

    return true;
  });

  // exclude kobomatrix rows as data is not directly tied to them, but
  // to rows user answered to, thus making these columns always empty
  const excludedMatrixKeys: string[] = [];
  let isInsideKoboMatrix = false;
  asset.content.survey.forEach((row) => {
    if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
      isInsideKoboMatrix = true;
    } else if (row.type === GROUP_TYPES_END.end_kobomatrix) {
      isInsideKoboMatrix = false;
    } else if (isInsideKoboMatrix) {
      const rowPath = flatPaths[getRowName(row)];
      excludedMatrixKeys.push(rowPath);
    }
  });
  output = output.filter((key) => excludedMatrixKeys.includes(key) === false);

  // Exclude repeat groups and regular groups as all of their data is handled
  // by children rows.
  // This also fixes the issue when a repeat group in older version becomes
  // a regular group in new form version (with the same name), and the Table
  // was displaying "[object Object]" as responses.
  const excludedGroups: string[] = [];
  const flatPathsWithGroups = getSurveyFlatPaths(asset.content.survey, true);
  asset.content.survey.forEach((row) => {
    if (
      row.type === GROUP_TYPES_BEGIN.begin_repeat ||
      row.type === GROUP_TYPES_BEGIN.begin_group
    ) {
      const rowPath = flatPathsWithGroups[getRowName(row)];
      excludedGroups.push(rowPath);
    }
  });
  output = output.filter((key) => excludedGroups.includes(key) === false);

  // Handle supplemental details
  output = injectSupplementalRowsIntoListOfRows(asset, output);

  return output;
}

export interface TableFilterQuery {
  queryString: string;
  queryObj: {
    [key: string]:
      | string
      | null
      | {$in: number[]}
      | {$regex: string; $options: string};
  };
}

/**
 * This function uses filters list from `react-table` output to produce queries
 * that our Back end can understand. We use it it multiple places that intensely
 * need to use identical output. We might simply return `queryObj` and make
 * the code stringify it by itself, but it will make it less robust.
 */
export function buildFilterQuery(
  /** Whole survey of given asset - we need it to get questions types */
  survey: SurveyRow[],
  /** List of `react-table` filters */
  filters: Filter[]
): TableFilterQuery {
  const output: TableFilterQuery = {
    queryString: '',
    queryObj: {},
  };

  filters.forEach((filter) => {
    switch (filter.id) {
      case '_id': {
        output.queryObj[filter.id] = {$in: [parseInt(filter.value)]};
        break;
      }
      case VALIDATION_STATUS_ID_PROP: {
        if (filter.value === ValidationStatusAdditionalName.no_status) {
          output.queryObj[filter.id] = null;
        } else {
          output.queryObj[filter.id] = filter.value;
        }
        break;
      }
      // Apart from few exceptions in above cases, we tend to treat all columns
      // (`filter.id`s) with the same algorithm
      default: {
        // We assume `filter.id` is the question name (Data Table column name)
        const foundRow = survey.find((row) => getRowName(row) === filter.id);

        // Some question types needs the data to be filtered by exact values
        // (e.g. "yes" shouldn't mach "yessica" or "yes and no")
        if (foundRow && FILTER_EXACT_TYPES.includes(foundRow.type)) {
          output.queryObj[filter.id] = {
            $regex: `^${filter.value}$`,
            $options: 'i',
          };
        } else {
          output.queryObj[filter.id] = {$regex: filter.value, $options: 'i'};
        }
        break;
      }
    }
  });

  if (Object.keys(output.queryObj).length > 0) {
    output.queryString = JSON.stringify(output.queryObj);
  }

  return output;
}

/**
 * For checking if given column from Data Table should display a text input
 * filter. It works for columns associated with form questions and for other
 * columns too (e.g. submission metadata).
 */
export function isTableColumnFilterableByTextInput(
  questionType: AnyRowTypeName | undefined,
  columnId: string
) {
  return (
    (questionType && TEXT_FILTER_QUESTION_TYPES.includes(questionType)) ||
    TEXT_FILTER_QUESTION_IDS.includes(columnId)
  );
}

/**
 * For checking if given column from Data Table should display a dropdown
 * filter.
 */
export function isTableColumnFilterableByDropdown(
  questionType: AnyRowTypeName | undefined
) {
  return questionType && DROPDOWN_FILTER_QUESTION_TYPES.includes(questionType);
}
