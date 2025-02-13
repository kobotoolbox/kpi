import type {IconName} from 'jsapp/fonts/k-icons';
import type {LanguageCode} from 'js/components/languages/languagesStore';

export const AUTO_SAVE_TYPING_DELAY = 3000;

/**
 * To differentiate these question types from the ones we use in Form Builder,
 * we prefix them with `qual_` (coming from "qualitative analysis question").
 */
export type AnalysisQuestionType =
  | 'qual_auto_keyword_count'
  | 'qual_note'
  | 'qual_integer'
  | 'qual_select_multiple'
  | 'qual_select_one'
  | 'qual_tags'
  | 'qual_text';

// We need this singled out as const, because some other parts of code (not
// related to Qualitative Analysis) need to exclude notes from output.
export const QUAL_NOTE_TYPE: AnalysisQuestionType = 'qual_note';

interface AnalysisLabels {
  _default: string;
  [langCode: string]: string;
}

/**
 * Options object used by questions and choices. We mainly use it for marking
 * things as deleted.
 */
interface AnalysisQuestionOptions {
  /**
   * We mark questions as deleted instead of removing them, because we still
   * need them to understand the data (e.g. we store `qual_select_one` responses
   * as `uuid`s of given choice, so without the question definition, there is no
   * way to understand what was selected).
   */
  deleted?: boolean;
}

interface AnalysisQuestionChoice {
  labels: AnalysisLabels;
  uuid: string;
  options?: AnalysisQuestionOptions;
}

/**
 * This is a sum of all different possible fields for multiple question types.
 *
 * TODO: find a TypeScript way to make make this better, i.e. instead of all
 * additional fields being optional, ideally this would be defined at per-type
 * basis with each field being required. Current solution works, but there is
 * a risk (a very tiny risk) of adding incompatible fields to the question (e.g.
 * adding `isSearching` to `qual_select_one`).
 */
export interface AdditionalFields {
  /** A list of keywords to search for. */
  keywords?: string[];
  /** Used for `qual_auto_keyword_count` question to indicate search in progress. */
  isSearching?: boolean;
  /** The transcript or translation source for the search. */
  source?: LanguageCode;
  /** For the `qual_seleect_one` and `qual_select_multiple` question types */
  choices?: AnalysisQuestionChoice[];
}

/** Analysis question definition base type containing all common properties. */
export interface AnalysisQuestionBase {
  type: AnalysisQuestionType;
  labels: AnalysisLabels;
  uuid: string;
  options?: AnalysisQuestionOptions;
  /** The survey question that this analysis questions is for. */
  xpath: string;
}

/** Analysis question definition from the asset's schema (i.e. from Back end) */
export interface AnalysisQuestionSchema extends AnalysisQuestionBase {
  // 'by_question#survey'
  scope: string;
  choices?: AnalysisQuestionChoice[];
}

/**
 * An instance of analysis question. We use the same object for the question
 * and the response.
 *
 * For example this coulde be a `qual_integer` question with label "How many
 * pauses did the responded take?" and response "7".
 */
export interface AnalysisQuestionInternal extends AnalysisQuestionBase {
  additionalFields?: AdditionalFields;
  isDraft?: boolean;
  /**
   * Some types use an array of strings (e.g. `qual_select_multiple` and
   * `qual_tags`).
   */
  response: string | string[];
}

/** Analysis question response (to a question defined as `uuid`) from Back end. */
export interface AnalysisRequest {
  type: AnalysisQuestionType;
  uuid: string;
  /** `null` is for `qual_integer` */
  val: string | string[] | number | null;
}

/**
 * This is a response object for `qual_select_one` and `qual_select_multiple`.
 * Besides `uuid` of a choice, it also has `labels`. It makes it easier to
 * display these responses in the UI.
 */
interface AnalysisResponseSelectXValue {
  labels: AnalysisLabels;
  /** The `uuid` of selected `AnalysisQuestionChoice`. */
  val: string;
}

/**
 * A lot of options, because:
 * - `qual_tags` returns `string[]`
 * - `qual_text` returns `string`
 * - `qual_integer` returns `number`
 * - `qual_select_one` returns `AnalysisResponseSelectXValue`
 * - `qual_select_multiple` returns `AnalysisResponseSelectXValue[]`
 */
type AnalysisResponseValue =
  | string
  | string[]
  | number
  | AnalysisResponseSelectXValue
  | AnalysisResponseSelectXValue[];

/**
 * This is the object that is returned from interacting with the processing
 * endpoint (`asset.advanced_submission_schema.url`). It's similar to
 * the `SubmissionAnalysisResponse`, but with less detailed `val` - for both
 * `qual_select_one` and `qual_select_multiple` it will return a `string` (an
 * `uuid` of choice) and `string[]` (list of `uuid` of selected choices)
 * respectively.
 */
export interface AnalysisResponse extends AnalysisQuestionBase {
  val: string | string[] | number;
}

/**
 * This is the object that is returned from interacting with the data endpoint
 * (`/api/v2/assets/:uid/data`), it will be inside the `_supplementalDetails`
 * object for each appropiate submission. It's similar to `AnalysisResponse`,
 * but with more detailed `val` for `qual_select_one` and `qual_select_multiple`
 * - containing both `uuid` and a `labels` object.
 */
export interface SubmissionAnalysisResponse extends AnalysisQuestionBase {
  val: AnalysisResponseValue;
}

/**
 * This is the payload of a request made to update a question response.
 */
export interface AnalysisResponseUpdateRequest {
  [xpath: string]:
    | {
        qual: AnalysisRequest[];
      }
    | string; // this will never be a string, but we need TS to stop complaining
  submission: string;
}

/**
 * This is an API endpoint response for a request made to update a question
 * response.
 */
export interface SubmissionProcessingDataResponse {
  [xpath: string]: {
    qual: AnalysisResponse[];
  };
}

/**
 * The definition is the object that tells us what kind of questions are
 * internally available for being created, e.g. a `qual_integer` question type.
 */
export interface AnalysisQuestionTypeDefinition {
  type: AnalysisQuestionType;
  label: string;
  icon: IconName;
  /** Tells the UI to display it in separate section in dropdown. */
  isAutomated?: boolean;
  /** to see if all required data was provided. */
  additionalFieldNames?: Array<'keywords' | 'source' | 'choices'>;
}

/**
 * Note: the order here matters - it influnces the order of the dropdown for
 * adding questions and possibly other UI elements.
 */
export const ANALYSIS_QUESTION_TYPES: AnalysisQuestionTypeDefinition[] = [
  {
    type: 'qual_tags',
    label: t('Tags'),
    icon: 'tag',
  },
  {
    type: 'qual_text',
    label: t('Text'),
    icon: 'qt-text',
  },
  {
    type: 'qual_integer',
    label: t('Number'),
    icon: 'qt-number',
  },
  {
    type: 'qual_select_one',
    label: t('Single choice'),
    icon: 'qt-select-one',
    additionalFieldNames: ['choices'],
  },
  {
    type: 'qual_select_multiple',
    label: t('Multiple choice'),
    icon: 'qt-select-many',
    additionalFieldNames: ['choices'],
  },
  {
    type: 'qual_note',
    label: t('Note'),
    icon: 'qt-note',
  },
  // TODO: we temporarily hide Keyword Search from the UI until
  // https://github.com/kobotoolbox/kpi/issues/4594 is done
  // {
  //   type: 'qual_auto_keyword_count',
  //   label: t('Keyword search'),
  //   icon: 'tag',
  //   isAutomated: true,
  //   additionalFieldNames: ['keywords', 'source'],
  // },
];
