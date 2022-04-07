import {
  QUESTION_TYPES,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  META_QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP,
} from 'js/constants';
import {
  EXCLUDED_COLUMNS,
  SUBMISSION_ACTIONS_ID,
  VALIDATION_STATUS_ID_PROP,
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

export function getColumnLabel(
  asset: AssetResponse,
  key: string,
  showGroupName: boolean,
  translationIndex = 0
): string {
  if (asset.content?.survey === undefined) {
    return key;
  }

  let question;
  let questionPath: string[] = [];
  if (key.includes('/')) {
    questionPath = key.split('/');
    question = asset.content.survey.find((o) => (
      o.name === questionPath[questionPath.length - 1] ||
      o.$autoname === questionPath[questionPath.length - 1]
    ));
  } else {
    question = asset.content.survey.find((o) => o.name === key || o.$autoname === key);
  }

  if (
    question === undefined &&
    questionPath[0] === SUPPLEMENTAL_DETAILS_PROP
  ) {
    const flatPaths = getSurveyFlatPaths(asset.content?.survey);
    // Supplemental details keys are built like one of:
    // - prefix / source question name / transcript
    // - prefix / source question name / translated / language code
    const sourceQuestionLabel = getColumnLabel(
      asset,
      flatPaths[questionPath[1]],
      showGroupName,
      translationIndex
    );

    if (questionPath[2] === 'transcript') {
      return `${sourceQuestionLabel} - ${t('transcript')} (${questionPath[3]})`;
    } else if (questionPath[2] === 'translated') {
      return `${sourceQuestionLabel} - ${t('translation')} (${questionPath[3]})`;
    }
  }


  // NOTE: Some very old code has something to do with nonexistent/negative
  // translationIndex. No idea what is that. It does influences returned value.
  const showLabels = translationIndex > -1;

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
        const x = asset.content?.survey?.find((o) => o.name === g || o.$autoname === g);
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
  const colQuestion: SurveyRow | undefined = survey.find((question) =>
    question.$autoname === key
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

/**
 * TODO: if multiple background-audio's are allowed, we should return all
 * background-audio related names
 */
export function getBackgroundAudioQuestionName(asset: AssetResponse): string | null {
  return asset?.content?.survey?.find(
    (item) => item.type === META_QUESTION_TYPES['background-audio']
  )?.name || null;
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
  submissions?: SubmissionResponse[],
) {
  if (asset.content?.survey === undefined) {
    throw new Error('Asset has no content');
  }

  const flatPaths = getSurveyFlatPaths(asset.content.survey, false, true);

  // add all questions from the survey definition
  let output = Object.values(flatPaths);

  if (submissions) {
    // Gather unique columns from all provided submissions and add them to output
    const dataKeys = Object.keys(submissions.reduce(function (result, obj) {
      return Object.assign(result, obj);
    }, {}));
    output = [...new Set([...output, ...dataKeys])];
  }

  // Put `start` and `end` first
  if (output.indexOf(META_QUESTION_TYPES.end)) {
    output.unshift(output.splice(output.indexOf(META_QUESTION_TYPES.end), 1)[0]);
  }
  if (output.indexOf(META_QUESTION_TYPES.start)) {
    output.unshift(output.splice(output.indexOf(META_QUESTION_TYPES.start), 1)[0]);
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
        (foundPathKey === getRowName(row)) &&
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
