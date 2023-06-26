import type {IconName} from 'jsapp/fonts/k-icons';
import type {LanguageCode} from 'js/components/languages/languagesStore';

export const AUTO_SAVE_TYPING_DELAY = 3000;

/**
 * To differentiate these question types from the ones we use in Form Builder,
 * let's prefix them with `qual_` (abbreviation for "analysis question").
 */
export type AnalysisQuestionType =
  | 'qual_auto_keyword_count'
  | 'qual_note'
  | 'qual_integer'
  | 'qual_select_multiple'
  | 'qual_select_one'
  | 'qual_tags'
  | 'qual_text';

/**
 * This is a sum of all different possible fields for multiple question types.
 *
 * TODO: find a TypeScript way to make make this better.
 */
export interface AdditionalFields {
  /** A list of keywords to search for. */
  keywords?: string[];
  /** Used for `qual_auto_keyword_count` question to indicate search in progress. */
  isSearching?: boolean;
  /** The transcript or translation source for the search. */
  source?: LanguageCode;
  /** For the `qual_seleect_one` and `qual_select_multiple` question types */
  choices?: Array<{
    label: string;
    uuid: string;
  }>;
}

/**
 * An instance of analysis question. We use the same object for the question
 * and the response
 *
 * For example this coulde be a `qual_integer` question with label "How many
 * pauses did the responded take?" and response "7".
 */
export interface AnalysisQuestion {
  type: AnalysisQuestionType;
  labels: {
    _default: string;
    [langCode: string]: string;
  };
  uuid: string;
  response: string;
  additionalFields?: AdditionalFields;
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
  {
    type: 'qual_auto_keyword_count',
    label: t('Keyword search'),
    icon: 'tag',
    isAutomated: true,
    additionalFieldNames: ['keywords', 'source'],
  },
];
