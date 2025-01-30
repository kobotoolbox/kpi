import get from 'lodash.get';
import {
  getRowName,
  getTranslatedRowLabel,
  getSurveyFlatPaths,
  isRowSpecialLabelHolder,
} from 'js/assetUtils';
import {getColumnLabel} from 'js/components/submissions/tableUtils';
import {
  createEnum,
  SCORE_ROW_TYPE,
  RANK_LEVEL_TYPE,
  MATRIX_PAIR_PROPS,
  GROUP_TYPES_BEGIN,
  QUESTION_TYPES,
  CHOICE_LISTS,
} from 'js/constants';
import type {AnyRowTypeName} from 'js/constants';
import type {
  SurveyRow,
  SurveyChoice,
  SubmissionResponse,
  SubmissionResponseValue,
  SubmissionAttachment,
  AssetResponse,
  AnalysisFormJsonField,
} from 'js/dataInterface';
import {getSupplementalPathParts} from 'js/components/processing/processingUtils';
import type {SubmissionAnalysisResponse} from 'js/components/processing/analysis/constants';
import {QUAL_NOTE_TYPE} from 'js/components/processing/analysis/constants';

export enum DisplayGroupTypeName {
  group_root = 'group_root',
  group_repeat = 'group_repeat',
  group_regular = 'group_regular',
  group_matrix = 'group_matrix',
  group_matrix_row = 'group_matrix_row',
}

export const DISPLAY_GROUP_TYPES = createEnum([
  DisplayGroupTypeName.group_root,
  DisplayGroupTypeName.group_repeat,
  DisplayGroupTypeName.group_regular,
  DisplayGroupTypeName.group_matrix,
  DisplayGroupTypeName.group_matrix_row,
]) as {[P in DisplayGroupTypeName]: DisplayGroupTypeName};

// To match the media attachment xpath provided by the backend,
// each display group needs to keep track of its own place in its parent group's
// array of children. Note that indices in the attachment path are 1-, rather than 0-based.
// The childrenAreRepeatable bool is used when creating the final xpath and is needed for adding an
// index in cases where a repeatable group is not actually repeated.
interface xpathNode {
  path: string;
  childIndex: number | null;
  childrenAreRepeatable: boolean;
}

export class DisplayGroup {
  public type: DisplayGroupTypeName;
  /** Localized display label */
  public label: string | null = null;
  /** Unique identifier */
  public name: string | null = null;
  /** For aligning with attachment xpath */
  public xpathNodes: xpathNode[] = [];
  /** List of groups and responses */
  public children: Array<DisplayResponse | DisplayGroup> = [];

  constructor(
    type: DisplayGroupTypeName,
    label?: string | null,
    name?: string | null,
    xpathNodes?: xpathNode[] | null
  ) {
    this.type = type;
    if (label) {
      this.label = label;
    }
    if (name) {
      this.name = name;
    }
    if (xpathNodes) {
      this.xpathNodes = xpathNodes;
    }
  }

  addChild(child: DisplayResponse | DisplayGroup) {
    this.children.push(child);
  }
}

export class DisplayResponse {
  /** One of QUESTION_TYPES or `null` for supplemental details */
  public type: AnyRowTypeName | null;
  /** Localized display label */
  public label: string | null;
  /** Unique identifier */
  public name: string;
  /** XPath  */
  public xpath: string;
  /**
   * Unique identifier of a choices list, only applicable for question types
   * that uses choices lists.
   */
  public listName: string | undefined;
  /** User response, `null` for no response */
  public data: SubmissionResponseValue | null = null;

  constructor(
    type: AnyRowTypeName | null,
    label: string | null,
    name: string,
    xpath: string,
    listName: string | undefined,
    data?: SubmissionResponseValue | null
  ) {
    this.type = type;
    this.label = label;
    this.name = name;
    this.xpath = xpath;
    if (data) {
      this.data = data;
    }
    if (listName) {
      this.listName = listName;
    }
  }
}

/**
 * Returns a sorted object of transcript/translation keys
 *
 * Note: we omit returning `qual_note` questions.
 */
function sortAnalysisFormJsonKeys(additionalFields: AnalysisFormJsonField[]) {
  const sortedBySource: {[key: string]: string[]} = {};

  additionalFields.forEach((field: AnalysisFormJsonField) => {
    // Note questions make sense only in the context of writing responses to
    // Qualitative Analysis questions. They bear no data, so there is no point
    // displaying them outside of Single Processing route. As this function is
    // part of Single Submission modal, we need to hide the notes.
    if (field.type === QUAL_NOTE_TYPE) {
      return;
    }

    const expandedPath = `_supplementalDetails/${field.dtpath}`;
    if (!sortedBySource[field.source]) {
      sortedBySource[field.source] = [];
    }
    sortedBySource[field.source].push(expandedPath);
  });
  return sortedBySource;
}

function addXpathNode(
  parentGroup: DisplayGroup,
  repeatIndex: number | null,
  currentRowData: any
) {
  let nodePath = [];
  let childIndex = null;
  if (repeatIndex !== null) {
    childIndex = repeatIndex + 1;
  }
  if (parentGroup.name) {
    nodePath.push({
      path: parentGroup.name,
      childIndex,
      childrenAreRepeatable: Array.isArray(currentRowData),
    });
  }
  return parentGroup.xpathNodes.concat(nodePath);
}

/**
 * Returns a data built for `SubmissionDataTable`, so it can easily (or at least
 * easier than without this function) display a list of questions with their
 * responses. Internally it builds a huge `DisplayGroup` object - a root group
 * with everything inside.
 */
export function getSubmissionDisplayData(
  asset: AssetResponse,
  /** for choosing label to display */
  translationIndex: number,
  submissionData: SubmissionResponse
) {
  // let's start with a root of survey being a group with special flag
  const output = new DisplayGroup(DISPLAY_GROUP_TYPES.group_root);

  const survey = asset?.content?.survey || [];
  const choices = asset?.content?.choices || [];

  const flatPaths = getSurveyFlatPaths(survey, true);

  const supplementalDetailKeys = sortAnalysisFormJsonKeys(
    asset.analysis_form_json?.additional_fields || []
  );

  /**
   * Recursively generates a nested architecture of survey with data.
   */
  function traverseSurvey(
    /** Rows and groups will be added to it as children. */
    parentGroup: DisplayGroup,
    /** The submissionData scoped by parent (useful for repeat groups). */
    parentData: SubmissionResponseValue,
    /** Inside a repeat group this is the current repeat submission index. */
    repeatIndex: number | null = null
  ) {
    for (let rowIndex = 0; rowIndex < survey.length; rowIndex++) {
      const row = survey[rowIndex];

      const rowName = getRowName(row);
      let rowListName = getRowListName(row);
      const rowLabel = getTranslatedRowLabel(rowName, survey, translationIndex);

      let parentGroupPath = null;
      if (parentGroup.name !== null) {
        parentGroupPath = flatPaths[parentGroup.name];
      }

      const isRowCurrentLevel = isRowFromCurrentGroupLevel(
        rowName,
        parentGroupPath,
        survey
      );

      // we are interested only in questions from this group level
      if (!isRowCurrentLevel) {
        continue;
      }
      // let's hide rows that don't carry any submission data
      if (
        row.type === QUESTION_TYPES.note.id
      ) {
        continue;
      }
      /*
       * For a complex form items (e.g. rating) Backend constructs a pair of
       * group and a row. The row serves a purpose of a label and we don't want
       * it here as `getTranslatedRowLabel` handles this already. We check
       * previous row.
       */
      if (isRowSpecialLabelHolder(survey[rowIndex - 1], row)) {
        continue;
      }

      let rowData = getRowData(rowName, survey, parentData as SubmissionResponse);

      if (row.type === GROUP_TYPES_BEGIN.begin_repeat) {
        if (Array.isArray(rowData)) {
          rowData.forEach((item, itemIndex) => {
            let nodePath = addXpathNode(parentGroup, repeatIndex, rowData);
            let itemObj = new DisplayGroup(
              DISPLAY_GROUP_TYPES.group_repeat,
              rowLabel,
              rowName,
              nodePath
            );
            parentGroup.addChild(itemObj);
            /*
             * Start whole process again starting at this place in survey,
             * with current group as parent element and new repeat index
             * being used.
             */
            traverseSurvey(itemObj, item, itemIndex);
          });
        }
      } else if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
        const matrixGroupObj = new DisplayGroup(
          DISPLAY_GROUP_TYPES.group_matrix,
          rowLabel,
          rowName
        );
        parentGroup.addChild(matrixGroupObj);

        if (Array.isArray(choices)) {
          /*
           * For matrixes we generate a group of subgroups - each subgroup
           * corresponds to a matrix item from choices.
           */
          choices.forEach((item) => {
            if (
              item[MATRIX_PAIR_PROPS.inChoices as keyof SurveyChoice] ===
              row[MATRIX_PAIR_PROPS.inSurvey as keyof SurveyRow]
            ) {
              // Matrix is only one level deep, so we can use a "simpler"
              // non-recursive special function
              populateMatrixData(
                survey,
                choices,
                submissionData,
                translationIndex,
                matrixGroupObj,
                getRowName(item),
                parentData
              );
            }
          });
        }
      } else if (
        row.type === GROUP_TYPES_BEGIN.begin_group ||
        row.type === GROUP_TYPES_BEGIN.begin_score ||
        row.type === GROUP_TYPES_BEGIN.begin_rank
      ) {
        let nodePath = addXpathNode(parentGroup, repeatIndex, rowData);
        let rowObj = new DisplayGroup(
          DISPLAY_GROUP_TYPES.group_regular,
          rowLabel,
          rowName,
          nodePath
        );
        parentGroup.addChild(rowObj);
        /*
         * Start whole process again starting at this place in survey,
         * with current group as parent element and pass current repeat index.
         */
        if (rowData) {
          traverseSurvey(rowObj, rowData, repeatIndex);
        }
      } else if (
        Object.keys(QUESTION_TYPES).includes(row.type) ||
        row.type === SCORE_ROW_TYPE ||
        row.type === RANK_LEVEL_TYPE
      ) {
        // for repeat groups, we are interested in current repeat item's data
        if (Array.isArray(rowData) && repeatIndex !== null) {
          rowData = rowData[repeatIndex];
        }

        // score and rank don't have list name on them and they need to use
        // the one of their parent
        if (row.type === SCORE_ROW_TYPE || row.type === RANK_LEVEL_TYPE) {
          const parentGroupRow = survey.find(
            (rowItem) => getRowName(rowItem) === parentGroup.name
          );
          rowListName = getRowListName(parentGroupRow);
        }

        // Begin constructing xpath for matching media attachments
        let xpath: string[] = [];

        // Build xpath array from existing nodes in parent group
        parentGroup.xpathNodes.forEach((node) => {
          let nodeCount =
            node.childIndex !== null ? `[${node.childIndex}]` : '';
          xpath.push(`${node.path}` + nodeCount);
        });

        // add repeat count to parent group before adding to array
        if (parentGroup.name) {
          let index = '';
          if (parentGroup.type === DISPLAY_GROUP_TYPES.group_repeat) {
            index = `[${(repeatIndex ?? 0) + 1}]`;
          } else if (parentGroup.xpathNodes.at(-1)?.childrenAreRepeatable) {
            index = '[1]';
          }
          xpath.push(`${parentGroup.name}` + index);
        }
        // add current rowname to end
        xpath.push(rowName);

        let rowObj = new DisplayResponse(
          row.type,
          rowLabel,
          rowName,
          xpath.join('/'),
          rowListName,
          rowData
        );
        parentGroup.addChild(rowObj);

        const rowxpath = flatPaths[rowName];
        supplementalDetailKeys[rowxpath]?.forEach((sdKey: string) => {
          parentGroup.addChild(
            new DisplayResponse(
              null,
              getColumnLabel(asset, sdKey, false),
              sdKey,
              flatPaths[rowName],
              undefined,
              getSupplementalDetailsContent(submissionData, sdKey)
            )
          );
        });
      }
    }
  }
  traverseSurvey(output, submissionData);

  return output;
}

/**
 * It creates display data structure for a given choice-row of a Matrix.
 * As the data is bit different from all other question types, we need to use
 * a special function, not a great traverseSurvey one.
 */
function populateMatrixData(
  survey: SurveyRow[],
  choices: SurveyChoice[],
  submissionData: SubmissionResponse,
  translationIndex: number,
  /** A group you want to add a row of questions to. */
  matrixGroup: DisplayGroup,
  /** The row name. */
  matrixRowName: string,
  /** The submissionData scoped by parent (useful for repeat groups). */
  parentData: SubmissionResponseValue
) {
  // This should not happen, as the only DisplayGroup with null name will be of
  // the group_root type, but we need this for the types.
  if (matrixGroup.name === null) {
    return;
  }

  // create row display group and add it to matrix group
  const matrixRowLabel = getTranslatedRowLabel(
    matrixRowName,
    choices,
    translationIndex
  );
  const matrixRowGroupObj = new DisplayGroup(
    DISPLAY_GROUP_TYPES.group_matrix_row,
    matrixRowLabel,
    matrixRowName
  );
  matrixGroup.addChild(matrixRowGroupObj);

  const flatPaths = getSurveyFlatPaths(survey, true);
  const matrixGroupPath = flatPaths[matrixGroup.name];

  /*
   * Iterate over survey rows to find only ones from inside the matrix.
   * These rows are the questions from the target matrix choice-row, so we find
   * all neccessary pieces of data nd build display data structure for it.
   */
  Object.keys(flatPaths).forEach((questionName) => {
    if (flatPaths[questionName].startsWith(`${matrixGroupPath}/`)) {
      const questionSurveyObj = survey.find(
        (row) => getRowName(row) === questionName
      );
      // We are only interested in going further if object was found.
      if (typeof questionSurveyObj === 'undefined') {
        return;
      }

      // NOTE: Submission data for a Matrix question is kept in an unusal
      // property, so instead of:
      // [PATH/]MATRIX/MATRIX_QUESTION
      // it is stored in:
      // [PATH/]MATRIX_CHOICE/MATRIX_CHOICE_QUESTION
      let questionData: SubmissionResponseValue = null;
      const dataProp = `${matrixGroupPath}_${matrixRowName}/${matrixGroup.name}_${matrixRowName}_${questionName}`;
      if (submissionData[dataProp]) {
        questionData = submissionData[dataProp];
      } else if (
        parentData !== null &&
        typeof parentData === 'object' &&
        dataProp in parentData
      ) {
        // Note: If Matrix question is inside a repeat group, the data is stored
        // elsewhere :tableflip:
        questionData = (parentData as {[key: string]: SubmissionResponseValue})[dataProp];
      }

      const questionObj = new DisplayResponse(
        questionSurveyObj.type,
        getTranslatedRowLabel(questionName, survey, translationIndex),
        questionName,
        flatPaths[questionName],
        getRowListName(questionSurveyObj),
        questionData
      );
      matrixRowGroupObj.addChild(questionObj);
    }
  });
}

/**
 * Returns data for given row, works for groups too. Returns `null` for no
 * answer, array for repeat groups and object for regular groups
 */
export function getRowData(
  name: string,
  survey: SurveyRow[],
  data: SubmissionResponse | null
): SubmissionResponseValue | null {
  if (data === null || typeof data !== 'object') {
    return null;
  }

  const flatPaths = getSurveyFlatPaths(survey, true);
  const path = flatPaths[name];

  if (data[path]) {
    return data[path];
  } else if (data[name]) {
    return data[name];
  } else if (path) {
    // we don't really know here if this is a repeat or a regular group
    // so we let the data be the guide (possibly not trustworthy)
    const repeatRowData = getRepeatGroupAnswers(data, path);
    if (repeatRowData.length >= 1) {
      return repeatRowData;
    }

    const rowData = getRegularGroupAnswers(data, path);
    if (Object.keys(rowData).length >= 1) {
      return rowData;
    }
  }
  return null;
}

/**
 * Tells if given row is an immediate child of given group
 */
function isRowFromCurrentGroupLevel(
  rowName: string,
  /** Null for root level rows. */
  groupPath: string | null,
  survey: SurveyRow[]
): boolean {
  const flatPaths = getSurveyFlatPaths(survey, true);
  if (groupPath === null) {
    return flatPaths[rowName] === rowName;
  } else {
    return flatPaths[rowName] === `${groupPath}/${rowName}`;
  }
}

/**
 * Returns an array of answers
 */
export function getRepeatGroupAnswers(
  responseData: SubmissionResponse,
  /** With groups e.g. group_person/group_pets/group_pet/pet_name. */
  targetKey: string
): string[] {
  const answers: string[] = [];

  // Goes through nested groups from key, looking for answers.
  const lookForAnswers = (data: SubmissionResponse, levelIndex: number) => {
    const levelKey = targetKey
      .split('/')
      .slice(0, levelIndex + 1)
      .join('/');

    const targetKeyData = data[targetKey];
    const levelKeyData = data[levelKey];

    // Each level could be an array of repeat group answers or object with questions.
    if (levelKey === targetKey) {
      if (targetKeyData !== undefined && typeof targetKeyData !== 'object') {
        answers.push(String(targetKeyData));
      }
    } else if (
      levelKeyData !== null &&
      typeof levelKeyData === 'object' &&
      Array.isArray(levelKeyData)
    ) {
      levelKeyData.forEach((item: SubmissionResponse) => {
        lookForAnswers(item, levelIndex + 1);
      });
    }
  };

  lookForAnswers(responseData, 0);

  return answers;
}

/**
 * Filters data for items inside the group
 */
function getRegularGroupAnswers(
  data: SubmissionResponse,
  /** With groups e.g. group_person/group_pets/group_pet. */
  targetKey: string
): {[questionName: string]: SubmissionResponseValue} {
  // The response can be a lot of different things
  const answers: {[questionName: string]: SubmissionResponseValue} = {};
  Object.keys(data).forEach((objKey) => {
    if (objKey.startsWith(`${targetKey}/`)) {
      answers[objKey] = data[objKey];
    }
  });
  return answers;
}

function getRowListName(row: SurveyRow | undefined): string | undefined {
  let returnVal;
  if (row && Object.keys(row).includes(CHOICE_LISTS.SELECT)) {
    returnVal = row[CHOICE_LISTS.SELECT as keyof SurveyRow];
  }
  if (row && Object.keys(row).includes(CHOICE_LISTS.MATRIX)) {
    returnVal = row[CHOICE_LISTS.MATRIX as keyof SurveyRow];
  }
  if (row && Object.keys(row).includes(CHOICE_LISTS.SCORE)) {
    returnVal = row[CHOICE_LISTS.SCORE as keyof SurveyRow];
  }
  if (row && Object.keys(row).includes(CHOICE_LISTS.RANK)) {
    returnVal = row[CHOICE_LISTS.RANK as keyof SurveyRow];
  }
  if (typeof returnVal === 'string') {
    return returnVal;
  }
  return undefined;
}

/**
 * Returns an attachment object or an error message.
 */
export function getMediaAttachment(
  submission: SubmissionResponse,
  fileName: string,
  questionXPath: string
): string | SubmissionAttachment {
  let mediaAttachment: string | SubmissionAttachment = t(
    'Could not find ##fileName##'
  ).replace('##fileName##', fileName);

  submission._attachments.forEach((attachment) => {
    if (attachment.question_xpath === questionXPath) {
      // Check if the audio filetype is of type not supported by player and send it to format to mp3
      if (
        attachment.mimetype.includes('audio/') &&
        !attachment.mimetype.includes('/mp3') &&
        !attachment.mimetype.includes('mpeg') &&
        !attachment.mimetype.includes('/wav') &&
        !attachment.mimetype.includes('ogg')
      ) {
        const newAudioURL = attachment.download_url + '?format=mp3';
        const newAttachment = {
          ...attachment,
          download_url: newAudioURL,
          download_large_url: newAudioURL,
          download_medium_url: newAudioURL,
          download_small_url: newAudioURL,
          mimetype: 'audio/mp3',
        };
        mediaAttachment = newAttachment;
      } else {
        mediaAttachment = attachment;
      }
    }
  });
  return mediaAttachment;
}

/**
 * Returns supplemental details for given path,
 * e.g. `_supplementalDetails/question_name/transcript_pl` or
 * `_supplementalDetails/question_name/translated_pl` or
 * `_supplementalDetails/question_name/a1234567-a123-123a-12a3-123aaaa45678`
 * (a random uuid for qualitative analysis questions).
 *
 * Returns null if there is no details to return.
 *
 * NOTE: transcripts are actually not nested on language level (because there
 * can be only one transcript), but we need to use paths with languages in it
 * to build Submission Modal and Data Table properly.
 */
export function getSupplementalDetailsContent(
  submission: SubmissionResponse,
  path: string
): string | null {
  let pathArray;
  const pathParts = getSupplementalPathParts(path);

  if (pathParts.type === 'transcript') {
    pathArray = path.split('/');
    // There is always one transcript, not nested in language code object, thus
    // we don't need the language code in the last element of the path.
    pathArray.pop();
    pathArray.push('transcript');
    const transcriptObj = get(submission, pathArray, '');
    if (
      transcriptObj.languageCode === pathParts.languageCode &&
      typeof transcriptObj.value === 'string'
    ) {
      return transcriptObj.value;
    }
  }

  if (pathParts.type === 'translation') {
    pathArray = path.split('/');
    // The last element is `translation_<language code>`, but we don't want
    // the underscore to be there.
    pathArray.pop();
    pathArray.push('translation');
    pathArray.push(pathParts.languageCode || '??');

    // Then we add one more nested level
    pathArray.push('value');
    // Moments like these makes you really apprecieate the beauty of lodash.
    const translationText = get(submission, pathArray, '');

    if (translationText) {
      return translationText;
    }
  }

  if (pathParts.type === 'qual') {
    pathArray = path.split('/');
    // The last element is some random uuid, but we look for `qual`.
    pathArray.pop();
    pathArray.push('qual');
    const qualResponses: SubmissionAnalysisResponse[] = get(submission, pathArray, []);
    const foundResponse = qualResponses.find(
      (item: SubmissionAnalysisResponse) => item.uuid === pathParts.analysisQuestionUuid
    );
    if (foundResponse) {
      // For `qual_select_one` we get object
      if (
        typeof foundResponse.val === 'object' &&
        foundResponse.val !== null &&
        'labels' in foundResponse.val
      ) {
        return foundResponse.val.labels._default;
      }

      // Here we handle both `qual_select_multiple` and `qual_tags`, as both are
      // arrays of items
      if (
        Array.isArray(foundResponse.val) &&
        foundResponse.val.length > 0
      ) {
        const choiceLabels = foundResponse.val.map((item) => {
          // For `qual_select_multiple` we get an array of objects
          if (typeof item === 'object') {
            return item.labels._default;
          // For `qual_tags` we get an array of strings
          } else {
            return item;
          }
        });

        return choiceLabels.join(', ');
      }

      if (
        typeof foundResponse.val === 'string' &&
        foundResponse.val !== ''
      ) {
        return foundResponse.val;
      }

      if (typeof foundResponse.val === 'number') {
        return String(foundResponse.val);
      }

      return null;
    }
  }

  // If there is no value it could be either WIP or intentional. We want to be
  // clear about the fact it could be intentionally empty.
  return null;
}

export default {
  DISPLAY_GROUP_TYPES,
  getSubmissionDisplayData,
  getRepeatGroupAnswers,
};

export function getQuestionXPath(surveyRows: SurveyRow[], rowName: string) {
  const flatPaths = getSurveyFlatPaths(surveyRows, true);
  return flatPaths[rowName];
}
