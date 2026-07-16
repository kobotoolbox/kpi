import type { Filter } from 'react-table'
import type { BulkActionResponse } from '#/api/models/bulkActionResponse'
import {
  getRowName,
  getSurveyFlatPaths,
  getVirtualSupplementalFieldsForBulkActions,
  injectSupplementalRowsIntoListOfRows,
} from '#/assetUtils'
import { getSupplementalPathParts } from '#/components/processing/processingUtils'
import {
  DROPDOWN_FILTER_QUESTION_TYPES,
  EXCLUDED_COLUMNS,
  FILTER_EXACT_TYPES,
  SUBMISSION_ACTIONS_ID,
  TEXT_FILTER_QUESTION_IDS,
  TEXT_FILTER_QUESTION_TYPES,
  VALIDATION_STATUS_ID_PROP,
} from '#/components/submissions/tableConstants'
import { ValidationStatusAdditionalName } from '#/components/submissions/validationStatus.constants'
import {
  ADDITIONAL_SUBMISSION_PROPS,
  GROUP_TYPES_BEGIN,
  GROUP_TYPES_END,
  META_QUESTION_TYPES,
  QUESTION_TYPES,
  SUPPLEMENTAL_DETAILS_PROP,
} from '#/constants'
import type { AnyRowTypeName } from '#/constants'
import type { AssetResponse, SubmissionResponse, SurveyRow } from '#/dataInterface'
import { recordKeys, recordValues } from '#/utils'

const ATTACHMENT_QUESTION_TYPES = new Set<AnyRowTypeName>([
  QUESTION_TYPES.audio.id,
  QUESTION_TYPES['background-audio'].id,
  QUESTION_TYPES.image.id,
  QUESTION_TYPES.video.id,
  QUESTION_TYPES.file.id,
])

/**
 * Builds a human-readable Data Table column label
 */
export function getColumnLabel(
  asset: AssetResponse,
  key: string,
  showGroupName: boolean,
  translationIndex = 0,
): string {
  // NOTE: Some very old code has something to do with nonexistent/negative
  // translationIndex. No idea what is that. It does influences returned value.
  const showLabels = translationIndex > -1

  if (asset.content?.survey === undefined) {
    return key
  }

  let question
  let questionPath: string[] = []
  if (key.includes('/')) {
    questionPath = key.split('/')
    question = asset.content.survey.find(
      (o) => o.name === questionPath[questionPath.length - 1] || o.$autoname === questionPath[questionPath.length - 1],
    )
  } else {
    questionPath = [key]
    question = asset.content.survey.find((o) => o.name === key || o.$autoname === key)
  }

  // This identifies the supplemental details column. For such column question
  // was not found by the `key` provided (because it starts with
  // `SUPPLEMENTAL_DETAILS_PROP`) - we will find the question based on the value
  // returned by `getSupplementalPathParts` later.
  if (question === undefined && questionPath[0] === SUPPLEMENTAL_DETAILS_PROP) {
    const supplementalPathParts = getSupplementalPathParts(key)

    const sourceName = supplementalPathParts.sourceRowPath

    // Supplemental details keys are built like one of:
    // - prefix / source question name / transcript _ language code
    // - prefix / source question name / translated _ language code
    // e.g. `_supplementalDetails/Wie_heisst_du/transcript_de`
    const sourceQuestionLabel = getColumnLabel(asset, sourceName, showGroupName, translationIndex)

    if (supplementalPathParts.type === 'transcript') {
      return `${t('transcript')} (${supplementalPathParts.languageCode}) | ${sourceQuestionLabel}`
    } else if (supplementalPathParts.type === 'translation') {
      return `${t('translation')} (${supplementalPathParts.languageCode}) | ${sourceQuestionLabel}`
    } else {
      // this is absurd, to undo what `injectSupplementalRowsIntoListOfRows()`
      // did when the back end already provided what's needed in the first
      // place
      const dtpath = key.slice('_supplementalDetails/'.length)
      // FIXME: pass the entire object (or at least the label!) provided by
      // the back end through to this function, without doing all this nonsense
      const analysisQuestion = asset.analysis_form_json?.additional_fields.find((f) => f.dtpath === dtpath)

      // Here we want to produce "Verified | Analysis question | Source question" type of label
      if (analysisQuestion?.type === 'qualVerification') {
        const parentQuestion = asset.analysis_form_json?.additional_fields.find(
          (f) => f.dtpath === analysisQuestion.source,
        )
        if (parentQuestion?.label) {
          return `${t('Verified')} | ${parentQuestion.label} | ${sourceQuestionLabel}`
        }
        return `${t('Verified')} | ${sourceQuestionLabel}`
      }

      if (analysisQuestion?.label) {
        return `${analysisQuestion.label} | ${sourceQuestionLabel}`
      }
    }
  }

  // Background audio questions don't have labels, but we need something to be
  // displayed to users.
  if (key === QUESTION_TYPES['background-audio'].id && showLabels) {
    return t('Background audio')
  }

  if (key === SUBMISSION_ACTIONS_ID) {
    return t('Multi-select checkboxes column')
  }
  if (key === VALIDATION_STATUS_ID_PROP) {
    return t('Validation')
  }

  let label = key

  if (key.includes('/')) {
    const splitK = key.split('/')
    label = splitK[splitK.length - 1]
  }
  if (question?.label && showLabels && question.label[translationIndex]) {
    label = question.label[translationIndex]
  }
  // show Groups in labels, when selected
  if (showGroupName && questionPath && key.includes('/')) {
    let gLabels = questionPath.join(' / ')

    if (showLabels) {
      const gT = questionPath.map((g) => {
        const x = asset.content?.survey?.find((o) => o.name === g || o.$autoname === g)
        if (x?.label && x.label[translationIndex]) {
          return x.label[translationIndex]
        }

        return g
      })
      gLabels = gT.join(' / ')
    }
    return gLabels
  }

  return label
}

/**
 * Returns concatenated HXL tags for a column, or null when none exist
 */
export function getColumnHXLTags(survey: SurveyRow[], key: string) {
  const colQuestion: SurveyRow | undefined = survey.find((question) => question.$autoname === key)
  if (!colQuestion || !colQuestion.tags) {
    return null
  }
  const HXLTags: string[] = []
  colQuestion.tags.forEach((tag) => {
    if (tag.startsWith('hxl:')) {
      HXLTags.push(tag.replace('hxl:', ''))
    }
  })
  if (HXLTags.length === 0) {
    return null
  } else {
    return HXLTags.join('')
  }
}

/**
 * Finds the field name used for background audio, if the form has one
 */
export function getBackgroundAudioQuestionName(asset: AssetResponse): string | null {
  return asset?.content?.survey?.find((item) => item.type === QUESTION_TYPES['background-audio'].id)?.name || null
}

/**
 * Selects a value for a Data Table column key from submission data.
 *
 * For repeat/group data, some submissions store answers under a parent path
 * (e.g. `group_a/group_b`) rather than the full question key
 * (`group_a/group_b/question`). This helper returns the closest matching
 * container payload in such cases.
 */
export function selectNestedRow(row: SubmissionResponse, key: string, rootParentGroup: string | undefined) {
  // Supplemental details should always use exact keys.
  if (key.startsWith(SUPPLEMENTAL_DETAILS_PROP)) {
    return row[key]
  }

  // Prefer exact key lookup whenever available.
  if (Object.prototype.hasOwnProperty.call(row, key)) {
    return row[key]
  }

  // If exact key is missing, find the closest existing parent path.
  // Example: key `group_a/group_b/question` with data stored at `group_a/group_b`.
  const keyPathSegments = key.split('/')
  for (let i = keyPathSegments.length - 1; i >= 1; i--) {
    const parentPath = keyPathSegments.slice(0, i).join('/')
    if (Object.prototype.hasOwnProperty.call(row, parentPath)) {
      const parentValue = row[parentPath]

      // Parent fallback is only valid for container-like values (repeat/group payloads).
      // This avoids accidentally targeting an unrelated scalar from a shorter matching path.
      if (Array.isArray(parentValue) || (typeof parentValue === 'object' && parentValue !== null)) {
        return parentValue
      }
    }
  }

  // Backward-compatible fallback for root-level repeat groups.
  if (rootParentGroup && Object.prototype.hasOwnProperty.call(row, rootParentGroup)) {
    const rootParentValue = row[rootParentGroup]
    if (Array.isArray(rootParentValue) || (typeof rootParentValue === 'object' && rootParentValue !== null)) {
      return rootParentValue
    }
  }

  return row[key]
}

/**
 * Checks whether a value is meaningfully present in submission data
 */
function hasNonEmptyValue(value: unknown): boolean {
  return value !== undefined && value !== null && value !== ''
}

/**
 * Checks which path(s) attachment metadata links a basename to.
 *
 * Filename/value matches alone are unsafe for dedupe. We use
 * `_attachments.question_xpath` to confirm whether evidence points to no path,
 * one path, or both paths.
 */
function getAttachmentPathEvidence(
  submission: SubmissionResponse,
  legacyKey: string,
  currentPath: string,
  basename: string,
): 'none' | 'single' | 'both' {
  const matchingAttachments = (submission._attachments || []).filter(
    (attachment) =>
      !attachment.is_deleted &&
      attachment.media_file_basename === basename &&
      (attachment.question_xpath === legacyKey || attachment.question_xpath === currentPath),
  )

  const hasLegacyPathAttachment = matchingAttachments.some((attachment) => attachment.question_xpath === legacyKey)
  const hasCurrentPathAttachment = matchingAttachments.some((attachment) => attachment.question_xpath === currentPath)

  if (hasLegacyPathAttachment && hasCurrentPathAttachment) {
    return 'both'
  }

  if (hasLegacyPathAttachment || hasCurrentPathAttachment) {
    return 'single'
  }

  return 'none'
}

/**
 * Decides if a legacy attachment column is safe to drop.
 *
 * We only collapse stale/current columns when metadata strongly suggests they
 * are the same field. Any conflict (different values or evidence on both
 * paths) keeps the legacy column.
 */
function shouldDropLegacyAttachmentColumn(
  submissions: SubmissionResponse[],
  legacyKey: string,
  matchingCurrentPaths: string[],
): boolean {
  // Only collapse legacy path when there is strong evidence from attachment
  // metadata that old/new keys mirror the same field.
  // Keep the legacy key if values differ, or if attachment metadata indicates
  // both paths are genuinely present.
  let hasMirroredAttachmentEvidence = false

  for (const submission of submissions) {
    const legacyValue = submission[legacyKey]
    if (!hasNonEmptyValue(legacyValue)) {
      continue
    }

    for (const currentPath of matchingCurrentPaths) {
      const currentValue = submission[currentPath]
      if (!hasNonEmptyValue(currentValue)) {
        continue
      }

      if (legacyValue !== currentValue) {
        return false
      }

      const evidence = getAttachmentPathEvidence(submission, legacyKey, currentPath, String(legacyValue))
      if (evidence === 'both') {
        return false
      }

      if (evidence === 'single') {
        hasMirroredAttachmentEvidence = true
      }
    }
  }

  return hasMirroredAttachmentEvidence
}

/**
 * Indexes current attachment question paths by leaf question name.
 *
 * Old submissions may still contain stale paths from renamed groups. This map
 * lets dedupe quickly find candidate current paths for a legacy key.
 */
function buildCurrentAttachmentPathsByLeaf(
  asset: AssetResponse,
  flatPaths: Record<string, string>,
): Map<string, string[]> {
  const currentAttachmentPathsByLeaf = new Map<string, string[]>()

  asset.content?.survey?.forEach((row) => {
    if (!ATTACHMENT_QUESTION_TYPES.has(row.type)) {
      return
    }

    const rowName = getRowName(row)
    const currentPath = flatPaths[rowName]
    if (!currentPath) {
      return
    }

    const existingPaths = currentAttachmentPathsByLeaf.get(rowName) || []
    if (!existingPaths.includes(currentPath)) {
      currentAttachmentPathsByLeaf.set(rowName, [...existingPaths, currentPath])
    }
  })

  return currentAttachmentPathsByLeaf
}

/**
 * Decides if a column should stay after stale attachment dedupe checks.
 *
 * Keeps `getAllDataColumns` readable by isolating the keep/drop decision for
 * one column, including safety checks for missing submissions and no matches.
 */
function shouldKeepColumnAfterAttachmentDedupe(
  key: string,
  allColumns: string[],
  currentAttachmentPathsByLeaf: Map<string, string[]>,
  submissions?: SubmissionResponse[],
): boolean {
  const keyParts = key.split('/')
  const leafName = keyParts[keyParts.length - 1]
  const currentPaths = currentAttachmentPathsByLeaf.get(leafName)

  if (!currentPaths || currentPaths.includes(key)) {
    return true
  }

  const matchingCurrentPaths = currentPaths.filter((currentPath) => allColumns.includes(currentPath))
  if (matchingCurrentPaths.length === 0 || !submissions || submissions.length === 0) {
    return true
  }

  return !shouldDropLegacyAttachmentColumn(submissions, key, matchingCurrentPaths)
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
  bulkActions?: BulkActionResponse[],
) {
  if (asset.content?.survey === undefined) {
    throw new Error('Asset has no content')
  }

  const flatPaths = getSurveyFlatPaths(asset.content.survey, false, true)

  // add all questions from the survey definition
  let output = recordValues(flatPaths)

  if (submissions) {
    // Gather unique columns from all provided submissions and add them to output
    const dataKeys = recordKeys(submissions.reduce((result, obj) => Object.assign(result, obj), {}))
    output = [...new Set([...output, ...dataKeys])]
  }

  // Put `start` and `end` first
  if (output.indexOf(META_QUESTION_TYPES.end)) {
    output.unshift(output.splice(output.indexOf(META_QUESTION_TYPES.end), 1)[0])
  }
  if (output.indexOf(META_QUESTION_TYPES.start)) {
    output.unshift(output.splice(output.indexOf(META_QUESTION_TYPES.start), 1)[0])
  }

  // In `table.tsx` we override the ordering of few columns, this one too. Some other places rely on ordering coming
  // from this function, so we still want to ensure `meta/rootUuid` is the very last column
  if (output.indexOf(ADDITIONAL_SUBMISSION_PROPS['meta/rootUuid']) > -1) {
    output.push(output.splice(output.indexOf(ADDITIONAL_SUBMISSION_PROPS['meta/rootUuid']), 1)[0])
  }
  // TODO: Ordering of columns is being used in few places (columns of Data Table, "Hide fields" dropdown). Some places
  // rely on order this function spits out, but some override it or user other means. Let's make SSOT for columns order
  // please :pray: - see https://linear.app/kobotoolbox/issue/DEV-1480/make-order-and-list-of-columns-come-from-single-place

  // exclude some technical non-data columns
  output = output.filter((key) => EXCLUDED_COLUMNS.includes(key) === false)

  // Deduplicate stale attachment keys from old submissions when current schema
  // has the same question under a different (usually renamed-group) path.
  // Keep this conservative by collapsing only when old and current keys share
  // a non-empty overlapping value in at least one submission.
  const currentAttachmentPathsByLeaf = buildCurrentAttachmentPathsByLeaf(asset, flatPaths)

  output = output.filter((key) =>
    shouldKeepColumnAfterAttachmentDedupe(key, output, currentAttachmentPathsByLeaf, submissions),
  )

  // exclude notes
  output = output.filter((key) => {
    const foundPathKey = recordKeys(flatPaths).find((pathKey) => flatPaths[pathKey] === key)

    // no path means this definitely is not a note type
    if (!foundPathKey) {
      return true
    }

    const foundNoteRow = asset?.content?.survey?.find(
      (row) =>
        typeof foundPathKey !== 'undefined' && foundPathKey === getRowName(row) && row.type === QUESTION_TYPES.note.id,
    )

    if (typeof foundNoteRow !== 'undefined') {
      // filter out this row as this is a note type
      return false
    }

    return true
  })

  // exclude kobomatrix rows as data is not directly tied to them, but
  // to rows user answered to, thus making these columns always empty
  const excludedMatrixKeys: string[] = []
  let isInsideKoboMatrix = false
  asset.content.survey.forEach((row) => {
    if (row.type === GROUP_TYPES_BEGIN.begin_kobomatrix) {
      isInsideKoboMatrix = true
    } else if (row.type === GROUP_TYPES_END.end_kobomatrix) {
      isInsideKoboMatrix = false
    } else if (isInsideKoboMatrix) {
      const rowPath = flatPaths[getRowName(row)]
      excludedMatrixKeys.push(rowPath)
    }
  })
  output = output.filter((key) => excludedMatrixKeys.includes(key) === false)

  // Exclude repeat groups and regular groups as all of their data is handled
  // by children rows.
  // This also fixes the issue when a repeat group in older version becomes
  // a regular group in new form version (with the same name), and the Table
  // was displaying "[object Object]" as responses.
  const excludedGroups: string[] = []
  const flatPathsWithGroups = getSurveyFlatPaths(asset.content.survey, true)
  asset.content.survey.forEach((row) => {
    if (row.type === GROUP_TYPES_BEGIN.begin_repeat || row.type === GROUP_TYPES_BEGIN.begin_group) {
      const rowPath = flatPathsWithGroups[getRowName(row)]
      excludedGroups.push(rowPath)
    }
  })
  output = output.filter((key) => excludedGroups.includes(key) === false)

  const virtualSupplementalFields = getVirtualSupplementalFieldsForBulkActions(bulkActions)
  output = injectSupplementalRowsIntoListOfRows(asset, output, virtualSupplementalFields)
  return output
}

export interface TableFilterQuery {
  queryString: string
  queryObj: {
    [key: string]: string | null | { $in: number[] } | { $regex: string; $options: string }
  }
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
  filters: Filter[],
): TableFilterQuery {
  const output: TableFilterQuery = {
    queryString: '',
    queryObj: {},
  }

  filters.forEach((filter) => {
    switch (filter.id) {
      case '_id': {
        output.queryObj[filter.id] = { $in: [Number.parseInt(filter.value)] }
        break
      }
      case VALIDATION_STATUS_ID_PROP: {
        if (filter.value === ValidationStatusAdditionalName.no_status) {
          output.queryObj[filter.id] = null
        } else {
          output.queryObj[filter.id] = filter.value
        }
        break
      }
      // Apart from few exceptions in above cases, we tend to treat all columns
      // (`filter.id`s) with the same algorithm
      default: {
        // We assume `filter.id` is the question name (Data Table column name)
        const foundRow = survey.find((row) => getRowName(row) === filter.id)

        // Some question types needs the data to be filtered by exact values
        // (e.g. "yes" shouldn't mach "yessica" or "yes and no")
        if (foundRow && FILTER_EXACT_TYPES.includes(foundRow.type)) {
          output.queryObj[filter.id] = {
            $regex: `^${filter.value}$`,
            $options: 'i',
          }
        } else {
          output.queryObj[filter.id] = { $regex: filter.value, $options: 'i' }
        }
        break
      }
    }
  })

  if (recordKeys(output.queryObj).length > 0) {
    output.queryString = JSON.stringify(output.queryObj)
  }

  return output
}

/**
 * For checking if given column from Data Table should display a text input
 * filter. It works for columns associated with form questions and for other
 * columns too (e.g. submission metadata).
 */
export function isTableColumnFilterableByTextInput(questionType: AnyRowTypeName | undefined, columnId: string) {
  return (
    (questionType && TEXT_FILTER_QUESTION_TYPES.includes(questionType)) || TEXT_FILTER_QUESTION_IDS.includes(columnId)
  )
}

/**
 * For checking if given column from Data Table should display a dropdown
 * filter.
 */
export function isTableColumnFilterableByDropdown(questionType: AnyRowTypeName | undefined) {
  return questionType && DROPDOWN_FILTER_QUESTION_TYPES.includes(questionType)
}
