import type { ResponseManualQualActionParams } from '#/api/models/responseManualQualActionParams'
import { LOCALLY_EDITED_PLACEHOLDER_UUID } from '#/components/processing/common/constants'
import type { IconName } from '#/k-icons'

export const AUTO_SAVE_TYPING_DELAY = 3000

// We need this singled out as const, because some other parts of code (not
// related to Qualitative Analysis) need to exclude notes from output.
export const QUAL_NOTE_TYPE: ResponseManualQualActionParams['type'] = 'qualNote'

interface AnalysisLabels {
  _default: string
  [langCode: string]: string
}

/**
 * Options object used by questions and choices. We mainly use it for marking
 * things as deleted.
 */
interface AnalysisQuestionOptions {
  /**
   * We mark questions as deleted instead of removing them, because we still
   * need them to understand the data (e.g. we store `qualSelectOne` responses
   * as `uuid`s of given choice, so without the question definition, there is no
   * way to understand what was selected).
   */
  deleted?: boolean
}

interface AnalysisQuestionChoice {
  labels: AnalysisLabels
  uuid: string
  options?: AnalysisQuestionOptions
}

/** Analysis question definition base type containing all common properties. */
export interface AnalysisQuestionBase {
  type: ResponseManualQualActionParams['type']
  labels: AnalysisLabels
  uuid: string
  options?: AnalysisQuestionOptions
  /** The survey question that this analysis questions is for. */
  xpath: string
}

/** Analysis question definition from the asset's schema (i.e. from Back end) */
export interface AnalysisQuestionSchema extends AnalysisQuestionBase {
  // 'by_question#survey'
  scope: string
  choices?: AnalysisQuestionChoice[]
}

/**
 * This is a response object for `qualSelectOne` and `qualSelectMultiple`.
 * Besides `uuid` of a choice, it also has `labels`. It makes it easier to
 * display these responses in the UI.
 */
interface AnalysisResponseSelectXValue {
  labels: AnalysisLabels
  /** The `uuid` of selected `AnalysisQuestionChoice`. */
  val: string
} /**
 * A lot of options, because:
 * - `qualTags` returns `string[]` (`[]` for empty)
 * - `qualText` returns `string` (`''` for empty)
 * - `qualInteger` returns `number` (`null` for empty)
 * - `qualSelectOne` returns `AnalysisResponseSelectXValue` (dunno for empty, as there's a bug: https://linear.app/kobotoolbox/issue/DEV-40/cant-unselect-qual-select-one-question-response)
 * - `qualSelectMultiple` returns `AnalysisResponseSelectXValue[]` (`[]` for empty)
 */
type AnalysisResponseValue =
  | string
  | string[]
  | number
  | null
  | AnalysisResponseSelectXValue
  | AnalysisResponseSelectXValue[]

/**
 * This is the object that is returned from interacting with the data endpoint
 * (`/api/v2/assets/:uid/data`), it will be inside the `_supplementalDetails`
 * object for each appropiate submission. It's similar to `AnalysisResponse`,
 * but with more detailed `val` for `qualSelectOne` and `qualSelectMultiple`
 * - containing both `uuid` and `labels` object.
 */
export interface SubmissionAnalysisResponse extends AnalysisQuestionBase {
  value: AnalysisResponseValue
  // There can be a `scope` property here, but we have no use of it on FE
  scope?: 'by_question#survey'
}

/**
 * The definition is the object that tells us what kind of questions are
 * internally available for being created, e.g. a `qualInteger` question type.
 */
export interface ResponseManualQualActionParamsDefinition {
  type: ResponseManualQualActionParams['type']
  label: string
  icon: IconName
  /** Tells the UI to display it in separate section in dropdown. */
  isAutomated?: boolean
  /** to see if all required data was provided. */
  additionalFieldNames?: Array<'keywords' | 'source' | 'choices'>
  placeholder: ResponseManualQualActionParams
}

/**
 * Note: the order here matters - it influnces the order of the dropdown for
 * adding questions and possibly other UI elements.
 */
export const ANALYSIS_QUESTION_TYPES: ResponseManualQualActionParamsDefinition[] = [
  {
    type: 'qualTags',
    label: t('Tags'),
    icon: 'tag',
    placeholder: {
      type: 'qualTags',
      uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
      labels: {
        _default: '',
      },
    },
  },
  {
    type: 'qualText',
    label: t('Text'),
    icon: 'qt-text',
    placeholder: {
      type: 'qualText',
      uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
      labels: {
        _default: '',
      },
    },
  },
  {
    type: 'qualInteger',
    label: t('Number'),
    icon: 'qt-number',
    placeholder: {
      type: 'qualInteger',
      uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
      labels: {
        _default: '',
      },
    },
  },
  {
    type: 'qualSelectOne',
    label: t('Single choice'),
    icon: 'qt-select-one',
    additionalFieldNames: ['choices'],
    placeholder: {
      type: 'qualSelectOne',
      uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
      labels: {
        _default: '',
      },
      choices: [],
    },
  },
  {
    type: 'qualSelectMultiple',
    label: t('Multiple choice'),
    icon: 'qt-select-many',
    additionalFieldNames: ['choices'],
    placeholder: {
      type: 'qualSelectMultiple',
      uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
      labels: {
        _default: '',
      },
      choices: [],
    },
  },
  {
    type: 'qualNote',
    label: t('Note'),
    icon: 'qt-note',
    placeholder: {
      type: 'qualNote',
      uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
      labels: {
        _default: '',
      },
    },
  },
  // TODO: we temporarily hide Keyword Search from the UI until
  // https://github.com/kobotoolbox/kpi/issues/4594 is done
  // {
  //   type: 'qualAutoKeywordCount',
  //   label: t('Keyword search'),
  //   icon: 'tag',
  //   isAutomated: true,
  //   additionalFieldNames: ['keywords', 'source'],
  //   placeholder: {
  //     type: 'qualAutoKeywordCount',
  //     uuid: LOCALLY_EDITED_PLACEHOLDER_UUID,
  //     labels: {
  //       _default: '',
  //     },
  //   },
  // },
]
