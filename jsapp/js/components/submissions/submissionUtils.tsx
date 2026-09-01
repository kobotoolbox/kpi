import clonedeep from 'lodash.clonedeep'
import get from 'lodash.get'
import type { DataResponse } from '#/api/models/dataResponse'
import {
  type SurveyFlatPaths,
  findRowByXpathOrLeafName,
  getRowName,
  getSurveyFlatPaths,
  getTranslatedRowLabel,
  isRowSpecialLabelHolder,
} from '#/assetUtils'
import {
  type SubmissionAnalysisResponse,
  isDisplayableSupplementalField,
} from '#/components/processing/SingleProcessingContent/TabAnalysis/common/constants'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import { EXCLUDED_COLUMNS, LAST_COLUMNS_ORDER } from '#/components/submissions/tableConstants'
import { getBackgroundAudioQuestionName, getColumnLabel } from '#/components/submissions/tableUtils'
import {
  CHOICE_LISTS,
  GROUP_TYPES_BEGIN,
  MATRIX_PAIR_PROPS,
  META_QUESTION_TYPES,
  QUESTION_TYPES,
  RANK_LEVEL_TYPE,
  SCORE_ROW_TYPE,
  SUPPLEMENTAL_DETAILS_PROP,
  createEnum,
} from '#/constants'
import type { AnyRowTypeName, QuestionTypeName } from '#/constants'
import type {
  AnalysisFormJsonField,
  AssetResponse,
  SubmissionAttachment,
  SubmissionResponse,
  SubmissionResponseValue,
  SubmissionSupplementalDetails,
  SurveyChoice,
  SurveyRow,
} from '#/dataInterface'
import { recordEntries, recordKeys, recordValues } from '#/utils'
import { getRepeatGroupAnswers } from './repeatGroupUtils'
import { findAttachmentByQuestionXpath, getAttachmentQuestionType, getMediaAttachment } from './submissionMediaUtils'
export {
  getRepeatGroupAnswerTree,
  getRepeatGroupAnswers,
  type RepeatGroupAnswerOptions,
  type RepeatGroupAnswerTreeNode,
} from './repeatGroupUtils'
export { getMediaAttachment } from './submissionMediaUtils'

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
]) as { [P in DisplayGroupTypeName]: DisplayGroupTypeName }

// To match the media attachment xpath provided by the backend,
// each display group needs to keep track of its own place in its parent group's
// array of children. Note that indices in the attachment path are 1-, rather than 0-based.
// The childrenAreRepeatable bool is used when creating the final xpath and is needed for adding an
// index in cases where a repeatable group is not actually repeated.
interface xpathNode {
  path: string
  childIndex: number | null
  childrenAreRepeatable: boolean
}

export class DisplayGroup {
  public type: DisplayGroupTypeName
  /** Localized display label */
  public label: string | null = null
  /** Unique identifier */
  public name: string | null = null
  /** For aligning with attachment xpath */
  public xpathNodes: xpathNode[] = []
  /** List of groups and responses */
  public children: Array<DisplayResponse | DisplayGroup> = []

  constructor(
    type: DisplayGroupTypeName,
    label?: string | null,
    name?: string | null,
    xpathNodes?: xpathNode[] | null,
  ) {
    this.type = type
    if (label) {
      this.label = label
    }
    if (name) {
      this.name = name
    }
    if (xpathNodes) {
      this.xpathNodes = xpathNodes
    }
  }
}

export class DisplayResponse {
  /** One of QUESTION_TYPES or `null` for supplemental details */
  public type: AnyRowTypeName | null
  /** Localized display label */
  public label: string | null
  /** Unique identifier */
  public name: string
  /** XPath  */
  public xpath: string
  /**
   * Unique identifier of a choices list, only applicable for question types
   * that uses choices lists.
   */
  public listName?: string | undefined
  /** User response, `null` for no response */
  public data: SubmissionResponseValue | null = null

  constructor(
    type: AnyRowTypeName | null,
    label: string | null,
    name: string,
    xpath: string,
    listName: string | undefined,
    data?: SubmissionResponseValue | null,
  ) {
    this.type = type
    this.label = label
    this.name = name
    this.xpath = xpath
    if (data) {
      this.data = data
    }
    if (listName) {
      this.listName = listName
    }
  }
}

/**
 * Returns a sorted object of transcript/translation keys
 *
 * Note: we omit the fields that belong to Single Processing route alone, i.e.
 * `qualNote` and `qualSource` (see `isDisplayableSupplementalField`).
 */
function sortAnalysisFormJsonKeys(additionalFields: AnalysisFormJsonField[]) {
  const sortedBySource: { [key: string]: string[] } = {}

  additionalFields.forEach((field: AnalysisFormJsonField) => {
    // This function feeds Single Submission modal, so the fields that belong to
    // Single Processing alone have to go.
    if (!isDisplayableSupplementalField(field)) {
      return
    }

    const expandedPath = `_supplementalDetails/${field.dtpath}`
    if (!sortedBySource[field.source]) {
      sortedBySource[field.source] = []
    }
    sortedBySource[field.source].push(expandedPath)
  })
  return sortedBySource
}

function addXpathNode(parentGroup: DisplayGroup, repeatIndex: number | null, currentRowData: any) {
  const nodePath = []
  let childIndex = null
  if (repeatIndex !== null) {
    childIndex = repeatIndex + 1
  }
  if (parentGroup.name) {
    nodePath.push({
      path: parentGroup.name,
      childIndex,
      childrenAreRepeatable: Array.isArray(currentRowData),
    })
  }
  return parentGroup.xpathNodes.concat(nodePath)
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
  submissionData: DataResponse | SubmissionResponse,
) {
  // let's start with a root of survey being a group with special flag
  const output = new DisplayGroup(DISPLAY_GROUP_TYPES.group_root)

  const survey = asset?.content?.survey || []
  const choices = asset?.content?.choices || []

  const flatPaths = getSurveyFlatPaths(survey, true)

  const supplementalDetailKeys = sortAnalysisFormJsonKeys(asset.analysis_form_json?.additional_fields || [])

  /** Keys whose answers got displayed, so `addUnaccountedAnswers` sees the rest. */
  const displayedKeys = new Set<string>()

  /**
   * Recursively generates a nested architecture of survey with data.
   */
  function traverseSurvey(
    /** Rows and groups will be added to it as children. */
    parentGroup: DisplayGroup,
    /** The submissionData scoped by parent (useful for repeat groups). */
    parentData: SubmissionResponseValue,
    /** Inside a repeat group this is the current repeat submission index. */
    repeatIndex: number | null = null,
  ) {
    for (let rowIndex = 0; rowIndex < survey.length; rowIndex++) {
      const row = survey[rowIndex]

      const rowName = getRowName(row)
      let rowListName = getRowListName(row)
      const rowLabel = getTranslatedRowLabel(rowName, survey, translationIndex)

      let parentGroupPath = null
      if (parentGroup.name !== null) {
        parentGroupPath = flatPaths[parentGroup.name]
      }

      const isRowCurrentLevel = isRowFromCurrentGroupLevel(rowName, parentGroupPath, survey)

      // we are interested only in questions from this group level
      if (!isRowCurrentLevel) {
        continue
      }
      // let's hide rows that don't carry any submission data
      if (row.type === QUESTION_TYPES.note.id) {
        continue
      }
      /*
       * For a complex form items (e.g. rating) Backend constructs a pair of
       * group and a row. The row serves a purpose of a label and we don't want
       * it here as `getTranslatedRowLabel` handles this already. We check
       * previous row.
       */
      if (isRowSpecialLabelHolder(survey[rowIndex - 1], row)) {
        continue
      }

      const scopedData = parentData as DataResponse | SubmissionResponse
      // Note where this row's answer came from, so leftovers can be picked up later.
      const rowDataKey = findSubmissionKeyForRow(rowName, survey, scopedData)
      if (rowDataKey !== undefined) {
        displayedKeys.add(rowDataKey)
      }

      let rowData = getRowData(rowName, survey, scopedData)

      if (row.type === GROUP_TYPES_BEGIN.begin_repeat) {
        if (Array.isArray(rowData)) {
          rowData.forEach((item, itemIndex) => {
            const nodePath = addXpathNode(parentGroup, repeatIndex, rowData)
            const itemObj = new DisplayGroup(DISPLAY_GROUP_TYPES.group_repeat, rowLabel, rowName, nodePath)
            parentGroup.children.push(itemObj)
            /*
             * Start whole process again starting at this place in survey,
             * with current group as parent element and new repeat index
             * being used.
             */
            traverseSurvey(itemObj, item, itemIndex)
          })
        }
      } else if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
        const matrixGroupObj = new DisplayGroup(DISPLAY_GROUP_TYPES.group_matrix, rowLabel, rowName)
        parentGroup.children.push(matrixGroupObj)

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
                parentData,
                displayedKeys,
              )
            }
          })
        }
      } else if (
        row.type === GROUP_TYPES_BEGIN.begin_group ||
        row.type === GROUP_TYPES_BEGIN.begin_score ||
        row.type === GROUP_TYPES_BEGIN.begin_rank
      ) {
        const nodePath = addXpathNode(parentGroup, repeatIndex, rowData)
        const rowObj = new DisplayGroup(DISPLAY_GROUP_TYPES.group_regular, rowLabel, rowName, nodePath)
        parentGroup.children.push(rowObj)
        /*
         * Start whole process again starting at this place in survey,
         * with current group as parent element and pass current repeat index.
         */
        if (rowData) {
          traverseSurvey(rowObj, rowData, repeatIndex)
        }
      } else if (
        recordKeys(QUESTION_TYPES).includes(row.type as QuestionTypeName) ||
        row.type === SCORE_ROW_TYPE ||
        row.type === RANK_LEVEL_TYPE
      ) {
        // for repeat groups, we are interested in current repeat item's data
        if (Array.isArray(rowData) && repeatIndex !== null) {
          rowData = rowData[repeatIndex]
        }

        // score and rank don't have list name on them and they need to use
        // the one of their parent
        if (row.type === SCORE_ROW_TYPE || row.type === RANK_LEVEL_TYPE) {
          const parentGroupRow = survey.find((rowItem) => getRowName(rowItem) === parentGroup.name)
          rowListName = getRowListName(parentGroupRow)
        }

        // Begin constructing xpath for matching media attachments
        const xpath: string[] = []

        // Build xpath array from existing nodes in parent group
        parentGroup.xpathNodes.forEach((node) => {
          const nodeCount = node.childIndex !== null ? `[${node.childIndex}]` : ''
          xpath.push(`${node.path}` + nodeCount)
        })

        // add repeat count to parent group before adding to array
        if (parentGroup.name) {
          let index = ''
          if (parentGroup.type === DISPLAY_GROUP_TYPES.group_repeat) {
            index = `[${(repeatIndex ?? 0) + 1}]`
          } else if (parentGroup.xpathNodes.at(-1)?.childrenAreRepeatable) {
            index = '[1]'
          }
          xpath.push(`${parentGroup.name}` + index)
        }
        // add current rowname to end
        xpath.push(rowName)

        const rowObj = new DisplayResponse(row.type, rowLabel, rowName, xpath.join('/'), rowListName, rowData)
        parentGroup.children.push(rowObj)

        const rowxpath = flatPaths[rowName]

        /**
         * Recursively add qual related rows to output. Looks for the source key in the list of all possible keys.
         */
        const addSupplementalDetails = (sourceKey: string) => {
          supplementalDetailKeys[sourceKey]?.forEach((sdKey: string) => {
            // Create a unique xpath for the analysis/verification question
            const specificXpath = sdKey.replace('_supplementalDetails/', '')

            parentGroup.children.push(
              new DisplayResponse(
                // type
                // TODO: should we aim at this being analysis question type name?
                null,
                // label
                getColumnLabel(asset, sdKey, false),
                // name
                sdKey,
                // xpath
                specificXpath,
                // listName
                undefined,
                // data
                getSupplementalDetailsContent(submissionData, sdKey),
              ),
            )

            // Check for nested supplemental details (e.g. qualVerification for a qual question)
            addSupplementalDetails(specificXpath)
          })
        }

        addSupplementalDetails(rowxpath)
      }
    }
  }
  traverseSurvey(output, submissionData)

  addUnaccountedAnswers(output, asset, translationIndex, submissionData, displayedKeys)

  return output
}

/**
 * Meta questions missing from `META_QUESTION_TYPES` that old enough forms carry:
 * two since deprecated, plus legacy aliases of `deviceid` and `phonenumber`. From
 * `q.hiddenTypes()` in `jsapp/xlform/src/model.aliases.coffee`.
 */
const UNMODELED_META_QUESTION_NAMES = ['simserial', 'subscriberid', 'imei', 'phone_number']

/**
 * Submission keys that are never an answer, so they must not become rows here:
 * the technical ones Data Table drops too, the metadata ones the modal renders on
 * its own (see `getMetadataColumns`), and the meta questions nobody answers.
 */
const NON_RESPONSE_SUBMISSION_KEYS = new Set<string>([
  ...EXCLUDED_COLUMNS,
  ...LAST_COLUMNS_ORDER,
  ...recordValues(META_QUESTION_TYPES),
  ...UNMODELED_META_QUESTION_NAMES,
])

/**
 * Adds a row for every answer stored under a path the current form no longer
 * accounts for - what renaming or removing a question or group leaves behind.
 * Without it the answer and its file vanish from the modal, while Data Table keeps
 * the column (see `getAllDataColumns`). Rows never go into the renamed question's
 * own row, as its old name may belong to another question by now.
 */
function addUnaccountedAnswers(
  output: DisplayGroup,
  asset: AssetResponse,
  /** for choosing label to display */
  translationIndex: number,
  submissionData: DataResponse | SubmissionResponse,
  /** The keys `traverseSurvey` already displayed. */
  displayedKeys: Set<string>,
) {
  const assetContent = asset.content
  if (!assetContent) {
    return
  }

  const flatPaths = getSurveyFlatPaths(assetContent.survey ?? [], true)

  for (const [key, value] of Object.entries(submissionData)) {
    if (displayedKeys.has(key) || NON_RESPONSE_SUBMISSION_KEYS.has(key)) {
      continue
    }

    // Back end adds its own properties in the leading underscore namespace (e.g.
    // `_index`), none of them answers. Only the first segment counts, as a leaf
    // may legitimately start with one - e.g. `Colours_by_brightness/_1st_choice`.
    if (key.split('/')[0].startsWith('_')) {
      continue
    }

    // Anything not a plain value is a group, whose answers are rows of their own.
    // NOTE: this leaves out renames inside a repeat group, as those keys sit in
    // the array of items rather than here.
    if ((typeof value !== 'string' && typeof value !== 'number') || value === '') {
      continue
    }

    // A renamed group leaves the question findable by leaf name, with its real type
    // and choice list. A renamed question leaves only its attachment's mimetype -
    // still enough to render media rather than a bare filename.
    const row = findRowByXpathOrLeafName(assetContent, key)
    const attachment = row ? undefined : findAttachmentByQuestionXpath(submissionData, key)

    findGroupForUnaccountedAnswer(output, key, row, flatPaths).children.push(
      new DisplayResponse(
        row?.type ?? (attachment && getAttachmentQuestionType(attachment)) ?? null,
        getColumnLabel(asset, key, false, translationIndex),
        key,
        // The path the answer came in under, which finds its file too (`getMediaAttachment`).
        key,
        getRowListName(row),
        value,
      ),
    )
  }
}

/** The path of whatever holds the given path, empty string for the root level. */
function getParentPath(path: string) {
  return path.split('/').slice(0, -1).join('/')
}

/**
 * Finds the display tree group standing for a given group path, or nothing when the
 * path doesn't lead to exactly one.
 *
 * Repeat and matrix groups are skipped with their contents: a repeat renders one
 * group per submitted item, so one path leads to as many groups as there are items.
 */
function findDisplayGroupByPath(root: DisplayGroup, path: string): DisplayGroup | undefined {
  const matches: DisplayGroup[] = []

  const searchGroup = (group: DisplayGroup, groupPath: string) => {
    if (groupPath === path) {
      matches.push(group)
    }

    for (const child of group.children) {
      if (child instanceof DisplayGroup && child.type === DISPLAY_GROUP_TYPES.group_regular && child.name) {
        searchGroup(child, groupPath === '' ? child.name : `${groupPath}/${child.name}`)
      }
    }
  }
  searchGroup(root, '')

  // Two matches leave no way to tell which was meant, and no placement beats a wrong one.
  return matches.length === 1 ? matches[0] : undefined
}

/**
 * Picks the group to show an unaccounted answer in, defaulting to the root.
 *
 * The answer's own path goes first, as it names the group the answer was given in,
 * which may still be there - a question renamed inside an untouched group. Failing
 * that, the group holding the question today, where the rest of its answers render -
 * a renamed group, whose row would otherwise stay empty.
 */
function findGroupForUnaccountedAnswer(
  output: DisplayGroup,
  /** The submission key the answer is stored under. */
  key: string,
  /** The current form's row for this answer, if any is left. */
  row: SurveyRow | undefined,
  flatPaths: SurveyFlatPaths,
): DisplayGroup {
  const groupPaths = [getParentPath(key)]
  if (row) {
    groupPaths.push(getParentPath(flatPaths[getRowName(row)] ?? ''))
  }

  for (const groupPath of groupPaths) {
    // An empty path means the root level, which is what we fall back to anyway.
    if (groupPath === '') {
      continue
    }

    const group = findDisplayGroupByPath(output, groupPath)
    if (group) {
      return group
    }
  }

  return output
}

/**
 * It creates display data structure for a given choice-row of a Matrix.
 * As the data is bit different from all other question types, we need to use
 * a special function, not a great traverseSurvey one.
 */
function populateMatrixData(
  survey: SurveyRow[],
  choices: SurveyChoice[],
  submissionData: DataResponse | SubmissionResponse,
  translationIndex: number,
  /** A group you want to add a row of questions to. */
  matrixGroup: DisplayGroup,
  /** The row name. */
  matrixRowName: string,
  /** The submissionData scoped by parent (useful for repeat groups). */
  parentData: SubmissionResponseValue,
  /** Collects the keys displayed here, see `addUnaccountedAnswers`. */
  displayedKeys: Set<string>,
) {
  // This should not happen, as the only DisplayGroup with null name will be of
  // the group_root type, but we need this for the types.
  if (matrixGroup.name === null) {
    return
  }

  // create row display group and add it to matrix group
  const matrixRowLabel = getTranslatedRowLabel(matrixRowName, choices, translationIndex)
  const matrixRowGroupObj = new DisplayGroup(DISPLAY_GROUP_TYPES.group_matrix_row, matrixRowLabel, matrixRowName)
  matrixGroup.children.push(matrixRowGroupObj)

  const flatPaths = getSurveyFlatPaths(survey, true)
  const matrixGroupPath = flatPaths[matrixGroup.name]

  /*
   * Iterate over survey rows to find only ones from inside the matrix.
   * These rows are the questions from the target matrix choice-row, so we find
   * all neccessary pieces of data nd build display data structure for it.
   */
  recordKeys(flatPaths).forEach((questionName) => {
    if (flatPaths[questionName].startsWith(`${matrixGroupPath}/`)) {
      const questionSurveyObj = survey.find((row) => getRowName(row) === questionName)
      // We are only interested in going further if object was found.
      if (typeof questionSurveyObj === 'undefined') {
        return
      }

      // NOTE: Submission data for a Matrix question is kept in an unusal
      // property, so instead of:
      // [PATH/]MATRIX/MATRIX_QUESTION
      // it is stored in:
      // [PATH/]MATRIX_CHOICE/MATRIX_CHOICE_QUESTION
      let questionData: SubmissionResponseValue = null
      const dataProp = `${matrixGroupPath}_${matrixRowName}/${matrixGroup.name}_${matrixRowName}_${questionName}`
      if (submissionData[dataProp]) {
        questionData = submissionData[dataProp]
      } else if (parentData !== null && typeof parentData === 'object' && dataProp in parentData) {
        // Note: If Matrix question is inside a repeat group, the data is stored
        // elsewhere :tableflip:
        questionData = (parentData as { [key: string]: SubmissionResponseValue })[dataProp]
      }

      if (questionData !== null) {
        displayedKeys.add(dataProp)
      }

      const questionObj = new DisplayResponse(
        questionSurveyObj.type,
        getTranslatedRowLabel(questionName, survey, translationIndex),
        questionName,
        flatPaths[questionName],
        getRowListName(questionSurveyObj),
        questionData,
      )
      matrixRowGroupObj.children.push(questionObj)
    }
  })
}

/**
 * Tells which submission key holds a given row's answer, or `undefined` when none
 * does. Not for groups, whose data is assembled from their children (see
 * `getRowData`). Split out so the traversal can record what got displayed.
 */
function findSubmissionKeyForRow(
  name: string,
  survey: SurveyRow[],
  data: DataResponse | SubmissionResponse | null,
): string | undefined {
  // Inside a repeat group the caller only casts the current item to a submission.
  if (data === null || typeof data !== 'object') {
    return undefined
  }

  const path = getSurveyFlatPaths(survey, true)[name]

  if (data[path]) {
    return path
  }
  // Some submissions store an answer under the bare name rather than the full path.
  if (data[name]) {
    return name
  }
  return undefined
}

/**
 * Returns data for given row, works for groups too. Returns `null` for no
 * answer, array for repeat groups and object for regular groups
 */
export function getRowData(
  name: string,
  survey: SurveyRow[],
  data: DataResponse | SubmissionResponse | null,
): SubmissionResponseValue | null {
  if (data === null || typeof data !== 'object') {
    return null
  }

  const answerKey = findSubmissionKeyForRow(name, survey, data)
  if (answerKey !== undefined) {
    return data[answerKey]
  }

  const flatPaths = getSurveyFlatPaths(survey, true)
  const path = flatPaths[name]

  if (path) {
    // we don't really know here if this is a repeat or a regular group
    // so we let the data be the guide (possibly not trustworthy)
    const repeatRowData = getRepeatGroupAnswers(data, path)
    if (repeatRowData.length >= 1) {
      return repeatRowData
    }

    const rowData = getRegularGroupAnswers(data, path)
    if (recordKeys(rowData).length >= 1) {
      return rowData
    }
  }
  return null
}

/**
 * Tells if given row is an immediate child of given group
 */
function isRowFromCurrentGroupLevel(
  rowName: string,
  /** Null for root level rows. */
  groupPath: string | null,
  survey: SurveyRow[],
): boolean {
  const flatPaths = getSurveyFlatPaths(survey, true)
  if (groupPath === null) {
    return flatPaths[rowName] === rowName
  } else {
    return flatPaths[rowName] === `${groupPath}/${rowName}`
  }
}

/**
 * Filters data for items inside the group
 */
function getRegularGroupAnswers(
  data: DataResponse | SubmissionResponse,
  /** With groups e.g. group_person/group_pets/group_pet. */
  targetKey: string,
): { [questionName: string]: SubmissionResponseValue } {
  // The response can be a lot of different things
  const answers: { [questionName: string]: SubmissionResponseValue } = {}
  recordKeys(data).forEach((objKey) => {
    if (typeof objKey === 'string' && objKey.startsWith(`${targetKey}/`)) {
      answers[objKey] = data[objKey]
    }
  })
  return answers
}

function getRowListName(row: SurveyRow | undefined): string | undefined {
  let returnVal
  if (row && recordKeys(row).includes(CHOICE_LISTS.SELECT)) {
    returnVal = row[CHOICE_LISTS.SELECT as keyof SurveyRow]
  }
  if (row && recordKeys(row).includes(CHOICE_LISTS.MATRIX)) {
    returnVal = row[CHOICE_LISTS.MATRIX as keyof SurveyRow]
  }
  if (row && recordKeys(row).includes(CHOICE_LISTS.SCORE)) {
    returnVal = row[CHOICE_LISTS.SCORE as keyof SurveyRow]
  }
  if (row && recordKeys(row).includes(CHOICE_LISTS.RANK)) {
    returnVal = row[CHOICE_LISTS.RANK as keyof SurveyRow]
  }
  if (typeof returnVal === 'string') {
    return returnVal
  }
  return undefined
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
  submission: DataResponse | SubmissionResponse,
  path: string,
): string | null {
  const pathParts = getSupplementalPathParts(path)
  const pathArray = [SUPPLEMENTAL_DETAILS_PROP, pathParts.sourceRowPath]

  if (pathParts.type === 'transcript') {
    // There is always one transcript, not nested in language code object, thus
    // we don't need the language code in the last element of the path.
    pathArray.push('transcript')
    const transcriptObj = get(submission, pathArray, '')
    if (transcriptObj.languageCode === pathParts.languageCode && typeof transcriptObj.value === 'string') {
      return transcriptObj.value
    }
  }

  if (pathParts.type === 'translation') {
    // The last element is `translation_<language code>`, but we don't want
    // the underscore to be there.
    pathArray.push('translation')
    pathArray.push(pathParts.languageCode || '??')

    // Then we add one more nested level
    pathArray.push('value')
    // Moments like these makes you really apprecieate the beauty of lodash.
    const translationText = get(submission, pathArray, '')

    if (translationText) {
      return translationText
    }
  }

  if (pathParts.type === 'qual') {
    // The last element is some random uuid, but we look for `qual`.
    pathArray.push('qual')
    // It is `qual`, so `analysisQuestionUuid` must be there
    pathArray.push(pathParts.analysisQuestionUuid!)
    const foundResponse: SubmissionAnalysisResponse = get(submission, pathArray, {})

    if (foundResponse) {
      // For `qualSelectOne` we get object
      if (typeof foundResponse.value === 'object' && foundResponse.value !== null && 'labels' in foundResponse.value) {
        return foundResponse.value.labels._default
      }

      // Here we handle both `qualSelectMultiple` and `qualTags`, as both are
      // arrays of items
      if (Array.isArray(foundResponse.value) && foundResponse.value.length > 0) {
        const choiceLabels = foundResponse.value.map((item) => {
          if (typeof item === 'object') {
            // For `qualSelectMultiple` we get an array of objects
            return item.labels._default
          } else {
            // For `qualTags` we get an array of strings
            return item
          }
        })

        return choiceLabels.join(', ')
      }

      if (typeof foundResponse.value === 'string' && foundResponse.value !== '') {
        return foundResponse.value
      }

      if (typeof foundResponse.value === 'number') {
        return String(foundResponse.value)
      }

      return null
    }
  }

  if (pathParts.type === 'qualVerification') {
    // It is `qualVerification`, so `analysisQuestionUuid` must be there
    pathArray.push(...['qual', pathParts.analysisQuestionUuid!])

    const foundResponse: SubmissionAnalysisResponse = get(submission, pathArray, {})
    if (typeof foundResponse.verified === 'boolean') {
      return foundResponse.verified === true ? t('Yes') : t('No')
    }
  }

  // If there is no value it could be either WIP or intentional. We want to be
  // clear about the fact it could be intentionally empty.
  return null
}

export default {
  DISPLAY_GROUP_TYPES,
  getSubmissionDisplayData,
  getRepeatGroupAnswers,
}

export function getQuestionXPath(surveyRows: SurveyRow[], rowName: string) {
  const flatPaths = getSurveyFlatPaths(surveyRows, true)
  return flatPaths[rowName]
}

/**
 * In given submission data, it finds provided attachment, sets its `is_deleted`
 * flag to `true` and then returns the updated submission data.
 */
export function markAttachmentAsDeleted(
  submissionData: DataResponse | SubmissionResponse,
  targetAttachmentUid: string,
): DataResponse | SubmissionResponse {
  const data = clonedeep(submissionData)
  const targetAttachment = data._attachments.find((item) => item.uid === targetAttachmentUid)
  data._attachments.forEach((attachment) => {
    if (
      attachment.uid === targetAttachment?.uid &&
      attachment.question_xpath === targetAttachment?.question_xpath &&
      attachment.filename === targetAttachment?.filename
    ) {
      attachment.is_deleted = true
    }
  })

  return data
}

/**
 * Removes empty objects (and arrays) from the given object recursively without mutating the original object.
 */
export function removeEmptyObjects(originalObj: { [key: string]: any }) {
  let obj = clonedeep(originalObj)
  if (typeof obj !== 'object' || obj === null) {
    return obj
  }
  // Recursively process each property
  for (const key in obj) {
    obj[key] = removeEmptyObjects(obj[key])
    // Remove the property if it is an empty object
    if (typeof obj[key] === 'object' && obj[key] !== null && recordKeys(obj[key]).length === 0) {
      // This is a safer way to do `delete obj[key]`:
      obj = Object.fromEntries(recordEntries(obj).filter(([objKey]) => objKey !== key))
    }
  }
  return obj
}

/**
 * This function removes all possible empty objects from given submission supplemental details. If there were only empty
 * objects in it (nested), you can end up with an empty object as an final outcome.
 */
export function removeEmptyFromSupplementalDetails(supplementalDetails: SubmissionSupplementalDetails) {
  const details = clonedeep(supplementalDetails)

  // Step 1: Remove responses to qual questions that are:
  // a) "no response" or "response removed", i.e. empty string, `null`, empty array, etc.
  // b) responses to qual questions that are deleted
  for (const detailsKey of recordKeys(details)) {
    if (details[detailsKey].qual) {
      details[detailsKey].qual = Object.fromEntries(
        Object.entries(details[detailsKey].qual).filter(
          ([_, qualResponse]) =>
            qualResponse.value !== '' &&
            qualResponse.value !== null &&
            !(Array.isArray(qualResponse.value) && qualResponse.value.length === 0) &&
            qualResponse.options?.deleted !== true,
        ),
      )
    }
  }

  // Step 2: Remove all empty objects and arrays (recursively)
  return removeEmptyObjects(details)
}

// If attachment for this submission response is deleted, and there is no NLP related features (transcript,
// translations or qualitative analysis questions) being used with it, we don't want to show the button, as it doesn't
// make sense to open the processing view for it.
// We use `removeEmptyFromSupplementalDetails`, because submission has some leftover "empty" data after removing
// features and we want to avoid acting on false positives here (e.g. user added transcript, then deleted it = we
// don't want to display the button).
export function shouldProcessingBeAccessible(
  submissionData: DataResponse | SubmissionResponse,
  mediaAttachment: SubmissionAttachment,
) {
  const hasProcessingFeatures =
    typeof submissionData._supplementalDetails !== 'undefined' &&
    recordKeys(removeEmptyFromSupplementalDetails((submissionData as any)._supplementalDetails)).length > 0

  return !mediaAttachment.is_deleted || hasProcessingFeatures
}

// Counts the number of each attachment type for the given array of submissions
// Returns semi-colon seperated string in the form of `<number_of_attachments> <attachment_type>;` ending with a period
// for each attachment type present
export function getMediaCount(selectedSubmissions: DataResponse[] | SubmissionResponse[]) {
  let totalImages = 0
  let totalVideos = 0
  let totalFiles = 0
  let totalAudios = 0

  selectedSubmissions.forEach((submission) => {
    submission._attachments.forEach((attachment) => {
      const mimetype = attachment.mimetype!
      if (mimetype.includes('image/')) {
        totalImages++
      } else if (mimetype.includes('video/')) {
        totalVideos++
      } else if (mimetype.includes('application/')) {
        totalFiles++
      } else if (mimetype.includes('audio/')) {
        totalAudios++
      }
    })
  })

  const mediaTypes = [
    { count: totalImages, singular: t('image'), plural: t('images') },
    { count: totalVideos, singular: t('video'), plural: t('videos') },
    { count: totalAudios, singular: t('audio'), plural: t('audios') },
    { count: totalFiles, singular: t('file'), plural: t('files') },
  ]
  const result = mediaTypes
    .filter(({ count }) => count > 0)
    .map(({ count, singular, plural }) => {
      // If done with a ternary operator webpack gives a weird undefined error
      if (count > 1) {
        return `##media## ${plural}`.replace('##media##', String(count))
      } else {
        return `##media## ${singular}`.replace('##media##', String(count))
      }
    })
  return result.join('; ') + '.'
}

export function getBackgroundAudioAttachment(
  asset: AssetResponse,
  submission: DataResponse | SubmissionResponse,
): undefined | SubmissionAttachment {
  const backgroundAudioName = getBackgroundAudioQuestionName(asset)

  if (backgroundAudioName && submission && recordKeys(submission).includes(backgroundAudioName)) {
    const response = submission[backgroundAudioName]
    if (typeof response === 'string') {
      const mediaAttachment = getMediaAttachment(submission, response, backgroundAudioName)
      if (typeof mediaAttachment === 'string') {
        return undefined
      } else {
        return mediaAttachment
      }
    }
  }

  return undefined
}

/**
 * Checks if a supplemental details column contains unaccepted automatic content
 * (transcript or translation that was auto-generated but not yet accepted by user).
 *
 * Uses the `pendingReview` flag from the backend API endpoint, which is set to `true`
 * when the latest version of a transcript/translation lacks a `_dateAccepted` timestamp.
 *
 * @param submission - The submission data
 * @param columnKey - The supplemental details column key (e.g., '_supplementalDetails/audio_question/transcript_en')
 * @returns true if the column has unaccepted automatic content, false otherwise
 */
export function hasUnacceptedAutomaticContent(
  submission: DataResponse | SubmissionResponse,
  columnKey: string,
): boolean {
  if (!columnKey.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
    return false
  }

  const pathParts = getSupplementalPathParts(columnKey)

  // Only transcript and translation can have unaccepted automatic content
  if (pathParts.type !== 'transcript' && pathParts.type !== 'translation') {
    return false
  }

  // Check if submission has supplemental details
  if (!submission._supplementalDetails || typeof submission._supplementalDetails !== 'object') {
    return false
  }

  const sourceRowData = get(submission._supplementalDetails, pathParts.sourceRowPath, null)

  if (!sourceRowData || typeof sourceRowData !== 'object') {
    return false
  }

  // Check for pending review flag in transcripts
  if (pathParts.type === 'transcript') {
    const transcriptData = sourceRowData.transcript
    if (!transcriptData || typeof transcriptData !== 'object') {
      return false
    }

    // A question holds a single transcript, not one per language, so it belongs
    // only to the column matching its language. Without this check a pending
    // transcript puts a Review button in every transcript column of the row.
    if (transcriptData.languageCode !== pathParts.languageCode) {
      return false
    }

    // The backend returns pendingReview: true when content is awaiting acceptance
    return Boolean(transcriptData.pendingReview)
  }

  // Check for pending review flag in translations
  if (pathParts.type === 'translation') {
    const translationData = sourceRowData.translation
    if (!translationData || typeof translationData !== 'object') {
      return false
    }

    const languageTranslation = translationData[pathParts.languageCode || '']
    if (!languageTranslation || typeof languageTranslation !== 'object') {
      return false
    }

    // The backend returns pendingReview: true when content is awaiting acceptance
    return Boolean(languageTranslation.pendingReview)
  }

  return false
}

/**
 * Checks if any of given submissions has content awaiting approval in given
 * supplemental details column, i.e. if a bulk approve action would do anything
 * at all.
 */
export function hasAnyUnacceptedAutomaticContent(
  submissions: Array<DataResponse | SubmissionResponse>,
  columnKey: string,
): boolean {
  return submissions.some((submission) => hasUnacceptedAutomaticContent(submission, columnKey))
}
